import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  COOKIE_USER_LOGIN,
  applyRefreshedAuthCookies,
  isAppConfigured,
  isUnauthorizedTwitchError,
  noStoreHeaders,
  refreshAccessToken,
  resolveAuthState,
  type RefreshedCookieAuth,
} from "@/lib/twitchAuth";

type ErrorCode =
  | "no_auth"
  | "token_expired_no_refresh"
  | "refresh_failed"
  | "unauthorized"
  | "scope_missing"
  | "api_error"
  | "unknown";

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

const TWITCH_MAX_CHANNELS = Number(process.env.TWITCH_MAX_CHANNELS ?? "5");

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
    let refreshedCookieAuth: RefreshedCookieAuth | null = updatedCookieAuth;

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

    applyRefreshedAuthCookies(response, request, auth, refreshedCookieAuth);

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
