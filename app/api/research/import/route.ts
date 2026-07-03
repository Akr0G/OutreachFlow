import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { rateLimit } from "@/lib/rate-limit";
import { researchImportSchema } from "@/lib/schemas";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`research-import:${owner.id}`, 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many import attempts." }, { status: 429 });

  const parsed = researchImportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Candidate needs verified lead details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      lead_id: crypto.randomUUID(),
      message: "Candidate validated as a lead in demo mode. Connect Supabase to save it."
    });
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...parsed.data,
      owner_id: owner.id,
      status: "Ready",
      follow_up_count: 0,
      last_activity_at: now,
      created_at: now,
      updated_at: now
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Lead could not be saved. It may already exist." }, { status: 409 });
  }

  await supabase.from("activities").insert({
    owner_id: owner.id,
    lead_id: data.id,
    activity_type: "Lead created",
    description: `${parsed.data.business_name} added from safe research`,
    metadata: { source: "research" },
    created_at: now
  });

  return NextResponse.json({ ok: true, lead_id: data.id, message: "Lead added for draft review." });
}
