import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  applyRefreshedAuthCookies,
  isAppConfigured,
  noStoreHeaders,
  resolveAuthState,
} from "@/lib/twitchAuth";
import type { Follower } from "@/lib/followerChanges";

interface TwitchChannelFollowersResponse {
  total?: number;
  data?: Array<{
    user_id?: string;
    user_login?: string;
    user_name?: string;
    followed_at?: string;
  }>;
  pagination?: { cursor?: string };
}

// ponytail: 40 pages (4000 followers) stays under Cloudflare's 50-subrequest
// cap alongside auth; `truncated` tells the UI when the list is cut short.
const MAX_PAGES = 40;

// Who follows the connected account, newest first. Powers the Followers tab
// and the follow-back markers on the follow list.
async function fetchMyFollowers(
  accessToken: string,
  userId: string,
): Promise<{
  followers: Follower[];
  total: number;
  truncated: boolean;
}> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const followers: Follower[] = [];
  let total = 0;
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ broadcaster_id: userId, first: "100" });
    if (cursor) query.set("after", cursor);

    const response = await fetch(
      `https://api.twitch.tv/helix/channels/followers?${query.toString()}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch followers (${response.status})`);
    }

    const payload = (await response.json()) as TwitchChannelFollowersResponse;
    total = Number(payload.total ?? total);

    // Without moderator:read:followers Twitch still answers 200, but with
    // only the total and no entries.
    if (page === 0 && total > 0 && (payload.data ?? []).length === 0) {
      throw new Error("missing_scope");
    }

    for (const item of payload.data ?? []) {
      if (!item.user_id || !item.user_login) continue;
      followers.push({
        id: item.user_id,
        login: item.user_login,
        name: item.user_name ?? item.user_login,
        followedAt: item.followed_at ?? "",
      });
    }

    cursor = payload.pagination?.cursor;
    if (!cursor) break;
  }

  return { followers, total, truncated: Boolean(cursor) };
}

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!isAppConfigured()) {
    return NextResponse.json(
      { configured: false, connected: false, followers: null },
      { headers: noStoreHeaders() },
    );
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);

    if (!auth) {
      return NextResponse.json(
        { configured: true, connected: false, followers: null },
        { headers: noStoreHeaders() },
      );
    }

    // null = scope missing / fetch failed; the UI offers a reconnect.
    const result = await fetchMyFollowers(auth.accessToken, auth.userId).catch(
      () => null,
    );

    const response = NextResponse.json(
      {
        configured: true,
        connected: true,
        userId: auth.userId,
        followers: result?.followers ?? null,
        total: result?.total ?? 0,
        truncated: result?.truncated ?? false,
      },
      { headers: noStoreHeaders() },
    );
    applyRefreshedAuthCookies(response, request, auth, updatedCookieAuth);
    return response;
  } catch {
    return NextResponse.json(
      { configured: true, connected: false, followers: null },
      { headers: noStoreHeaders() },
    );
  }
}
