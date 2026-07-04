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
  const email = parsed.data.email.toLowerCase();
  const existingLead = await findExistingLead(supabase, owner.id, email, parsed.data.source_place_id ?? null);
  const leadPayload = existingLead.supportsSourcePlaceId && parsed.data.source_place_id
    ? { ...parsed.data, email }
    : withoutSourcePlaceId({ ...parsed.data, email });

  if (existingLead.error) {
    return NextResponse.json({ error: "Lead lookup failed before import." }, { status: 500 });
  }

  if (existingLead.data) {
    const { error } = await supabase
      .from("leads")
      .update({
        ...mergeableLeadFields(leadPayload),
        updated_at: now,
        last_activity_at: now
      })
      .eq("owner_id", owner.id)
      .eq("id", existingLead.data.id);

    if (error) {
      return NextResponse.json({ error: "Existing lead could not be updated." }, { status: 500 });
    }

    await supabase.from("activities").insert({
      owner_id: owner.id,
      lead_id: existingLead.data.id,
      activity_type: "Lead updated",
      description: `${parsed.data.business_name} updated from safe research`,
      metadata: { source: "research" },
      created_at: now
    });

    return NextResponse.json({ ok: true, lead_id: existingLead.data.id, message: "Existing lead updated from research." });
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...leadPayload,
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

async function findExistingLead(
  supabase: Awaited<ReturnType<typeof createSupabaseWorkspaceClient>>,
  ownerId: string,
  email: string,
  sourcePlaceId: string | null
) {
  let supportsSourcePlaceId = true;

  if (sourcePlaceId) {
    const byPlace = await supabase
      .from("leads")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("source_place_id", sourcePlaceId)
      .maybeSingle();
    if (byPlace.error) {
      if (!isMissingSourcePlaceColumn(byPlace.error)) return { ...byPlace, supportsSourcePlaceId };
      supportsSourcePlaceId = false;
    } else if (byPlace.data) {
      return { ...byPlace, supportsSourcePlaceId };
    }
  }

  const byEmail = await supabase
    .from("leads")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("email", email)
    .maybeSingle();
  return { ...byEmail, supportsSourcePlaceId };
}

function mergeableLeadFields(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) =>
      value !== null &&
      value !== "" &&
      value !== undefined
    )
  );
}

function withoutSourcePlaceId<T extends Record<string, unknown>>(row: T) {
  const { source_place_id: _sourcePlaceId, ...rest } = row;
  return rest;
}

function isMissingSourcePlaceColumn(error: { code?: string; message?: string }) {
  return error.code === "42703" || error.message?.includes("source_place_id");
}
