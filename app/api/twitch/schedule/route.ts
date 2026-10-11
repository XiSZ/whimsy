import { NextRequest, NextResponse } from "next/server";
import {
  TWITCH_CLIENT_ID,
  applyRefreshedAuthCookies,
  isAppConfigured,
  noStoreHeaders,
  resolveAuthState,
} from "@/lib/twitchAuth";
import type { ChannelSchedule } from "@/lib/twitchSchedule";

export const runtime = "edge";

// ponytail: same 35-id cap as /followers to stay under Cloudflare's
// 50-subrequest limit; the client walks favorites chunk by chunk.
const MAX_IDS = 35;

interface TwitchScheduleResponse {
  data?: {
    segments?: Array<{
      start_time?: string;
      end_time?: string | null;
      title?: string;
      canceled_until?: string | null;
      category?: { name?: string } | null;
    }> | null;
    vacation?: { start_time?: string; end_time?: string } | null;
  };
}

async function fetchSchedule(
  headers: Record<string, string>,
  id: string,
): Promise<ChannelSchedule | null> {
  const response = await fetch(
    `https://api.twitch.tv/helix/schedule?broadcaster_id=${id}&first=25`,
    { headers },
  );

  // Twitch answers 404 for channels that never set up a schedule.
  if (response.status === 404) return { segments: [], vacation: null };
  if (!response.ok) return null;

  const payload = (await response.json()) as TwitchScheduleResponse;
  const vacation = payload.data?.vacation;

  return {
    segments: (payload.data?.segments ?? [])
      .filter((segment) => segment.start_time && !segment.canceled_until)
      .map((segment) => ({
        start: segment.start_time as string,
        end: segment.end_time ?? null,
        title: segment.title ?? "",
        category: segment.category?.name ?? "",
      })),
    vacation:
      vacation?.start_time && vacation.end_time
        ? { start: vacation.start_time, end: vacation.end_time }
        : null,
  };
}

// Upcoming stream segments per broadcaster id (null = lookup failed). Times
// stay UTC ISO strings; the browser formats them in the viewer's timezone.
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

    const schedules: Record<string, ChannelSchedule | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        schedules[id] = await fetchSchedule(headers, id).catch(() => null);
      }),
    );

    const response = NextResponse.json(
      { schedules },
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
