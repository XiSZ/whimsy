import { NextRequest, NextResponse } from "next/server";

interface TwitchTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  message?: string;
  status?: number;
}

interface TwitchUsersResponse {
  data?: Array<{
    id?: string;
  }>;
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_OAUTH_REDIRECT_URI = process.env.TWITCH_OAUTH_REDIRECT_URI;

const COOKIE_ACCESS_TOKEN = "twitch_access_token";
const COOKIE_REFRESH_TOKEN = "twitch_refresh_token";
const COOKIE_USER_ID = "twitch_user_id";
const COOKIE_EXPIRES_AT = "twitch_access_expires_at";

export const runtime = "edge";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyStateSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signature),
    new TextEncoder().encode(payload),
  );
}

async function isValidState(state: string): Promise<boolean> {
  if (!TWITCH_CLIENT_SECRET) return false;

  const parts = state.split(".");
  if (parts.length < 3) return false;

  const signature = parts.pop() as string;
  const payload = parts.join(".");
  const issuedAtRaw = parts[parts.length - 1];
  const issuedAt = Number(issuedAtRaw);

  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > OAUTH_STATE_TTL_MS) return false;

  return verifyStateSignature(payload, signature, TWITCH_CLIENT_SECRET);
}

function redirectWithReason(request: NextRequest, reason: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("twitch", "oauth_failed");
  url.searchParams.set("twitch_reason", reason);
  return NextResponse.redirect(url);
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing Twitch app credentials");
  }

  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  let response: Response;

  try {
    response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "unknown_fetch_error";
    const normalized = rawMessage
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    throw new Error(`token_exchange:network_error_${normalized || "unknown"}`);
  }

  if (!response.ok) {
    let reason = `status_${response.status}`;

    try {
      const errorPayload = (await response.json()) as TwitchTokenResponse;
      const providerError = errorPayload.error
        ?.toLowerCase()
        .replace(/\s+/g, "_");
      const message = errorPayload.message?.toLowerCase() ?? "";

      if (providerError) {
        reason = providerError;
      }

      if (message.includes("redirect_uri")) {
        reason = "redirect_uri_mismatch";
      } else if (
        message.includes("client secret") ||
        message.includes("invalid client")
      ) {
        reason = "invalid_client_secret";
      } else if (
        message.includes("invalid oauth token") ||
        message.includes("invalid code")
      ) {
        reason = "invalid_code";
      }
    } catch {
      // keep fallback status-based reason
    }

    throw new Error(`token_exchange:${reason}`);
  }

  const payload = (await response.json()) as TwitchTokenResponse;
  if (!payload.access_token) {
    throw new Error("token_exchange:missing_access_token");
  }

  const expiresInSeconds = Math.max(60, Number(payload.expires_in ?? 3600));

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (expiresInSeconds - 60) * 1000,
  };
}

async function fetchUserId(accessToken: string) {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client id");
  }

  const response = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Twitch user profile");
  }

  const payload = (await response.json()) as TwitchUsersResponse;
  const userId = payload.data?.[0]?.id;

  if (!userId) {
    throw new Error("Unable to resolve Twitch user id");
  }

  return userId;
}

export async function GET(request: NextRequest) {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  const oauthError = callbackUrl.searchParams.get("error");

  if (oauthError) {
    return redirectWithReason(request, `provider_${oauthError}`);
  }

  if (!code || !state || !(await isValidState(state))) {
    return redirectWithReason(request, "state_mismatch");
  }

  try {
    const redirectUri =
      TWITCH_OAUTH_REDIRECT_URI ??
      new URL("/api/twitch/oauth/callback", request.url).toString();
    let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;

    try {
      tokens = await exchangeCodeForTokens(code, redirectUri);
    } catch (error) {
      const reason =
        error instanceof Error && error.message.startsWith("token_exchange:")
          ? `token_exchange_${error.message.slice("token_exchange:".length)}`
          : "token_exchange_failed";
      return redirectWithReason(request, reason);
    }

    let userId: string;

    try {
      userId = await fetchUserId(tokens.accessToken);
    } catch {
      return redirectWithReason(request, "user_profile_failed");
    }

    // Use a 200 HTML response instead of a 302 redirect.
    // Cloudflare Pages edge network can drop Set-Cookie headers on redirect
    // responses. Setting cookies on a 200 response and redirecting via
    // meta-refresh / JS guarantees the browser stores the cookies first.
    const redirectTarget = new URL("/?twitch=connected", request.url).toString();
    const htmlBody =
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
      `<meta http-equiv="refresh" content="0;url=${redirectTarget}">` +
      `</head><body><script>location.replace(${JSON.stringify(redirectTarget)})</script>` +
      `Connecting\u2026</body></html>`;
    const response = new NextResponse(htmlBody, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
    const isSecure = request.url.startsWith("https://");

    response.cookies.set(COOKIE_ACCESS_TOKEN, tokens.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    if (tokens.refreshToken) {
      response.cookies.set(COOKIE_REFRESH_TOKEN, tokens.refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        path: "/",
        maxAge: 60 * 60 * 24 * 120,
      });
    } else {
      response.cookies.delete(COOKIE_REFRESH_TOKEN);
    }
    response.cookies.set(COOKIE_USER_ID, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 120,
    });
    response.cookies.set(COOKIE_EXPIRES_AT, String(tokens.expiresAt), {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 120,
    });

    return response;
  } catch {
    return redirectWithReason(request, "unknown");
  }
}
