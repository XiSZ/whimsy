import { NextRequest, NextResponse } from "next/server";

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

interface TwitchUsersLookupResponse {
  data?: Array<{
    id?: string;
    login?: string;
    display_name?: string;
  }>;
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const TWITCH_USER_ID = process.env.TWITCH_USER_ID;
const TWITCH_MAX_CHANNELS = Number(process.env.TWITCH_MAX_CHANNELS ?? "5");
const TWITCH_FOLLOWED_LOGINS = process.env.TWITCH_FOLLOWED_LOGINS ?? "";

const COOKIE_ACCESS_TOKEN = "twitch_access_token";
const COOKIE_REFRESH_TOKEN = "twitch_refresh_token";
const COOKIE_USER_ID = "twitch_user_id";
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

function getFallbackLogins(): string[] {
  return Array.from(
    new Set(
      TWITCH_FOLLOWED_LOGINS.split(",")
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 100);
}

async function getAppAccessToken(): Promise<string> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing Twitch client credentials");
  }

  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to get app access token (${response.status})`);
  }

  const payload = (await response.json()) as TwitchTokenResponse;

  if (!payload.access_token) {
    throw new Error("Missing app access token");
  }

  return payload.access_token;
}

async function fetchStreamsFromLoginList(
  logins: string[],
  maxChannels: number,
): Promise<
  Array<{
    login: string;
    name: string;
    viewerCount: number;
    category: string;
  }>
> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client id");
  }

  if (logins.length === 0) {
    return [];
  }

  const accessToken = await getAppAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const usersQuery = new URLSearchParams();
  logins.forEach((login) => usersQuery.append("login", login));

  const usersResponse = await fetch(
    `https://api.twitch.tv/helix/users?${usersQuery.toString()}`,
    {
      headers,
      cache: "no-store",
    },
  );

  if (!usersResponse.ok) {
    throw new Error(`Failed to resolve user IDs (${usersResponse.status})`);
  }

  const usersPayload = (await usersResponse.json()) as TwitchUsersLookupResponse;
  const userIds = (Array.isArray(usersPayload.data) ? usersPayload.data : [])
    .map((user) => user.id)
    .filter((id): id is string => Boolean(id));

  if (userIds.length === 0) {
    return [];
  }

  const streamsQuery = new URLSearchParams({ first: "100" });
  userIds.forEach((id) => streamsQuery.append("user_id", id));

  const streamsResponse = await fetch(
    `https://api.twitch.tv/helix/streams?${streamsQuery.toString()}`,
    {
      headers,
      cache: "no-store",
    },
  );

  if (!streamsResponse.ok) {
    throw new Error(`Failed to fetch streams list (${streamsResponse.status})`);
  }

  const streamsPayload = (await streamsResponse.json()) as TwitchStreamsResponse;
  const streams = Array.isArray(streamsPayload.data) ? streamsPayload.data : [];

  return streams
    .map((stream) => ({
      login: stream.user_login ?? "",
      name: stream.user_name ?? stream.user_login ?? "Unknown",
      viewerCount: Number(stream.viewer_count ?? 0),
      category: stream.game_name ?? "Uncategorized",
    }))
    .sort((a, b) => b.viewerCount - a.viewerCount)
    .slice(0, maxChannels);
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
    cache: "no-store",
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

  if (cookieAccessToken && cookieUserId) {
    const isExpired =
      typeof cookieAuth.expiresAt === "number" &&
      cookieAuth.expiresAt <= Date.now();

    if (!isExpired) {
      return {
        auth: {
          accessToken: cookieAccessToken,
          refreshToken: cookieAuth.refreshToken,
          userId: cookieUserId,
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
          userId: cookieUserId,
          expiresAt: updated.expiresAt,
          source: "cookie",
        },
        updatedCookieAuth: updated,
      };
    }
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
    {
      headers,
      cache: "no-store",
    },
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
    {
      headers,
      cache: "no-store",
    },
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
    {
      headers,
      cache: "no-store",
    },
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
    return NextResponse.json({
      configured: false,
      connected: false,
      channels: [],
    });
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);

    const maxChannels = getRequestedMaxChannels(request);

    if (!auth) {
      const fallbackLogins = getFallbackLogins();

      if (fallbackLogins.length > 0) {
        const channels = await fetchStreamsFromLoginList(
          fallbackLogins,
          maxChannels,
        );

        return NextResponse.json(
          {
            configured: true,
            connected: true,
            channels,
            mode: "login-list",
            fetchedAt: new Date().toISOString(),
          },
          {
            headers: {
              "Cache-Control":
                "private, max-age=0, s-maxage=120, stale-while-revalidate=180",
            },
          },
        );
      }

      return NextResponse.json({
        configured: true,
        connected: false,
        channels: [],
      });
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
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "private, max-age=0, s-maxage=120, stale-while-revalidate=180",
        },
      },
    );

    if (auth.source === "cookie" && refreshedCookieAuth) {
      const isProd = process.env.NODE_ENV === "production";
      response.cookies.set(COOKIE_ACCESS_TOKEN, refreshedCookieAuth.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      response.cookies.set(
        COOKIE_REFRESH_TOKEN,
        refreshedCookieAuth.refreshToken,
        {
          httpOnly: true,
          sameSite: "lax",
          secure: isProd,
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
          secure: isProd,
          path: "/",
          maxAge: 60 * 60 * 24 * 120,
        },
      );
    }

    return response;
  } catch {
    return NextResponse.json({
      configured: true,
      connected: false,
      channels: [],
    });
  }
}
