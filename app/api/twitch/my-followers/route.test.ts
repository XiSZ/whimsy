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

function connectedRequest() {
  const cookie = [
    "twitch_access_token=token",
    "twitch_user_id=42",
    `twitch_access_expires_at=${Date.now() + 60_000}`,
  ].join("; ");
  return new NextRequest("https://example.com/api/twitch/my-followers", {
    headers: { cookie },
  });
}

function mockPages(pages: object[]) {
  const fetchMock = vi.fn();
  for (const page of pages) {
    fetchMock.mockResolvedValueOnce(Response.json(page));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /api/twitch/my-followers", () => {
  it("walks all pages into a newest-first follower list", async () => {
    const fetchMock = mockPages([
      {
        total: 3,
        data: [
          { user_id: "1", user_login: "one", user_name: "One", followed_at: "2024-01-01T00:00:00Z" },
          { user_id: "2", user_login: "two", followed_at: "2024-02-01T00:00:00Z" },
        ],
        pagination: { cursor: "next" },
      },
      {
        total: 3,
        data: [{ user_id: "3", user_login: "three", user_name: "Three", followed_at: "2024-03-01T00:00:00Z" }],
        pagination: {},
      },
    ]);

    const payload = await (await GET(connectedRequest())).json();

    expect(payload).toMatchObject({
      connected: true,
      userId: "42",
      total: 3,
      truncated: false,
      followers: [
        { id: "1", login: "one", name: "One", followedAt: "2024-01-01T00:00:00Z" },
        // A missing display name falls back to the login.
        { id: "2", login: "two", name: "two", followedAt: "2024-02-01T00:00:00Z" },
        { id: "3", login: "three", name: "Three", followedAt: "2024-03-01T00:00:00Z" },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("after=next");
  });

  it("reports a missing scope as null when Twitch only returns the total", async () => {
    mockPages([{ total: 120, data: [], pagination: {} }]);

    const payload = await (await GET(connectedRequest())).json();

    expect(payload).toMatchObject({ connected: true, followers: null });
  });

  it("treats an account without followers as an empty list", async () => {
    mockPages([{ total: 0, data: [], pagination: {} }]);

    const payload = await (await GET(connectedRequest())).json();

    expect(payload).toMatchObject({ followers: [], total: 0 });
  });
});
