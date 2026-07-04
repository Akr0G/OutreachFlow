import { google } from "googleapis";

export type GmailDraftInput = {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
};

export function createOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth environment variables are not configured.");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getGmailAuthorizationUrl(state: string) {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  });
}

export async function exchangeGmailCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function gmailClientFromRefreshToken(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: client });
}

export async function createGmailDraft(refreshToken: string, input: GmailDraftInput) {
  const gmail = gmailClientFromRefreshToken(refreshToken);
  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: createMimeMessage(input),
        threadId: input.threadId ?? undefined
      }
    }
  });
  return {
    draftId: response.data.id ?? null,
    messageId: response.data.message?.id ?? null,
    threadId: response.data.message?.threadId ?? null
  };
}

export async function updateGmailDraft(refreshToken: string, draftId: string, input: GmailDraftInput) {
  const gmail = gmailClientFromRefreshToken(refreshToken);
  const response = await gmail.users.drafts.update({
    userId: "me",
    id: draftId,
    requestBody: {
      id: draftId,
      message: {
        raw: createMimeMessage(input),
        threadId: input.threadId ?? undefined
      }
    }
  });
  return {
    draftId: response.data.id ?? draftId,
    messageId: response.data.message?.id ?? null,
    threadId: response.data.message?.threadId ?? null
  };
}

export async function deleteGmailDraft(refreshToken: string, draftId: string) {
  const gmail = gmailClientFromRefreshToken(refreshToken);
  await gmail.users.drafts.delete({ userId: "me", id: draftId });
}

export async function sendGmailDraft(refreshToken: string, draftId: string) {
  const gmail = gmailClientFromRefreshToken(refreshToken);
  const response = await gmail.users.drafts.send({
    userId: "me",
    requestBody: {
      id: draftId
    }
  });
  return {
    messageId: response.data.id ?? null,
    threadId: response.data.threadId ?? null
  };
}

export async function renewGmailWatch(refreshToken: string) {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) throw new Error("GOOGLE_PUBSUB_TOPIC is not configured.");
  const gmail = gmailClientFromRefreshToken(refreshToken);
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE"
    }
  });
  return {
    historyId: response.data.historyId ?? null,
    expiration: response.data.expiration ?? null
  };
}

export type GmailThreadMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  internalDate: string | null;
  from: string | null;
  subject: string | null;
  snippet: string | null;
  body: string;
};

export async function listRecentInboxThreadIds(refreshToken: string, newerThanDays = 30) {
  const gmail = gmailClientFromRefreshToken(refreshToken);
  const days = Math.min(365, Math.max(1, Math.floor(newerThanDays)));
  const threadIds = new Set<string>();
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `in:inbox newer_than:${days}d`,
      includeSpamTrash: false,
      maxResults: 500,
      pageToken
    });
    for (const message of response.data.messages ?? []) {
      if (message.threadId) threadIds.add(message.threadId);
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return threadIds;
}

export async function getGmailThreadMessages(refreshToken: string, threadId: string): Promise<GmailThreadMessage[]> {
  const gmail = gmailClientFromRefreshToken(refreshToken);
  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full"
  });

  return (response.data.messages ?? [])
    .filter((message) => message.id && message.threadId)
    .map((message) => ({
      id: message.id!,
      threadId: message.threadId!,
      labelIds: message.labelIds ?? [],
      internalDate: message.internalDate ?? null,
      from: getHeader(message.payload?.headers, "From"),
      subject: getHeader(message.payload?.headers, "Subject"),
      snippet: message.snippet ?? null,
      body: extractPlainTextBody(message.payload) || message.snippet || ""
    }));
}

export function createMimeMessage(input: GmailDraftInput) {
  const to = safeHeaderValue(input.to, "To");
  const from = safeHeaderValue(input.from, "From");
  const subject = safeHeaderValue(input.subject, "Subject");
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    `List-Unsubscribe: <mailto:${from}?subject=Unsubscribe>`
  ];
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.body}`, "utf8").toString("base64url");
}

function safeHeaderValue(value: string, header: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${header} contains invalid header characters.`);
  }
  return value.trim();
}

function encodeSubject(subject: string) {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function extractPlainTextBody(payload: unknown): string {
  const part = payload as {
    mimeType?: string | null;
    body?: { data?: string | null };
    parts?: unknown[];
  } | null;
  if (!part) return "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data).trim();
  }

  for (const child of part.parts ?? []) {
    const text = extractPlainTextBody(child);
    if (text) return text;
  }

  if (part.body?.data) {
    return decodeBase64Url(part.body.data).trim();
  }

  return "";
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
