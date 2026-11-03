import { NextRequest, NextResponse } from "next/server";
import { isGoogleIcsUrl } from "@/lib/calendar";

export const runtime = "edge";

const HEADERS = { "Cache-Control": "private, no-store" };

// Relays a Google Calendar iCal feed, which the page can't fetch itself
// (CORS). POST keeps the secret link out of URLs and logs. The body passes
// through unparsed: parsing a large calendar would exceed the edge CPU limit,
// so the browser does it.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = body?.url;
  if (typeof url !== "string" || !isGoogleIcsUrl(url)) {
    return NextResponse.json(
      { error: "Not a Google Calendar iCal link" },
      { status: 400, headers: HEADERS },
    );
  }

  // A redirect could point anywhere, so it counts as a failure.
  const upstream = await fetch(url, { redirect: "manual" }).catch(() => null);
  if (upstream?.status !== 200) {
    return NextResponse.json(
      { error: "Calendar unavailable" },
      { status: 502, headers: HEADERS },
    );
  }

  return new Response(upstream.body, {
    headers: { ...HEADERS, "Content-Type": "text/calendar; charset=utf-8" },
  });
}
