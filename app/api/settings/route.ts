import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { rateLimit } from "@/lib/rate-limit";
import { settingsSchema } from "@/lib/schemas";
import { getRawSettings } from "@/lib/supabase/repository";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`settings-save:${owner.id}`, 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many settings saves." }, { status: 429 });

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the highlighted settings.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, settings: parsed.data, demo: true });
  }

  const current = await getRawSettings();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase
    .from("settings")
    .upsert(
      {
        ...parsed.data,
        owner_id: owner.id,
        encrypted_openai_key_reference: current.encrypted_openai_key_reference,
        encrypted_gmail_refresh_token: current.encrypted_gmail_refresh_token,
        gmail_connection_metadata: current.gmail_connection_metadata ?? { connected: false },
        updated_at: new Date().toISOString()
      },
      { onConflict: "owner_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Settings could not be saved." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings: {
      ...data,
      encrypted_openai_key_reference: data.encrypted_openai_key_reference ? "connected" : null,
      gmail_connection_metadata: data.gmail_connection_metadata
    }
  });
}
