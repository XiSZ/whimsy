import { NextRequest, NextResponse } from "next/server";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_OAUTH_REDIRECT_URI = process.env.TWITCH_OAUTH_REDIRECT_URI;

export const runtime = "edge";

function toBase64Url(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) {
    text += String.fromCharCode(bytes[i]);
  }
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signState(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return toBase64Url(new Uint8Array(signature));
}

async function createSignedState(secret: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const issuedAt = Date.now();
  const payload = `${nonce}.${issuedAt}`;
  const signature = await signState(payload, secret);
  return `${payload}.${signature}`;
}

export async function GET(request: NextRequest) {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/?twitch=app_not_configured", request.url),
    );
  }

  const state = await createSignedState(TWITCH_CLIENT_SECRET);
  const redirectUri =
    TWITCH_OAUTH_REDIRECT_URI ??
    new URL("/api/twitch/oauth/callback", request.url).toString();

  const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authUrl.searchParams.set("client_id", TWITCH_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "user:read:follows");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}
