import { NextRequest, NextResponse } from "next/server";

export const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const TWITCH_USER_ID = process.env.TWITCH_USER_ID;

export const COOKIE_ACCESS_TOKEN = "twitch_access_token";
export const COOKIE_REFRESH_TOKEN = "twitch_refresh_token";
export const COOKIE_USER_ID = "twitch_user_id";
export const COOKIE_USER_LOGIN = "twitch_user_login";
export const COOKIE_EXPIRES_AT = "twitch_access_expires_at";

export interface TwitchTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface AuthState {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  expiresAt?: number;
  source: "cookie" | "env";
}

export type RefreshedCookieAuth = Pick<
  AuthState,
  "accessToken" | "refreshToken" | "expiresAt"
>;

export function noStoreHeaders() {
  return { "Cache-Control": "private, no-store" };
}

export function isAppConfigured(): boolean {
  const hasOauthConfig = Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
  const hasLegacyConfig = Boolean(
    TWITCH_CLIENT_ID && TWITCH_ACCESS_TOKEN && TWITCH_USER_ID,
  );
  return hasOauthConfig || hasLegacyConfig;
}

async function fetchCurrentUserIdFromToken(
  accessToken: string,
): Promise<string> {
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
    throw new Error(`Failed to resolve current user (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  const userId = payload.data?.[0]?.id;

  if (!userId) {
    throw new Error("Current user id missing in Twitch profile response");
  }

  return userId;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TwitchTokenResponse> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing Twitch refresh configuration");
  }

  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Twitch access token");
  }

  const payload = (await response.json()) as TwitchTokenResponse;
  if (!payload.access_token) {
    throw new Error("Twitch token response missing access token");
  }

  return payload;
}

function getCookieAuth(request: NextRequest): Partial<AuthState> {
  const accessToken = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  const userId = request.cookies.get(COOKIE_USER_ID)?.value;
  const expiresAtRaw = request.cookies.get(COOKIE_EXPIRES_AT)?.value;
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : undefined;

  return {
    accessToken,
    refreshToken,
    userId,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
}

export async function resolveAuthState(request: NextRequest): Promise<{
  auth: AuthState | null;
  updatedCookieAuth: RefreshedCookieAuth | null;
}> {
  const cookieAuth = getCookieAuth(request);
  const cookieAccessToken = cookieAuth.accessToken;
  const cookieUserId = cookieAuth.userId;

  if (cookieAccessToken) {
    let resolvedUserId = cookieUserId;

    if (!resolvedUserId) {
      try {
        resolvedUserId = await fetchCurrentUserIdFromToken(cookieAccessToken);
      } catch {
        resolvedUserId = undefined;
      }
    }

    if (!resolvedUserId) {
      return { auth: null, updatedCookieAuth: null };
    }

    const isExpired =
      typeof cookieAuth.expiresAt === "number" &&
      cookieAuth.expiresAt <= Date.now();

    if (!isExpired) {
      return {
        auth: {
          accessToken: cookieAccessToken,
          refreshToken: cookieAuth.refreshToken,
          userId: resolvedUserId,
          expiresAt: cookieAuth.expiresAt,
          source: "cookie",
        },
        updatedCookieAuth: null,
      };
    }

    if (cookieAuth.refreshToken) {
      const refreshed = await refreshAccessToken(cookieAuth.refreshToken);
      const expiresInSeconds = Math.max(
        60,
        Number(refreshed.expires_in ?? 3600),
      );
      const updated = {
        accessToken: refreshed.access_token as string,
        refreshToken: refreshed.refresh_token ?? cookieAuth.refreshToken,
        expiresAt: Date.now() + (expiresInSeconds - 60) * 1000,
      };

      return {
        auth: {
          accessToken: updated.accessToken,
          refreshToken: updated.refreshToken,
          userId: resolvedUserId,
          expiresAt: updated.expiresAt,
          source: "cookie",
        },
        updatedCookieAuth: updated,
      };
    }

    // Access token cookie exists but is expired with no refresh token.
    // Do not silently fall through to env auth — signal re-authentication needed.
    return { auth: null, updatedCookieAuth: null };
  }

  if (TWITCH_ACCESS_TOKEN && TWITCH_USER_ID) {
    return {
      auth: {
        accessToken: TWITCH_ACCESS_TOKEN,
        refreshToken: TWITCH_REFRESH_TOKEN,
        userId: TWITCH_USER_ID,
        source: "env",
      },
      updatedCookieAuth: null,
    };
  }

  return { auth: null, updatedCookieAuth: null };
}

export function isUnauthorizedTwitchError(error: unknown): boolean {
  return error instanceof Error && error.message === "twitch_unauthorized";
}

export function applyRefreshedAuthCookies(
  response: NextResponse,
  request: NextRequest,
  auth: AuthState,
  refreshedCookieAuth: RefreshedCookieAuth | null,
): void {
  if (auth.source !== "cookie" || !refreshedCookieAuth) return;

  const isSecure = request.url.startsWith("https://");
  response.cookies.set(COOKIE_ACCESS_TOKEN, refreshedCookieAuth.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  if (refreshedCookieAuth.refreshToken) {
    response.cookies.set(
      COOKIE_REFRESH_TOKEN,
      refreshedCookieAuth.refreshToken,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        path: "/",
        maxAge: 60 * 60 * 24 * 120,
      },
    );
  }
  response.cookies.set(
    COOKIE_EXPIRES_AT,
    String(refreshedCookieAuth.expiresAt),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 120,
    },
  );
  response.cookies.set(COOKIE_USER_ID, auth.userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 120,
  });
}
