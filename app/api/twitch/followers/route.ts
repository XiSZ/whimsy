import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  applyRefreshedAuthCookies,
  isAppConfigured,
  noStoreHeaders,
  resolveAuthState,
} from "@/lib/twitchAuth";

export const runtime = "edge";

// ponytail: 35 ids/request keeps each edge invocation under Cloudflare's
// 50-subrequest cap; the client walks the full list chunk by chunk.
const MAX_IDS = 35;

// Batch follower totals for the "Most followed" sort. Helix has no bulk
// followers endpoint, so this fans out one request per broadcaster id.
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^\d+$/.test(id))
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "invalid_ids" },
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

    const counts: Record<string, number | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        counts[id] = await fetch(
          `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${id}&first=1`,
          { headers },
        )
          .then((response) => (response.ok ? response.json() : null))
          .then((payload: { total?: number } | null) =>
            typeof payload?.total === "number" ? payload.total : null,
          )
          .catch(() => null);
      }),
    );

    const response = NextResponse.json({ counts }, { headers: noStoreHeaders() });
    applyRefreshedAuthCookies(response, request, auth, updatedCookieAuth);
    return response;
  } catch {
    return NextResponse.json(
      { error: "unknown" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
