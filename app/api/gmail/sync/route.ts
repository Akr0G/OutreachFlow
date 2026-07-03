import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { syncGmailReplies } from "@/lib/gmail/reply-sync";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  return syncReplies();
}

export async function POST() {
  return syncReplies();
}

async function syncReplies() {
  const owner = await getOwnerContext();
  const limited = rateLimit(`gmail-sync:${owner.id}`, 10, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many sync attempts." }, { status: 429 });

  try {
    return NextResponse.json(await syncGmailReplies(owner));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reply sync failed." },
      { status: 502 }
    );
  }
}
