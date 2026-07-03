import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { statusForReplyCategory, stopReasonForReplyCategory } from "@/lib/business-rules";
import { replyOverrideSchema } from "@/lib/schemas";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = replyOverrideSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid reply classification." }, { status: 400 });

  const status = statusForReplyCategory(parsed.data.classification);
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      reply: {
        id,
        classification: parsed.data.classification,
        confidence: 1,
        manually_overridden: true,
        explanation: "Manually overridden."
      },
      lead: {
        status,
        stop_reason: stopReasonForReplyCategory(parsed.data.classification),
        last_activity_at: now,
        updated_at: now
      }
    });
  }

  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data: reply, error: replyError } = await supabase
    .from("replies")
    .update({
      classification: parsed.data.classification,
      confidence: 1,
      manually_overridden: true,
      explanation: "Manually overridden."
    })
    .eq("owner_id", owner.id)
    .eq("id", id)
    .select("*")
    .single();

  if (replyError || !reply) {
    return NextResponse.json({ error: "Reply classification could not be saved." }, { status: 500 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .update({
      status,
      stop_reason: stopReasonForReplyCategory(parsed.data.classification),
      last_activity_at: now,
      updated_at: now
    })
    .eq("owner_id", owner.id)
    .eq("id", reply.lead_id)
    .select("*")
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead status could not be updated." }, { status: 500 });
  }

  await supabase.from("activities").insert({
    owner_id: owner.id,
    lead_id: reply.lead_id,
    activity_type: "Reply classified",
    description: `Reply classified as ${parsed.data.classification}`,
    metadata: { manual: true, reply_id: id },
    created_at: now
  });

  return NextResponse.json({ reply, lead });
}
