import { classifyReplyWithOpenAI, resolveOpenAiApiKey } from "@/lib/ai/openai";
import { statusForReplyCategory, stopReasonForReplyCategory } from "@/lib/business-rules";
import { classifyReplyLocally } from "@/lib/email/reply-classification";
import { getGmailThreadMessages, listRecentInboxThreadIds, type GmailThreadMessage } from "@/lib/gmail/client";
import { decryptSecret } from "@/lib/security/crypto";
import { getRawSettings, type RawSettings } from "@/lib/supabase/repository";
import { fetchAllPages } from "@/lib/supabase/pagination";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Lead, ReplyClassification } from "@/lib/types";

export type ReplySyncResult = {
  ok: boolean;
  synced: number;
  checked_threads: number;
  message: string;
};

type ReplySyncOptions = {
  settings?: RawSettings;
  supabase?: Awaited<ReturnType<typeof createSupabaseWorkspaceClient>>;
};

export async function syncGmailReplies(
  owner: { id: string },
  options: ReplySyncOptions = {}
): Promise<ReplySyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      synced: 0,
      checked_threads: 0,
      message: "Demo mode does not sync Gmail replies."
    };
  }

  const settings = options.settings ?? await getRawSettings();
  if (!settings.encrypted_gmail_refresh_token) {
    throw new Error("Gmail is not connected.");
  }

  const refreshToken = decryptSecret(settings.encrypted_gmail_refresh_token);
  const supabase = options.supabase ?? await createSupabaseWorkspaceClient();
  const configuredLookback = Number(process.env.GMAIL_REPLY_LOOKBACK_DAYS ?? 30);
  const recentThreadIds = await listRecentInboxThreadIds(
    refreshToken,
    Number.isFinite(configuredLookback) ? configuredLookback : 30
  );
  const leads: Lead[] = [];

  for (const threadIds of chunks(Array.from(recentThreadIds), 100)) {
    leads.push(...await fetchAllPages<Lead>((from, to) =>
      supabase
        .from("leads")
        .select("*")
        .eq("owner_id", owner.id)
        .in("gmail_thread_id", threadIds)
        .order("last_activity_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ));
  }

  if (!leads.length) {
    return {
      ok: true,
      synced: 0,
      checked_threads: 0,
      message: "No recent inbox messages match sent lead threads."
    };
  }

  const existingReplies: Array<{ gmail_message_id: string }> = [];
  for (const threadIds of chunks(leads.map((lead) => lead.gmail_thread_id).filter(isString), 100)) {
    existingReplies.push(...await fetchAllPages<{ gmail_message_id: string }>((from, to) =>
      supabase
        .from("replies")
        .select("gmail_message_id")
        .eq("owner_id", owner.id)
        .in("gmail_thread_id", threadIds)
        .order("gmail_message_id", { ascending: true })
        .range(from, to)
    ));
  }

  const existingMessageIds = new Set<string>(
    existingReplies.map((reply) => reply.gmail_message_id)
  );
  let synced = 0;

  for (const lead of leads) {
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

      const { data: insertedReplies, error: insertError } = await supabase
        .from("replies")
        .upsert({
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
        }, {
          onConflict: "owner_id,gmail_message_id",
          ignoreDuplicates: true
        })
        .select("id");
      if (insertError) throw insertError;

      existingMessageIds.add(message.id);
      if (!insertedReplies?.length) continue;
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
        maybeCreateNotification(supabase, owner.id, lead, classification, senderEmail, message.body)
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
  supabase: Awaited<ReturnType<typeof createSupabaseWorkspaceClient>>,
  ownerId: string,
  lead: Lead,
  classification: ReplyClassification,
  senderEmail: string,
  body: string
) {
  if (!["Interested", "Question"].includes(classification.category)) return;
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

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function isString(value: string | null): value is string {
  return typeof value === "string";
}
