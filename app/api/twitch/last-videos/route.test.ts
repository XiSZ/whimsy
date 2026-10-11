import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let GET: typeof import("./route").GET;

beforeAll(async () => {
  vi.stubEnv("TWITCH_CLIENT_ID", "client");
  vi.stubEnv("TWITCH_CLIENT_SECRET", "secret");
  ({ GET } = await import("./route"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function connectedRequest(ids: string) {
  const cookie = [
    "twitch_access_token=token",
    "twitch_user_id=42",
    `twitch_access_expires_at=${Date.now() + 60_000}`,
  ].join("; ");
  return new NextRequest(
    `https://example.com/api/twitch/last-videos?ids=${ids}`,
    { headers: { cookie } },
  );
}

describe("GET /api/twitch/last-videos", () => {
  it("returns the newest video date, null for none, and omits failures", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const id = new URL(url).searchParams.get("user_id");
      if (id === "1") {
        return Response.json({ data: [{ created_at: "2026-09-01T18:00:00Z" }] });
      }
      if (id === "2") return Response.json({ data: [] });
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = await (await GET(connectedRequest("1,2,3"))).json();

    expect(payload.lastVideos).toEqual({
      "1": "2026-09-01T18:00:00Z",
      "2": null,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("type=all");
  });
});
