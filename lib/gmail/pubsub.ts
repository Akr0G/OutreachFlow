export type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

export function parseGmailPubSubNotification(body: PubSubPushBody) {
  const data = body.message?.data;
  if (!data) throw new Error("Pub/Sub notification is missing message.data.");
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const parsed = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as {
    emailAddress: string;
    historyId: string;
  };
  return {
    emailAddress: parsed.emailAddress,
    historyId: parsed.historyId,
    messageId: body.message?.messageId ?? null,
    publishTime: body.message?.publishTime ?? null
  };
}
