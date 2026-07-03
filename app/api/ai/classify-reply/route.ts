import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { classifyReplyWithOpenAI, resolveOpenAiApiKey } from "@/lib/ai/openai";
import { classifyReplyLocally } from "@/lib/email/reply-classification";
import { rateLimit } from "@/lib/rate-limit";
import { classifyReplyRequestSchema } from "@/lib/schemas";
import { getLead, getRawSettings } from "@/lib/supabase/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

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
    return NextResponse.json({ classification: classifyReplyLocally(parsed.data.reply_body) });
  }
}
