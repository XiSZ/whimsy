import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  applyRefreshedAuthCookies,
  isAppConfigured,
  noStoreHeaders,
  resolveAuthState,
} from "@/lib/twitchAuth";

export const runtime = "edge";

// ponytail: 35 ids/request like /followers, under Cloudflare's 50-subrequest cap.
const MAX_IDS = 35;

interface TwitchVideosResponse {
  data?: Array<{ created_at?: string }>;
}

// Date of each channel's newest video (past broadcast, highlight or upload).
// Twitch has no "last live" field and deletes past broadcasts after 7–60
// days, so this is the closest activity signal; null = no videos at all.
// Failed lookups are left out so the client can retry them later.
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

    const lastVideos: Record<string, string | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(
            `https://api.twitch.tv/helix/videos?user_id=${id}&first=1&sort=time&type=all`,
            { headers },
          );
          if (!response.ok) return;
          const payload = (await response.json()) as TwitchVideosResponse;
          lastVideos[id] = payload.data?.[0]?.created_at ?? null;
        } catch {
          // Left out — retried on a later visit.
        }
      }),
    );

    const response = NextResponse.json(
      { lastVideos },
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
