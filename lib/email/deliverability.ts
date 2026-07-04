import type { AppSettings } from "@/lib/types";

export function assertSenderMatchesConnectedMailbox(
  settings: Pick<AppSettings, "sender_email" | "gmail_connection_metadata">
) {
  const connectedEmail = settings.gmail_connection_metadata?.email?.trim().toLowerCase();
  const senderEmail = settings.sender_email.trim().toLowerCase();

  if (connectedEmail && senderEmail !== connectedEmail) {
    throw new Error(
      `Sender email must match the connected Gmail mailbox (${connectedEmail}). Reconnect the correct mailbox or update Agency Settings.`
    );
  }
}
