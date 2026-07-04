import { NextRequest, NextResponse } from "next/server";
import { canCreateFollowUpDraft } from "@/lib/business-rules";
import { assertSenderMatchesConnectedMailbox } from "@/lib/email/deliverability";
import { createGmailDraft } from "@/lib/gmail/client";
import { decryptSecret } from "@/lib/security/crypto";
import { getRawSettings, listDrafts, listLeads } from "@/lib/supabase/repository";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { leadTemplateContext, renderTemplate } from "@/lib/email/templates";
import type { AppSettings, EmailDraft, Lead, Template } from "@/lib/types";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (expected && actual !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const [leads, drafts, settings] = await Promise.all([listLeads(), listDrafts(), getRawSettings()]);
    const eligible = leads.filter((lead) =>
      canCreateFollowUpDraft(
        lead,
        drafts.filter((draft) => draft.lead_id === lead.id),
        new Date(),
        settings.follow_up_delay_days
      ).allowed
    );
    return NextResponse.json({
      ok: true,
      eligible_count: eligible.length,
      created_count: 0,
      message: "Demo follow-up check completed."
    });
  }

  const admin = createSupabaseAdminClient();
  const [leadsResult, draftsResult, settingsResult, templatesResult] = await Promise.all([
    admin.from("leads").select("*"),
    admin.from("email_drafts").select("*"),
    admin.from("settings").select("*"),
    admin.from("templates").select("*")
  ]);
  if (leadsResult.error || draftsResult.error || settingsResult.error || templatesResult.error) {
    return NextResponse.json({ error: "Follow-up query failed." }, { status: 500 });
  }

  const leads = leadsResult.data as Lead[];
  const drafts = draftsResult.data as EmailDraft[];
  const settingsRows = settingsResult.data as (AppSettings & { encrypted_gmail_refresh_token?: string | null })[];
  const templates = templatesResult.data as Template[];

  let eligibleCount = 0;
  let createdCount = 0;
  for (const settings of settingsRows) {
    const ownerLeads = leads.filter((lead) => lead.owner_id === settings.owner_id);
    const ownerDrafts = drafts.filter((draft) => draft.owner_id === settings.owner_id);
    const ownerTemplates = templates.filter((template) => template.owner_id === settings.owner_id);
    const eligible = ownerLeads.filter((lead) =>
      canCreateFollowUpDraft(
        lead,
        ownerDrafts.filter((draft) => draft.lead_id === lead.id),
        new Date(),
        settings.follow_up_delay_days
      ).allowed
    );
    eligibleCount += eligible.length;

    for (const lead of eligible) {
    const latestDrafts = drafts.filter((draft) => draft.lead_id === lead.id);
    const stillEligible = canCreateFollowUpDraft(lead, latestDrafts, new Date(), settings.follow_up_delay_days);
    if (!stillEligible.allowed) continue;

    const { subject, body } = buildFollowUpDraft(lead, settings, ownerTemplates);
    let gmail: { draftId: string | null; messageId: string | null; threadId: string | null } = {
      draftId: null,
      messageId: null,
      threadId: lead.gmail_thread_id
    };
    if (settings.encrypted_gmail_refresh_token) {
      assertSenderMatchesConnectedMailbox(settings);
      gmail = await createGmailDraft(decryptSecret(settings.encrypted_gmail_refresh_token), {
        from: settings.sender_email,
        to: lead.email,
        subject,
        body,
        threadId: lead.gmail_thread_id
      });
    }

    const now = new Date().toISOString();
    const { error } = await admin.from("email_drafts").insert({
      owner_id: lead.owner_id,
      lead_id: lead.id,
      draft_type: "follow_up",
      subject,
      body,
      state: "awaiting_review",
      gmail_draft_id: gmail.draftId,
      gmail_message_id: gmail.messageId,
      generated_by: "manual",
      created_at: now,
      updated_at: now
    });
    if (!error) {
      createdCount += 1;
      await admin.from("activities").insert({
        owner_id: lead.owner_id,
        lead_id: lead.id,
        activity_type: "Follow-up created",
        description: "Follow-up draft created",
        metadata: { subject },
        created_at: now
      });
    }
  }
  }

  return NextResponse.json({
    ok: true,
    eligible_count: eligibleCount,
    created_count: createdCount,
    message: "Follow-up drafts were created for review only. No email was sent."
  });
}

function buildFollowUpDraft(lead: Lead, settings: AppSettings, templates: Template[]) {
  const followUpTemplate =
    templates.find((template) => template.template_type === "follow_up")?.content ??
    "Hi {{contact_name}},\n\nJust wanted to follow up on my note about a complimentary homepage mockup for {{business_name}}. If it would be useful, I can send over a simple direction before a short 10-15 minute call. If now is not a fit, no worries.";
  const signature = templates.find((template) => template.template_type === "signature")?.content;
  const context = leadTemplateContext(lead, {
    agency_name: settings.agency_name,
    sender_name: settings.sender_name,
    agency_website: settings.agency_website,
    portfolio_link: settings.portfolio_link,
    calendly_link: settings.calendly_link
  });
  return {
    subject: `Following up on ${lead.business_name}`,
    body: `${renderTemplate(followUpTemplate, context)}${signature ? `\n\n${signature}` : ""}`
  };
}
