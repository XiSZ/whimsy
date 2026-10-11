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
  return new NextRequest(`https://example.com/api/twitch/schedule?ids=${ids}`, {
    headers: { cookie },
  });
}

// Answers each Twitch call by broadcaster id.
function mockTwitch(byId: Record<string, Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const id = new URL(url).searchParams.get("broadcaster_id") ?? "";
      return byId[id];
    }),
  );
}

describe("GET /api/twitch/schedule", () => {
  it("drops canceled segments and keeps vacation", async () => {
    mockTwitch({
      "1": Response.json({
        data: {
          segments: [
            {
              start_time: "2026-10-12T18:00:00Z",
              end_time: "2026-10-12T22:00:00Z",
              title: "Ranked",
              category: { name: "Valorant" },
              canceled_until: null,
            },
            {
              start_time: "2026-10-13T18:00:00Z",
              end_time: "2026-10-13T22:00:00Z",
              title: "Canceled",
              category: null,
              canceled_until: "2026-10-13T22:00:00Z",
            },
          ],
          vacation: {
            start_time: "2026-10-20T00:00:00Z",
            end_time: "2026-10-27T00:00:00Z",
          },
        },
      }),
    });

    const payload = await (await GET(connectedRequest("1"))).json();

    expect(payload.schedules["1"]).toEqual({
      segments: [
        {
          start: "2026-10-12T18:00:00Z",
          end: "2026-10-12T22:00:00Z",
          title: "Ranked",
          category: "Valorant",
        },
      ],
      vacation: { start: "2026-10-20T00:00:00Z", end: "2026-10-27T00:00:00Z" },
    });
  });

  it("treats 404 as no schedule and other failures as null", async () => {
    mockTwitch({
      "1": new Response(null, { status: 404 }),
      "2": new Response(null, { status: 500 }),
      "3": Response.json({ data: { segments: null, vacation: null } }),
    });

    const payload = await (await GET(connectedRequest("1,2,3"))).json();

    expect(payload.schedules).toEqual({
      "1": { segments: [], vacation: null },
      "2": null,
      "3": { segments: [], vacation: null },
    });
  });

  it("rejects requests without valid ids", async () => {
    const response = await GET(connectedRequest("abc"));

    expect(response.status).toBe(400);
  });
});
