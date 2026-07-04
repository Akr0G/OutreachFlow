import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { assertSenderMatchesConnectedMailbox } from "@/lib/email/deliverability";
import { createGmailDraft, updateGmailDraft } from "@/lib/gmail/client";
import { rateLimit } from "@/lib/rate-limit";
import { draftInputSchema } from "@/lib/schemas";
import { decryptSecret } from "@/lib/security/crypto";
import { getLead, getRawSettings } from "@/lib/supabase/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`gmail-draft:${owner.id}`, 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many Gmail draft requests." }, { status: 429 });

  const parsed = draftInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft payload." }, { status: 400 });
  const [lead, settings] = await Promise.all([getLead(parsed.data.lead_id), getRawSettings()]);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ gmail_draft_id: `demo-draft-${crypto.randomUUID()}`, gmail_message_id: null });
  }
  if (!settings.encrypted_gmail_refresh_token) {
    return NextResponse.json({ error: "Gmail is not connected." }, { status: 409 });
  }
  try {
    assertSenderMatchesConnectedMailbox(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sender email does not match Gmail." },
      { status: 409 }
    );
  }

  const refreshToken = decryptSecret(settings.encrypted_gmail_refresh_token);
  const input = {
    from: settings.sender_email,
    to: lead.email,
    subject: parsed.data.subject,
    body: parsed.data.body,
    threadId: lead.gmail_thread_id
  };
  const result = parsed.data.gmail_draft_id
    ? await updateGmailDraft(refreshToken, parsed.data.gmail_draft_id, input)
    : await createGmailDraft(refreshToken, input);

  return NextResponse.json(result);
}
