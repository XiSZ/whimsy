import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  applyRefreshedAuthCookies,
  isAppConfigured,
  noStoreHeaders,
  resolveAuthState,
} from "@/lib/twitchAuth";

interface TwitchBlockedUsersResponse {
  data?: Array<{
    user_id?: string;
    user_login?: string;
    display_name?: string;
  }>;
  pagination?: { cursor?: string };
}

interface BlockedUser {
  id: string;
  login: string;
  name: string;
}

// ponytail: same 10-page (1000 entries) cap as the follow list.
const MAX_PAGES = 10;

async function fetchBlockedUsers(
  accessToken: string,
  userId: string,
): Promise<BlockedUser[]> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("Missing Twitch client configuration");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": TWITCH_CLIENT_ID,
  };

  const users: BlockedUser[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      broadcaster_id: userId,
      first: "100",
    });
    if (cursor) query.set("after", cursor);

    const response = await fetch(
      `https://api.twitch.tv/helix/users/blocks?${query.toString()}`,
      { headers },
    );

    // 401 usually means the token predates the blocked_users scopes.
    if (!response.ok) {
      throw new Error(`Failed to fetch blocked users (${response.status})`);
    }

    const payload = (await response.json()) as TwitchBlockedUsersResponse;

    for (const item of payload.data ?? []) {
      if (!item.user_id || !item.user_login) continue;
      users.push({
        id: item.user_id,
        login: item.user_login,
        name: item.display_name ?? item.user_login,
      });
    }

    cursor = payload.pagination?.cursor;
    if (!cursor) break;
  }

  return users;
}

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!isAppConfigured()) {
    return NextResponse.json(
      { configured: false, connected: false, blocked: null },
      { headers: noStoreHeaders() },
    );
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);

    if (!auth) {
      return NextResponse.json(
        { configured: true, connected: false, blocked: null },
        { headers: noStoreHeaders() },
      );
    }

    // null = scope missing / fetch failed; the UI offers a reconnect.
    const blocked = await fetchBlockedUsers(
      auth.accessToken,
      auth.userId,
    ).catch(() => null);

    const response = NextResponse.json(
      { configured: true, connected: true, blocked },
      { headers: noStoreHeaders() },
    );
    applyRefreshedAuthCookies(response, request, auth, updatedCookieAuth);
    return response;
  } catch {
    return NextResponse.json(
      { configured: true, connected: false, blocked: null },
      { headers: noStoreHeaders() },
    );
  }
}

export async function PUT(request: NextRequest) {
  const login = (
    request.nextUrl.searchParams.get("login") ?? ""
  ).toLowerCase();

  if (!/^[a-z0-9_]{1,25}$/.test(login)) {
    return NextResponse.json(
      { ok: false, error: "invalid_login" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!isAppConfigured() || !TWITCH_CLIENT_ID) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);

    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "not_connected" },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      "Client-Id": TWITCH_CLIENT_ID,
    };

    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${login}`,
      { headers },
    );

    if (!userResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "lookup_failed" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    const userPayload = (await userResponse.json()) as {
      data?: Array<{ id?: string; login?: string; display_name?: string }>;
    };
    const user = userPayload.data?.[0];

    if (!user?.id || !user.login) {
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404, headers: noStoreHeaders() },
      );
    }

    const blockResponse = await fetch(
      `https://api.twitch.tv/helix/users/blocks?target_user_id=${user.id}`,
      { method: "PUT", headers },
    );

    const ok = blockResponse.ok;
    const response = NextResponse.json(
      {
        ok,
        user: ok
          ? {
              id: user.id,
              login: user.login,
              name: user.display_name ?? user.login,
            }
          : undefined,
      },
      { status: ok ? 200 : 502, headers: noStoreHeaders() },
    );
    applyRefreshedAuthCookies(response, request, auth, updatedCookieAuth);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "unknown" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("target") ?? "";

  if (!/^\d+$/.test(target)) {
    return NextResponse.json(
      { ok: false, error: "invalid_target" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!isAppConfigured() || !TWITCH_CLIENT_ID) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);

    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "not_connected" },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const twitchResponse = await fetch(
      `https://api.twitch.tv/helix/users/blocks?target_user_id=${target}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      },
    );

    const ok = twitchResponse.ok;
    const response = NextResponse.json(
      { ok },
      { status: ok ? 200 : 502, headers: noStoreHeaders() },
    );
    applyRefreshedAuthCookies(response, request, auth, updatedCookieAuth);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "unknown" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
