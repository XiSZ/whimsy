import { NextResponse } from "next/server";

const COOKIE_ACCESS_TOKEN = "twitch_access_token";
const COOKIE_REFRESH_TOKEN = "twitch_refresh_token";
const COOKIE_USER_ID = "twitch_user_id";
const COOKIE_USER_LOGIN = "twitch_user_login";
const COOKIE_EXPIRES_AT = "twitch_access_expires_at";
const OAUTH_STATE_COOKIE = "twitch_oauth_state";

export const runtime = "edge";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete(COOKIE_ACCESS_TOKEN);
  response.cookies.delete(COOKIE_REFRESH_TOKEN);
  response.cookies.delete(COOKIE_USER_ID);
  response.cookies.delete(COOKIE_USER_LOGIN);
  response.cookies.delete(COOKIE_EXPIRES_AT);
  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}
