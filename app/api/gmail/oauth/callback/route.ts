import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOwnerContext } from "@/lib/auth/owner";
import { createOAuthClient, exchangeGmailCode, renewGmailWatch } from "@/lib/gmail/client";
import { encryptSecret } from "@/lib/security/crypto";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const owner = await getOwnerContext();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.cookies.get("gmail_oauth_state")?.value;
  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/settings?gmail=invalid-state", redirectBase));
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/settings?gmail=demo-connected", redirectBase));
  }

  const tokens = await exchangeGmailCode(code);
  if (!tokens.refresh_token) {
    return NextResponse.redirect(new URL("/settings?gmail=missing-refresh-token", redirectBase));
  }

  const oauth = createOAuthClient();
  oauth.setCredentials(tokens);
  const userinfo = await google.oauth2({ version: "v2", auth: oauth }).userinfo.get();
  const refreshToken = encryptSecret(tokens.refresh_token);
  let watch: { historyId: string | null; expiration: string | null } | null = null;
  try {
    watch = await renewGmailWatch(tokens.refresh_token);
  } catch {
    watch = null;
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("settings")
    .update({
      encrypted_gmail_refresh_token: refreshToken,
      gmail_connection_metadata: {
        connected: true,
        email: userinfo.data.email,
        token_last_four: tokens.refresh_token.slice(-4),
        history_id: watch?.historyId,
        watch_expiration: watch?.expiration
      },
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", owner.id);

  return NextResponse.redirect(new URL("/settings?gmail=connected", redirectBase));
}
