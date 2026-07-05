import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  applyRefreshedAuthCookies,
  isAppConfigured,
  noStoreHeaders,
  resolveAuthState,
} from "@/lib/twitchAuth";

export const runtime = "edge";

// On-demand per-channel details: latest VOD date + follower total.
// Deliberately not batched into /following — 1 call per channel is only
// affordable when the user asks for a specific one.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: "invalid_id" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!isAppConfigured() || !TWITCH_CLIENT_ID) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const { auth, updatedCookieAuth } = await resolveAuthState(request);

    if (!auth) {
      return NextResponse.json(
        { error: "not_connected" },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      "Client-Id": TWITCH_CLIENT_ID,
    };

    const [lastStreamedAt, followers] = await Promise.all([
      fetch(
        `https://api.twitch.tv/helix/videos?user_id=${id}&first=1&type=archive`,
        { headers },
      )
        .then((response) => (response.ok ? response.json() : null))
        .then(
          (payload: { data?: Array<{ created_at?: string }> } | null) =>
            payload?.data?.[0]?.created_at ?? null,
        )
        .catch(() => null),
      fetch(
        `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${id}&first=1`,
        { headers },
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { total?: number } | null) =>
          typeof payload?.total === "number" ? payload.total : null,
        )
        .catch(() => null),
    ]);

    const response = NextResponse.json(
      { lastStreamedAt, followers },
      { headers: noStoreHeaders() },
    );
    applyRefreshedAuthCookies(response, request, auth, updatedCookieAuth);
    return response;
  } catch {
    return NextResponse.json(
      { error: "unknown" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
