import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
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

  return NextResponse.json({
    ok: true,
    synced: 0,
    message: "Reply sync endpoint is ready. Configure Gmail watch and stored history IDs to process mailbox changes."
  });
}
