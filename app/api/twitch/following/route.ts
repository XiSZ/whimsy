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

interface TwitchFollowedChannelsResponse {
  total?: number;
  data?: Array<{
    broadcaster_id?: string;
    broadcaster_login?: string;
    broadcaster_name?: string;
    followed_at?: string;
  }>;
  pagination?: { cursor?: string };
}

interface FollowedChannel {
  id: string;
  login: string;
  name: string;
  followedAt: string;
  broadcasterType?: string;
  createdAt?: string;
  lastCategory?: string;
  lastTitle?: string;
  avatarUrl?: string;
  live?: boolean;
  viewerCount?: number;
}

interface TwitchStreamsResponse {
  data?: Array<{
    user_id?: string;
    viewer_count?: number;
  }>;
}

interface TwitchChannelsResponse {
  data?: Array<{
    broadcaster_id?: string;
    game_name?: string;
    title?: string;
  }>;
}

interface TwitchUsersResponse {
  data?: Array<{
    id?: string;
    broadcaster_type?: string;
    created_at?: string;
    profile_image_url?: string;
  }>;
}

interface TwitchModeratedChannelsResponse {
  data?: Array<{
    broadcaster_id?: string;
    broadcaster_login?: string;
    broadcaster_name?: string;
  }>;
  pagination?: { cursor?: string };
}

interface ModeratedChannel {
  id: string;
  login: string;
  name: string;
}

// ponytail: hard cap of 10 pages (1000 follows); raise if someone actually follows more.
const MAX_PAGES = 10;

async function fetchAllFollowedChannels(
  accessToken: string,
  userId: string,
): Promise<{ total: number; channels: FollowedChannel[] }> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const channels: FollowedChannel[] = [];
  let total = 0;
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ user_id: userId, first: "100" });
    if (cursor) query.set("after", cursor);

    const response = await fetch(
      `https://api.twitch.tv/helix/channels/followed?${query.toString()}`,
      { headers },
    );

    if (response.status === 401) {
      throw new Error("twitch_unauthorized");
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch followed channels (${response.status})`,
      );
    }

    const payload =
      (await response.json()) as TwitchFollowedChannelsResponse;
    total = Number(payload.total ?? total);

    for (const item of payload.data ?? []) {
      if (!item.broadcaster_id || !item.broadcaster_login) continue;
      channels.push({
        id: item.broadcaster_id,
        login: item.broadcaster_login,
        name: item.broadcaster_name ?? item.broadcaster_login,
        followedAt: item.followed_at ?? "",
      });
    }

    cursor = payload.pagination?.cursor;
    if (!cursor) break;
  }

  return { total, channels };
}

async function fetchModeratedChannels(
  accessToken: string,
  userId: string,
): Promise<ModeratedChannel[]> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const channels: ModeratedChannel[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ user_id: userId, first: "100" });
    if (cursor) query.set("after", cursor);

    const response = await fetch(
      `https://api.twitch.tv/helix/moderation/channels?${query.toString()}`,
      { headers },
    );

    // 401 here usually means the token predates the
    // user:read:moderated_channels scope — treated as "unavailable" upstream.
    if (!response.ok) {
      throw new Error(
        `Failed to fetch moderated channels (${response.status})`,
      );
    }

    const payload =
      (await response.json()) as TwitchModeratedChannelsResponse;

    for (const item of payload.data ?? []) {
      if (!item.broadcaster_id || !item.broadcaster_login) continue;
      channels.push({
        id: item.broadcaster_id,
        login: item.broadcaster_login,
        name: item.broadcaster_name ?? item.broadcaster_login,
      });
    }

    cursor = payload.pagination?.cursor;
    if (!cursor) break;
  }

  return channels;
}

interface UserDetail {
  broadcasterType: string;
  createdAt: string;
  avatarUrl: string;
}

async function fetchUserDetails(
  accessToken: string,
  ids: string[],
): Promise<Map<string, UserDetail>> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const details = new Map<string, UserDetail>();

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const query = new URLSearchParams();
      chunk.forEach((id) => query.append("id", id));

      const response = await fetch(
        `https://api.twitch.tv/helix/users?${query.toString()}`,
        { headers },
      );

      // Details are decoration — a failed chunk just stays unenriched.
      if (!response.ok) return;

      const payload = (await response.json()) as TwitchUsersResponse;
      for (const user of payload.data ?? []) {
        if (!user.id) continue;
        details.set(user.id, {
          broadcasterType: user.broadcaster_type ?? "",
          createdAt: user.created_at ?? "",
          avatarUrl: user.profile_image_url ?? "",
        });
      }
    }),
  );

  return details;
}

async function fetchChannelInfo(
  accessToken: string,
  ids: string[],
): Promise<Map<string, { lastCategory: string; lastTitle: string }>> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const info = new Map<string, { lastCategory: string; lastTitle: string }>();

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const query = new URLSearchParams();
      chunk.forEach((id) => query.append("broadcaster_id", id));

      const response = await fetch(
        `https://api.twitch.tv/helix/channels?${query.toString()}`,
        { headers },
      );

      if (!response.ok) return;

      const payload = (await response.json()) as TwitchChannelsResponse;
      for (const channel of payload.data ?? []) {
        if (!channel.broadcaster_id) continue;
        info.set(channel.broadcaster_id, {
          lastCategory: channel.game_name ?? "",
          lastTitle: channel.title ?? "",
        });
      }
    }),
  );

  return info;
}

async function fetchLiveStreams(
  accessToken: string,
  ids: string[],
): Promise<Map<string, number>> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const live = new Map<string, number>();

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const query = new URLSearchParams({ first: "100" });
      chunk.forEach((id) => query.append("user_id", id));

      const response = await fetch(
        `https://api.twitch.tv/helix/streams?${query.toString()}`,
        { headers },
      );

      if (!response.ok) return;

      const payload = (await response.json()) as TwitchStreamsResponse;
      for (const stream of payload.data ?? []) {
        if (!stream.user_id) continue;
        live.set(stream.user_id, Number(stream.viewer_count ?? 0));
      }
    }),
  );

  return live;
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

    if (!auth) {
      return NextResponse.json(
        { configured: true, connected: false, channels: [] },
        { headers: noStoreHeaders() },
      );
    }

    let result;
    let activeAccessToken = auth.accessToken;
    let refreshedCookieAuth: RefreshedCookieAuth | null = updatedCookieAuth;

    try {
      result = await fetchAllFollowedChannels(auth.accessToken, auth.userId);
    } catch (error) {
      if (
        isUnauthorizedTwitchError(error) &&
        auth.source === "cookie" &&
        auth.refreshToken
      ) {
        const refreshed = await refreshAccessToken(auth.refreshToken);
        const expiresInSeconds = Math.max(
          60,
          Number(refreshed.expires_in ?? 3600),
        );
        const retriedAccessToken = refreshed.access_token as string;

        result = await fetchAllFollowedChannels(
          retriedAccessToken,
          auth.userId,
        );
        activeAccessToken = retriedAccessToken;

        refreshedCookieAuth = {
          accessToken: retriedAccessToken,
          refreshToken: refreshed.refresh_token ?? auth.refreshToken,
          expiresAt: Date.now() + (expiresInSeconds - 60) * 1000,
        };
      } else {
        throw error;
      }
    }

    // All decoration — null/empty on failure, never break the follow list.
    const followedIds = result.channels.map((channel) => channel.id);
    const [moderated, userDetails, channelInfo, liveStreams] =
      await Promise.all([
        fetchModeratedChannels(activeAccessToken, auth.userId).catch(
          () => null,
        ),
        fetchUserDetails(activeAccessToken, followedIds).catch(
          () => new Map<string, UserDetail>(),
        ),
        fetchChannelInfo(activeAccessToken, followedIds).catch(
          () => new Map<string, { lastCategory: string; lastTitle: string }>(),
        ),
        fetchLiveStreams(activeAccessToken, followedIds).catch(
          () => new Map<string, number>(),
        ),
      ]);

    for (const channel of result.channels) {
      const detail = userDetails.get(channel.id);
      if (detail) {
        channel.broadcasterType = detail.broadcasterType;
        channel.createdAt = detail.createdAt;
        channel.avatarUrl = detail.avatarUrl;
      }
      const info = channelInfo.get(channel.id);
      if (info) {
        channel.lastCategory = info.lastCategory;
        channel.lastTitle = info.lastTitle;
      }
      channel.live = liveStreams.has(channel.id);
      if (channel.live) {
        channel.viewerCount = liveStreams.get(channel.id);
      }
    }

    const response = NextResponse.json(
      {
        configured: true,
        connected: true,
        total: result.total,
        channels: result.channels,
        moderated,
        username: userLogin,
      },
      { headers: noStoreHeaders() },
    );

    applyRefreshedAuthCookies(response, request, auth, refreshedCookieAuth);

    return response;
  } catch {
    return NextResponse.json(
      { configured: true, connected: false, channels: [], error: true },
      { headers: noStoreHeaders() },
    );
  }
}
