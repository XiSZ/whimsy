import { NextRequest, NextResponse } from "next/server";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_OAUTH_REDIRECT_URI = process.env.TWITCH_OAUTH_REDIRECT_URI;

export const runtime = "edge";

function maskClientId(value?: string): string | null {
  if (!value) return null;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const effectiveRedirectUri =
    TWITCH_OAUTH_REDIRECT_URI ??
    new URL("/api/twitch/oauth/callback", request.url).toString();

  const payload = {
    ok: true,
    configured: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET),
    hasClientId: Boolean(TWITCH_CLIENT_ID),
    hasClientSecret: Boolean(TWITCH_CLIENT_SECRET),
    clientIdMasked: maskClientId(TWITCH_CLIENT_ID),
    redirectUriFromEnv: TWITCH_OAUTH_REDIRECT_URI ?? null,
    redirectUriEffective: effectiveRedirectUri,
    expectedProductionRedirectUri:
      "https://xisz.pages.dev/api/twitch/oauth/callback",
    hints: [
      "Ensure redirectUriEffective is listed exactly in Twitch app OAuth Redirect URLs.",
      "Ensure TWITCH_CLIENT_SECRET is set in Cloudflare Pages Production environment.",
      "Redeploy after changing environment variables.",
    ],
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
