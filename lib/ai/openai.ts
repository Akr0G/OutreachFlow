import OpenAI from "openai";
import { emailDraftJsonSchema, emailGenerationSystemPrompt, replyClassificationJsonSchema, replyClassificationSystemPrompt } from "@/lib/ai/prompts";
import { replyClassificationSchema } from "@/lib/schemas";
import { decryptSecret } from "@/lib/security/crypto";
import type { AppSettings, GeneratedEmailDraft, Lead, ReplyClassification, Template } from "@/lib/types";

type DraftPayload = {
  lead: Lead;
  settings: AppSettings;
  templates: Template[];
  draft_type: "initial" | "follow_up";
};

export async function generateEmailDraftWithOpenAI(apiKey: string, payload: DraftPayload): Promise<GeneratedEmailDraft> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: emailGenerationSystemPrompt
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "outreach_email_draft",
        schema: emailDraftJsonSchema,
        strict: true
      }
    }
  } as never);

  const parsed = parseJsonOutput<GeneratedEmailDraft>(response);
  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim()
  };
}

export async function classifyReplyWithOpenAI(
  apiKey: string,
  payload: { lead: Pick<Lead, "id" | "business_name" | "status" | "gmail_thread_id">; reply_body: string; sender_email: string }
): Promise<ReplyClassification> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: replyClassificationSystemPrompt
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "reply_classification",
        schema: replyClassificationJsonSchema,
        strict: true
      }
    }
  } as never);

  return replyClassificationSchema.parse(parseJsonOutput<ReplyClassification>(response));
}

export function resolveOpenAiApiKey(settings?: Pick<AppSettings, "encrypted_openai_key_reference"> | null) {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (settings?.encrypted_openai_key_reference && settings.encrypted_openai_key_reference !== "connected") {
    return decryptSecret(settings.encrypted_openai_key_reference);
  }
  throw new Error("OpenAI is not connected.");
}

function parseJsonOutput<T>(response: { output_text?: string }) {
  if (!response.output_text) {
    throw new Error("OpenAI returned an empty response.");
  }
  return JSON.parse(response.output_text) as T;
}
