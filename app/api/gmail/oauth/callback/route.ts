import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOwnerContext } from "@/lib/auth/owner";
import { createOAuthClient, exchangeGmailCode, renewGmailWatch } from "@/lib/gmail/client";
import { encryptSecret } from "@/lib/security/crypto";
import { getRawSettings } from "@/lib/supabase/repository";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

  try {
    const owner = await getOwnerContext();
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

    const supabase = await createSupabaseWorkspaceClient();
    const settings = await getRawSettings();
    const { error } = await supabase
      .from("settings")
      .upsert({
        sender_name: settings.sender_name,
        sender_email: userinfo.data.email ?? settings.sender_email,
        agency_name: settings.agency_name,
        agency_website: settings.agency_website,
        portfolio_link: settings.portfolio_link,
        calendly_link: settings.calendly_link,
        daily_send_limit: settings.daily_send_limit,
        follow_up_delay_days: settings.follow_up_delay_days,
        encrypted_openai_key_reference: settings.encrypted_openai_key_reference,
        owner_id: owner.id,
        encrypted_gmail_refresh_token: refreshToken,
        gmail_connection_metadata: {
          connected: true,
          email: userinfo.data.email,
          token_last_four: tokens.refresh_token.slice(-4),
          history_id: watch?.historyId,
          watch_expiration: watch?.expiration
        },
        updated_at: new Date().toISOString()
      }, { onConflict: "owner_id" });
    if (error) throw error;
  } catch (error) {
    console.error("Gmail OAuth callback failed", error);
    return NextResponse.redirect(new URL("/settings?gmail=connection-failed", redirectBase));
  }

  return NextResponse.redirect(new URL("/settings?gmail=connected", redirectBase));
}
