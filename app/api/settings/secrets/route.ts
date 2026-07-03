import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { rateLimit } from "@/lib/rate-limit";
import { openAiSecretSchema } from "@/lib/schemas";
import { encryptSecret } from "@/lib/security/crypto";
import { getRawSettings } from "@/lib/supabase/repository";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`openai-secret:${owner.id}`, 5, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const parsed = openAiSecretSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, masked: `Connected ending in ${parsed.data.api_key.slice(-4)}` });
  }

  const encrypted = encryptSecret(parsed.data.api_key);
  const supabase = await createSupabaseWorkspaceClient();
  const settings = await getRawSettings();
  const { error } = await supabase
    .from("settings")
    .upsert({
      sender_name: settings.sender_name,
      sender_email: settings.sender_email,
      agency_name: settings.agency_name,
      agency_website: settings.agency_website,
      portfolio_link: settings.portfolio_link,
      calendly_link: settings.calendly_link,
      daily_send_limit: settings.daily_send_limit,
      follow_up_delay_days: settings.follow_up_delay_days,
      owner_id: owner.id,
      encrypted_openai_key_reference: encrypted,
      encrypted_gmail_refresh_token: settings.encrypted_gmail_refresh_token,
      gmail_connection_metadata: settings.gmail_connection_metadata ?? { connected: false },
      updated_at: new Date().toISOString()
    }, { onConflict: "owner_id" });

  if (error) {
    return NextResponse.json({ error: "Secret could not be stored." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, masked: `Connected ending in ${parsed.data.api_key.slice(-4)}` });
}
