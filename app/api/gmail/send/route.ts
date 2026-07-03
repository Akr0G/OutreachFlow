import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { canSendDraft } from "@/lib/business-rules";
import { sendGmailDraft } from "@/lib/gmail/client";
import { rateLimit } from "@/lib/rate-limit";
import { sendDraftSchema } from "@/lib/schemas";
import { decryptSecret } from "@/lib/security/crypto";
import { getRawSettings } from "@/lib/supabase/repository";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { EmailDraft, Lead } from "@/lib/types";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`gmail-send:${owner.id}`, 20, 24 * 60 * 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Daily sending safeguard reached." }, { status: 429 });

  const parsed = sendDraftSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Final confirmation is required." }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, gmail_message_id: `demo-sent-${crypto.randomUUID()}` });
  }

  const supabase = await createSupabaseWorkspaceClient();
  const settings = await getRawSettings();
  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("owner_id", owner.id)
    .eq("id", parsed.data.draft_id)
    .single();
  if (draftError || !draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("owner_id", owner.id).eq("id", draft.lead_id).single();
  if (leadError || !lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("email_drafts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .eq("state", "sent")
    .gte("sent_at", `${today}T00:00:00.000Z`);

  const sendCheck = canSendDraft(lead as Lead, draft as EmailDraft, settings, count ?? 0);
  if (!sendCheck.allowed) return NextResponse.json({ error: sendCheck.reason }, { status: 409 });
  if (!settings.encrypted_gmail_refresh_token || !draft.gmail_draft_id) {
    return NextResponse.json({ error: "Gmail draft is not ready." }, { status: 409 });
  }

  const result = await sendGmailDraft(decryptSecret(settings.encrypted_gmail_refresh_token), draft.gmail_draft_id);
  const now = new Date().toISOString();
  await supabase
    .from("email_drafts")
    .update({ state: "sent", sent_at: now, gmail_message_id: result.messageId, updated_at: now })
    .eq("owner_id", owner.id)
    .eq("id", draft.id);
  await supabase
    .from("leads")
    .update({
      status: "Sent",
      date_contacted: lead.date_contacted ?? now.slice(0, 10),
      initial_sent_at: draft.draft_type === "initial" ? now : lead.initial_sent_at,
      follow_up_count: draft.draft_type === "follow_up" ? 1 : lead.follow_up_count,
      gmail_thread_id: result.threadId ?? lead.gmail_thread_id,
      last_activity_at: now,
      updated_at: now
    })
    .eq("owner_id", owner.id)
    .eq("id", lead.id);
  await supabase.from("activities").insert({
    owner_id: owner.id,
    lead_id: lead.id,
    activity_type: "Email sent",
    description: draft.draft_type === "initial" ? "Initial email sent" : "Follow-up email sent",
    metadata: { subject: draft.subject },
    created_at: now
  });

  return NextResponse.json({ ok: true, ...result });
}
