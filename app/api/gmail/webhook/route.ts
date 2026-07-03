import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { parseGmailPubSubNotification } from "@/lib/gmail/pubsub";
import { syncGmailReplies } from "@/lib/gmail/reply-sync";

export async function POST(request: NextRequest) {
  try {
    const notification = parseGmailPubSubNotification(await request.json());
    const owner = await getOwnerContext();
    const result = await syncGmailReplies(owner);
    return NextResponse.json({ ...result, history_id: notification.historyId });
  } catch {
    return NextResponse.json({ error: "Invalid Pub/Sub notification." }, { status: 400 });
  }
}
