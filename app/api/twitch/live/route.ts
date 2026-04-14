import { NextRequest, NextResponse } from "next/server";

type ErrorCode =
  | "no_auth"
  | "token_expired_no_refresh"
  | "refresh_failed"
  | "unauthorized"
  | "scope_missing"
  | "api_error"
  | "unknown";

function noStoreHeaders() {
  return { "Cache-Control": "private, no-store" };
}

interface TwitchTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface TwitchFollowedStreamsResponse {
  data?: Array<{
    user_login?: string;
    user_name?: string;
    viewer_count?: number;
    game_name?: string;
  }>;
}

interface TwitchFollowedChannelsResponse {
  data?: Array<{
    broadcaster_id?: string;
  }>;
}

interface TwitchStreamsResponse {
  data?: Array<{
    user_login?: string;
    user_name?: string;
    viewer_count?: number;
    game_name?: string;
  }>;
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const TWITCH_USER_ID = process.env.TWITCH_USER_ID;
const TWITCH_MAX_CHANNELS = Number(process.env.TWITCH_MAX_CHANNELS ?? "5");

const COOKIE_ACCESS_TOKEN = "twitch_access_token";
const COOKIE_REFRESH_TOKEN = "twitch_refresh_token";
const COOKIE_USER_ID = "twitch_user_id";
const COOKIE_USER_LOGIN = "twitch_user_login";
const COOKIE_EXPIRES_AT = "twitch_access_expires_at";

interface AuthState {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  expiresAt?: number;
  source: "cookie" | "env";
}

function isAppConfigured(): boolean {
  const hasOauthConfig = Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
  const hasLegacyConfig = Boolean(
    TWITCH_CLIENT_ID && TWITCH_ACCESS_TOKEN && TWITCH_USER_ID,
  );
  return hasOauthConfig || hasLegacyConfig;
}

function normalizeMaxChannels(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function getMaxChannelsFromEnv(): number {
  return normalizeMaxChannels(TWITCH_MAX_CHANNELS);
}

function getRequestedMaxChannels(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("maxChannels");
  if (!raw) return getMaxChannelsFromEnv();
  return normalizeMaxChannels(Number(raw));
}

async function fetchCurrentUserIdFromToken(accessToken: string): Promise<string> {
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

async function refreshAccessToken(
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

async function resolveAuthState(request: NextRequest): Promise<{
  auth: AuthState | null;
  updatedCookieAuth: Pick<
    AuthState,
    "accessToken" | "refreshToken" | "expiresAt"
  > | null;
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

function isUnauthorizedTwitchError(error: unknown): boolean {
  return error instanceof Error && error.message === "twitch_unauthorized";
}

async function fetchFollowedStreams(
  accessToken: string,
  userId: string,
  maxChannels: number,
) {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const mapStreams = (
    streams: Array<{
      user_login?: string;
      user_name?: string;
      viewer_count?: number;
      game_name?: string;
    }>,
  ) =>
    streams.map((stream) => ({
      login: stream.user_login ?? "",
      name: stream.user_name ?? stream.user_login ?? "Unknown",
      viewerCount: Number(stream.viewer_count ?? 0),
      category: stream.game_name ?? "Uncategorized",
    }));

  const query = new URLSearchParams({
    user_id: userId,
    first: String(maxChannels),
  });

  const response = await fetch(
    `https://api.twitch.tv/helix/streams/followed?${query.toString()}`,
    { headers },
  );

  if (response.status === 401) {
    throw new Error("twitch_unauthorized");
  }

  if (response.ok) {
    const payload = (await response.json()) as TwitchFollowedStreamsResponse;
    const streams = Array.isArray(payload.data) ? payload.data : [];
    return mapStreams(streams);
  }

  if (![400, 401, 403, 404].includes(response.status)) {
    throw new Error(
      `Failed to fetch Twitch followed streams (${response.status})`,
    );
  }

  // Fallback for environments/accounts where streams/followed is restricted.
  const followsResponse = await fetch(
    `https://api.twitch.tv/helix/channels/followed?user_id=${encodeURIComponent(userId)}&first=100`,
    { headers },
  );

  if (followsResponse.status === 401) {
    throw new Error("twitch_unauthorized");
  }

  if (!followsResponse.ok) {
    throw new Error(
      `Failed to fetch followed channels (${followsResponse.status})`,
    );
  }

  const followsPayload =
    (await followsResponse.json()) as TwitchFollowedChannelsResponse;
  const followedIds = Array.from(
    new Set(
      (Array.isArray(followsPayload.data) ? followsPayload.data : [])
        .map((item) => item.broadcaster_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (followedIds.length === 0) {
    return [];
  }

  const streamQuery = new URLSearchParams({ first: "100" });
  followedIds.forEach((id) => streamQuery.append("user_id", id));

  const streamsResponse = await fetch(
    `https://api.twitch.tv/helix/streams?${streamQuery.toString()}`,
    { headers },
  );

  if (streamsResponse.status === 401) {
    throw new Error("twitch_unauthorized");
  }

  if (!streamsResponse.ok) {
    throw new Error(`Failed to fetch streams list (${streamsResponse.status})`);
  }

  const streamsPayload =
    (await streamsResponse.json()) as TwitchStreamsResponse;
  const streams = Array.isArray(streamsPayload.data) ? streamsPayload.data : [];

  return mapStreams(streams)
    .sort((a, b) => b.viewerCount - a.viewerCount)
    .slice(0, maxChannels);
}

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!isAppConfigured()) {
    return NextResponse.json(
      { configured: false, connected: false, channels: [] },
      { headers: noStoreHeaders() },
    );
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);
    const userLogin = request.cookies.get(COOKIE_USER_LOGIN)?.value ?? null;

    const maxChannels = getRequestedMaxChannels(request);

    if (!auth) {
      return NextResponse.json(
        { configured: true, connected: false, channels: [], error_code: "no_auth" as ErrorCode },
        { headers: noStoreHeaders() },
      );
    }

    let channels;
    let refreshedCookieAuth = updatedCookieAuth;

    try {
      channels = await fetchFollowedStreams(auth.accessToken, auth.userId, maxChannels);
    } catch (error) {
      if (
        isUnauthorizedTwitchError(error) &&
        auth.source === "cookie" &&
        auth.refreshToken
      ) {
        const refreshed = await refreshAccessToken(auth.refreshToken);
        const expiresInSeconds = Math.max(60, Number(refreshed.expires_in ?? 3600));

        const retriedAccessToken = refreshed.access_token as string;
        const retriedRefreshToken = refreshed.refresh_token ?? auth.refreshToken;

        channels = await fetchFollowedStreams(
          retriedAccessToken,
          auth.userId,
          maxChannels,
        );

        refreshedCookieAuth = {
          accessToken: retriedAccessToken,
          refreshToken: retriedRefreshToken,
          expiresAt: Date.now() + (expiresInSeconds - 60) * 1000,
        };
      } else {
        throw error;
      }
    }

    const response = NextResponse.json(
      {
        configured: true,
        connected: true,
        channels,
        username: userLogin,
        fetchedAt: new Date().toISOString(),
      },
      { headers: noStoreHeaders() },
    );

    if (auth.source === "cookie" && refreshedCookieAuth) {
      const isSecure = request.url.startsWith("https://");
      response.cookies.set(COOKIE_ACCESS_TOKEN, refreshedCookieAuth.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
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

    return response;
  } catch (err) {
    const code: ErrorCode =
      err instanceof Error && err.message === "twitch_unauthorized"
        ? "unauthorized"
        : err instanceof Error && err.message.toLowerCase().includes("scope")
          ? "scope_missing"
          : err instanceof Error && err.message.toLowerCase().includes("refresh")
            ? "refresh_failed"
            : err instanceof Error && err.message.toLowerCase().includes("api")
              ? "api_error"
              : "unknown";
    return NextResponse.json(
      { configured: true, connected: false, channels: [], error_code: code },
      { headers: noStoreHeaders() },
    );
  }
}
