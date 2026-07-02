import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { generateEmailDraftWithOpenAI, resolveOpenAiApiKey } from "@/lib/ai/openai";
import { canCreateFollowUpDraft, canCreateInitialDraft, nextStatusAfterDraftCreated } from "@/lib/business-rules";
import { mandatoryOptOutSentence } from "@/lib/constants";
import { validateInitialEmailDraft } from "@/lib/email/validation";
import { rateLimit } from "@/lib/rate-limit";
import { generateDraftRequestSchema } from "@/lib/schemas";
import { getLeadBundle, getRawSettings, listTemplates } from "@/lib/supabase/repository";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { EmailDraft, GeneratedEmailDraft, Lead } from "@/lib/types";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`ai-draft:${owner.id}`, 10, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many generation requests." }, { status: 429 });

  const parsed = generateDraftRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const [{ lead, drafts }, settings, templates] = await Promise.all([
    getLeadBundle(parsed.data.lead_id),
    getRawSettings(),
    listTemplates()
  ]);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const eligibility =
    parsed.data.draft_type === "initial"
      ? canCreateInitialDraft(lead)
      : canCreateFollowUpDraft(lead, drafts, new Date(), settings.follow_up_delay_days);
  if (!eligibility.allowed) {
    return NextResponse.json({ error: eligibility.reason }, { status: 409 });
  }

  let generated: GeneratedEmailDraft;
  try {
    const apiKey = resolveOpenAiApiKey(settings);
    generated = await generateEmailDraftWithOpenAI(apiKey, {
      lead,
      settings,
      templates,
      draft_type: parsed.data.draft_type
    });
  } catch {
    if (isSupabaseConfigured()) {
      return NextResponse.json({ error: "OpenAI generation failed." }, { status: 502 });
    }
    generated = localDraft(lead, parsed.data.draft_type, settings.sender_name, settings.agency_name);
  }

  const signature = templates.find((template) => template.template_type === "signature")?.content;
  if (parsed.data.draft_type === "initial") {
    const validation = validateInitialEmailDraft(generated, lead, signature);
    if (!validation.valid) {
      return NextResponse.json({ error: "Generated draft failed validation.", details: validation.errors }, { status: 422 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      draft: {
        id: crypto.randomUUID(),
        lead_id: lead.id,
        draft_type: parsed.data.draft_type,
        subject: generated.subject,
        body: generated.body,
        state: "awaiting_review",
        gmail_draft_id: null,
        gmail_message_id: null,
        generated_by: "ai",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sent_at: null
      } satisfies EmailDraft
    });
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data: draft, error } = await supabase
    .from("email_drafts")
    .insert({
      owner_id: owner.id,
      lead_id: lead.id,
      draft_type: parsed.data.draft_type,
      subject: generated.subject,
      body: generated.body,
      state: "awaiting_review",
      generated_by: "ai",
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Draft could not be saved." }, { status: 500 });

  await supabase.from("activities").insert({
    owner_id: owner.id,
    lead_id: lead.id,
    activity_type: parsed.data.draft_type === "initial" ? "Draft created" : "Follow-up created",
    description: parsed.data.draft_type === "initial" ? "Initial draft created" : "Follow-up draft created",
    metadata: { subject: generated.subject },
    created_at: now
  });

  const nextStatus = nextStatusAfterDraftCreated(lead, parsed.data.draft_type);
  if (nextStatus !== lead.status) {
    await supabase.from("leads").update({ status: nextStatus, updated_at: now, last_activity_at: now }).eq("id", lead.id);
  }

  return NextResponse.json({ draft });
}

function localDraft(lead: Lead, type: "initial" | "follow_up", senderName: string, agencyName: string): GeneratedEmailDraft {
  const issue = lead.observed_website_issues[0] ?? lead.issue_details;
  if (type === "follow_up") {
    return {
      subject: `Following up on ${lead.business_name}`,
      body: `Hi ${lead.contact_name ?? "there"},\n\nJust wanted to follow up on my note about a complimentary homepage mockup for ${lead.business_name}. If it would be useful, I can send over a simple direction before a short 10-15 minute call. If now is not a fit, no worries.\n\nBest,\n${senderName}`
    };
  }
  const issueSentence = issue
    ? `I noticed ${lead.business_name} has ${issue.toLowerCase()}.`
    : `I came across ${lead.business_name}.`;
  return {
    subject: `A homepage mockup idea for ${lead.business_name}`,
    body: `Hi ${lead.contact_name ?? "there"},\n\n${issueSentence} I run ${agencyName} and build simple websites for local businesses. I thought a cleaner homepage could make it easier for customers to take the next step. I would be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. ${mandatoryOptOutSentence}\n\nBest,\n${senderName}\n${agencyName}`
  };
}
