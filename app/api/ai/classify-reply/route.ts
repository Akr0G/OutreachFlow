import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { classifyReplyWithOpenAI, resolveOpenAiApiKey } from "@/lib/ai/openai";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReplyRequestSchema } from "@/lib/schemas";
import { getLead, getRawSettings } from "@/lib/supabase/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { ReplyClassification } from "@/lib/types";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`ai-classify:${owner.id}`, 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many classification requests." }, { status: 429 });

  const parsed = classifyReplyRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const [lead, settings] = await Promise.all([getLead(parsed.data.lead_id), getRawSettings()]);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  try {
    const apiKey = resolveOpenAiApiKey(settings);
    const classification = await classifyReplyWithOpenAI(apiKey, {
      lead,
      reply_body: parsed.data.reply_body,
      sender_email: parsed.data.sender_email
    });
    return NextResponse.json({ classification });
  } catch {
    if (isSupabaseConfigured()) {
      return NextResponse.json({ error: "Reply classification failed." }, { status: 502 });
    }
    return NextResponse.json({ classification: localClassification(parsed.data.reply_body) });
  }
}

function localClassification(body: string): ReplyClassification {
  const normalized = body.toLowerCase();
  if (/unsubscribe|remove me|do not contact|don't contact/.test(normalized)) {
    return { category: "Unsubscribe", confidence: 0.9, explanation: "The reply asks to stop contact." };
  }
  if (/not interested|no thanks|not a fit/.test(normalized)) {
    return { category: "Not Interested", confidence: 0.82, explanation: "The reply declines the offer." };
  }
  if (/who should|wrong person|contact .* instead/.test(normalized)) {
    return { category: "Wrong Contact", confidence: 0.75, explanation: "The reply points to another contact." };
  }
  if (/\?|how much|examples|available/.test(normalized)) {
    return { category: "Question", confidence: 0.66, explanation: "The reply asks a question and needs review." };
  }
  if (/interested|sounds good|let's|yes/.test(normalized)) {
    return { category: "Interested", confidence: 0.84, explanation: "The reply expresses positive interest." };
  }
  return { category: "Other", confidence: 0.5, explanation: "No clear intent was detected." };
}
