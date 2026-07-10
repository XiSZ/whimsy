import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_EXPIRES_AT,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_ID,
  applyRefreshedAuthCookies,
  resolveAuthState,
} from "./twitchAuth";

function requestWithCookies(cookies: Record<string, string>, url = "https://example.com/api/twitch/following") {
  const cookie = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  return new NextRequest(url, { headers: { cookie } });
}

describe("resolveAuthState", () => {
  it("returns valid unexpired cookie auth as-is", async () => {
    const { auth, updatedCookieAuth } = await resolveAuthState(
      requestWithCookies({
        [COOKIE_ACCESS_TOKEN]: "token",
        [COOKIE_USER_ID]: "42",
        [COOKIE_EXPIRES_AT]: String(Date.now() + 60_000),
      }),
    );

    expect(auth).toMatchObject({
      accessToken: "token",
      userId: "42",
      source: "cookie",
    });
    expect(updatedCookieAuth).toBeNull();
  });

  it("rejects an expired cookie token with no refresh token instead of falling through", async () => {
    const { auth, updatedCookieAuth } = await resolveAuthState(
      requestWithCookies({
        [COOKIE_ACCESS_TOKEN]: "stale",
        [COOKIE_USER_ID]: "42",
        [COOKIE_EXPIRES_AT]: "1",
      }),
    );

    expect(auth).toBeNull();
    expect(updatedCookieAuth).toBeNull();
  });
});

describe("applyRefreshedAuthCookies", () => {
  const refreshed = {
    accessToken: "new-token",
    refreshToken: "new-refresh",
    expiresAt: 1_700_000_000_000,
  };
  const cookieAuth = {
    accessToken: "new-token",
    userId: "42",
    source: "cookie" as const,
  };

  it("writes httpOnly, secure cookies after a refresh over https", () => {
    const request = requestWithCookies({});
    const response = NextResponse.json({});

    applyRefreshedAuthCookies(response, request, cookieAuth, refreshed);

    const access = response.cookies.get(COOKIE_ACCESS_TOKEN);
    expect(access?.value).toBe("new-token");
    expect(access?.httpOnly).toBe(true);
    expect(access?.secure).toBe(true);
    expect(response.cookies.get(COOKIE_REFRESH_TOKEN)?.value).toBe(
      "new-refresh",
    );
    expect(response.cookies.get(COOKIE_USER_ID)?.value).toBe("42");
  });

  it("writes nothing for env-sourced auth", () => {
    const response = NextResponse.json({});

    applyRefreshedAuthCookies(
      response,
      requestWithCookies({}),
      { ...cookieAuth, source: "env" },
      refreshed,
    );

    expect(response.cookies.get(COOKIE_ACCESS_TOKEN)).toBeUndefined();
  });
});
