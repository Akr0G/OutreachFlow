import { NextRequest, NextResponse } from "next/server";
import { parseGmailPubSubNotification } from "@/lib/gmail/pubsub";

export async function POST(request: NextRequest) {
  try {
    const notification = parseGmailPubSubNotification(await request.json());
    return NextResponse.json({ ok: true, history_id: notification.historyId });
  } catch {
    return NextResponse.json({ error: "Invalid Pub/Sub notification." }, { status: 400 });
  }
}
