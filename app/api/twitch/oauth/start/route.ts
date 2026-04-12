import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const OAUTH_STATE_COOKIE = "twitch_oauth_state";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!TWITCH_CLIENT_ID) {
    return NextResponse.redirect(
      new URL("/?twitch=app_not_configured", request.url),
    );
  }

  const state = randomUUID();
  const redirectUri = new URL(
    "/api/twitch/oauth/callback",
    request.url,
  ).toString();

  const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authUrl.searchParams.set("client_id", TWITCH_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "user:read:follows");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
