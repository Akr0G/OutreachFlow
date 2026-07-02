import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { rateLimit } from "@/lib/rate-limit";
import { openAiSecretSchema } from "@/lib/schemas";
import { encryptSecret } from "@/lib/security/crypto";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("settings")
    .update({
      encrypted_openai_key_reference: encrypted,
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", owner.id);

  if (error) {
    return NextResponse.json({ error: "Secret could not be stored." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, masked: `Connected ending in ${parsed.data.api_key.slice(-4)}` });
}
