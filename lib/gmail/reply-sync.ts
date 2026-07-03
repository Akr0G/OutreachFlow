import { classifyReplyWithOpenAI, resolveOpenAiApiKey } from "@/lib/ai/openai";
import { statusForReplyCategory, stopReasonForReplyCategory } from "@/lib/business-rules";
import { classifyReplyLocally } from "@/lib/email/reply-classification";
import { getGmailThreadMessages, type GmailThreadMessage } from "@/lib/gmail/client";
import { decryptSecret } from "@/lib/security/crypto";
import { getRawSettings, type RawSettings } from "@/lib/supabase/repository";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Lead, ReplyClassification } from "@/lib/types";

export type ReplySyncResult = {
  ok: boolean;
  synced: number;
  checked_threads: number;
  message: string;
};

export async function syncGmailReplies(owner: { id: string }): Promise<ReplySyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      synced: 0,
      checked_threads: 0,
      message: "Demo mode does not sync Gmail replies."
    };
  }

  const settings = await getRawSettings();
  if (!settings.encrypted_gmail_refresh_token) {
    throw new Error("Gmail is not connected.");
  }

  const refreshToken = decryptSecret(settings.encrypted_gmail_refresh_token);
  const supabase = await createSupabaseWorkspaceClient();
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .eq("owner_id", owner.id)
    .not("gmail_thread_id", "is", null)
    .order("last_activity_at", { ascending: false })
    .limit(100);

  if (leadsError) throw leadsError;
  if (!leads?.length) {
    return {
      ok: true,
      synced: 0,
      checked_threads: 0,
      message: "No sent Gmail threads are attached to leads yet."
    };
  }

  const { data: existingReplies, error: repliesError } = await supabase
    .from("replies")
    .select("gmail_message_id")
    .eq("owner_id", owner.id);
  if (repliesError) throw repliesError;

  const existingMessageIds = new Set<string>(
    ((existingReplies ?? []) as Array<{ gmail_message_id: string }>).map((reply) => reply.gmail_message_id)
  );
  let synced = 0;

  for (const lead of leads as Lead[]) {
    if (!lead.gmail_thread_id) continue;
    const messages = await getGmailThreadMessages(refreshToken, lead.gmail_thread_id);
    for (const message of messages) {
      if (!shouldImportMessage(message, lead, settings, existingMessageIds)) continue;

      const classification = await classifyReply(message.body, message.from ?? lead.email, lead, settings);
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString();
      const now = new Date().toISOString();
      const senderEmail = extractEmailAddress(message.from) ?? message.from ?? lead.email;

      const { error: insertError } = await supabase.from("replies").insert({
        owner_id: owner.id,
        lead_id: lead.id,
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
        sender_email: senderEmail,
        received_at: receivedAt,
        body: cleanReplyBody(message.body),
        classification: classification.category,
        confidence: classification.confidence,
        explanation: classification.explanation,
        manually_overridden: false,
        created_at: now
      });
      if (insertError) throw insertError;

      existingMessageIds.add(message.id);
      synced += 1;

      await Promise.all([
        supabase.from("leads").update({
          status: statusForReplyCategory(classification.category),
          stop_reason: stopReasonForReplyCategory(classification.category),
          last_activity_at: receivedAt,
          updated_at: now
        }).eq("owner_id", owner.id).eq("id", lead.id),
        supabase.from("activities").insert([
          {
            owner_id: owner.id,
            lead_id: lead.id,
            activity_type: "Reply received",
            description: `Reply received from ${senderEmail}`,
            metadata: { gmail_message_id: message.id, subject: message.subject },
            created_at: receivedAt
          },
          {
            owner_id: owner.id,
            lead_id: lead.id,
            activity_type: "Reply classified",
            description: `Reply classified as ${classification.category}`,
            metadata: { confidence: classification.confidence, explanation: classification.explanation },
            created_at: now
          }
        ]),
        maybeCreateNotification(owner.id, lead, classification, senderEmail, message.body)
      ]);
    }
  }

  return {
    ok: true,
    synced,
    checked_threads: leads.length,
    message: synced ? `Synced ${synced} new Gmail repl${synced === 1 ? "y" : "ies"}.` : "No new Gmail replies found."
  };
}

function shouldImportMessage(
  message: GmailThreadMessage,
  lead: Lead,
  settings: RawSettings,
  existingMessageIds: Set<string>
) {
  if (existingMessageIds.has(message.id)) return false;
  if (!message.body.trim()) return false;
  if (message.labelIds.includes("SENT")) return false;
  if (!message.labelIds.includes("INBOX")) return false;

  const senderEmail = extractEmailAddress(message.from);
  if (senderEmail && senderEmail.toLowerCase() === settings.sender_email.toLowerCase()) return false;

  if (lead.initial_sent_at && message.internalDate) {
    return Number(message.internalDate) >= new Date(lead.initial_sent_at).getTime();
  }

  return true;
}

async function classifyReply(
  body: string,
  senderEmail: string,
  lead: Lead,
  settings: RawSettings
): Promise<ReplyClassification> {
  try {
    const apiKey = resolveOpenAiApiKey(settings);
    return await classifyReplyWithOpenAI(apiKey, {
      lead,
      reply_body: body,
      sender_email: senderEmail
    });
  } catch {
    return classifyReplyLocally(body);
  }
}

async function maybeCreateNotification(
  ownerId: string,
  lead: Lead,
  classification: ReplyClassification,
  senderEmail: string,
  body: string
) {
  if (!["Interested", "Question"].includes(classification.category)) return;
  const supabase = await createSupabaseWorkspaceClient();
  await supabase.from("notifications").insert({
    owner_id: ownerId,
    type: classification.category === "Interested" ? "interested_reply" : "reply_needs_review",
    lead_id: lead.id,
    title: `${classification.category} reply from ${lead.business_name}`,
    message: `${senderEmail}: ${cleanReplyBody(body).slice(0, 180)}`,
    created_at: new Date().toISOString()
  });
}

function extractEmailAddress(value?: string | null) {
  if (!value) return null;
  const angleMatch = value.match(/<([^>]+)>/);
  const email = angleMatch?.[1] ?? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return email?.trim() ?? null;
}

function cleanReplyBody(body: string) {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\nOn .+ wrote:\n/i)[0]
    .split(/\n-{2,}Original Message-{2,}\n/i)[0]
    .trim()
    .slice(0, 20_000);
}
