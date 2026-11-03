import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const FEED =
  "https://calendar.google.com/calendar/ical/me%40gmail.com/private-abc/basic.ics";

const request = (body: unknown) =>
  new NextRequest("https://example.com/api/calendar", {
    method: "POST",
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/calendar", () => {
  it("refuses links other than Google Calendar iCal ones without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ url: "https://example.com/a.ics" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the feed through without following redirects", async () => {
    const fetchMock = vi.fn(async () => new Response("BEGIN:VCALENDAR"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ url: FEED }));

    expect(fetchMock).toHaveBeenCalledWith(FEED, { redirect: "manual" });
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(await response.text()).toBe("BEGIN:VCALENDAR");
  });

  it("reports a redirect or error upstream as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302 })),
    );

    expect((await POST(request({ url: FEED }))).status).toBe(502);
  });
});
