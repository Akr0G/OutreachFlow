import { mandatoryOptOutSentence, replyCategories, stopStatuses } from "@/lib/constants";
import type { AppSettings, EmailDraft, Lead, LeadStatus, ReplyCategory } from "@/lib/types";

export type RuleResult = {
  allowed: boolean;
  reason?: string;
};

export function isStopStatus(status: LeadStatus) {
  return stopStatuses.includes(status as (typeof stopStatuses)[number]);
}

export function isReplyCategory(value: string): value is ReplyCategory {
  return replyCategories.includes(value as ReplyCategory);
}

export function canCreateInitialDraft(lead: Lead): RuleResult {
  if (lead.status === "Do Not Contact") return deny("Lead is marked Do Not Contact.");
  if (isStopStatus(lead.status)) return deny(`Lead status ${lead.status} blocks outreach.`);
  if (lead.status !== "Ready") return deny("Initial drafts can only be created for Ready leads.");
  if (!lead.email) return deny("Lead needs a valid email address.");
  return allow();
}

export function canCreateFollowUpDraft(
  lead: Lead,
  drafts: EmailDraft[],
  now = new Date(),
  delayDays = 5
): RuleResult {
  if (!lead.initial_sent_at || lead.status !== "Sent") {
    return deny("Follow-up requires a sent initial email and no reply.");
  }
  if (isStopStatus(lead.status)) return deny(`Lead status ${lead.status} blocks follow-ups.`);
  if (lead.follow_up_count > 0) return deny("This lead already has a follow-up.");
  if (drafts.some((draft) => draft.draft_type === "follow_up" && draft.state !== "deleted")) {
    return deny("A follow-up draft already exists.");
  }

  const sentAt = new Date(lead.initial_sent_at);
  const dueAt = addDays(sentAt, delayDays);
  if (!sameUtcDate(now, dueAt)) {
    return deny(`Follow-up is due on ${dueAt.toISOString().slice(0, 10)}.`);
  }

  return allow();
}

export function canSendDraft(
  lead: Lead,
  draft: EmailDraft,
  settings: Pick<AppSettings, "daily_send_limit">,
  sentTodayCount: number
): RuleResult {
  if (draft.state !== "approved") return deny("Draft must be approved before sending.");
  if (draft.lead_id !== lead.id) return deny("Draft does not belong to this lead.");
  if (lead.status === "Do Not Contact") return deny("Lead is marked Do Not Contact.");
  if (["Not Interested", "Unsubscribed", "Interested"].includes(lead.status)) {
    return deny(`Lead status ${lead.status} blocks sending.`);
  }
  if (sentTodayCount >= settings.daily_send_limit) {
    return deny("Daily sending limit has been reached.");
  }
  if (draft.draft_type === "follow_up") {
    const followUpResult = canSendFollowUp(lead, draft);
    if (!followUpResult.allowed) return followUpResult;
  }
  return allow();
}

export function canSendFollowUp(lead: Lead, draft: EmailDraft): RuleResult {
  if (draft.draft_type !== "follow_up") return allow();
  if (lead.status !== "Sent") return deny("Follow-up can only be sent while the lead remains Sent.");
  if (lead.follow_up_count > 0) return deny("A follow-up has already been sent.");
  return allow();
}

export function nextStatusAfterDraftCreated(lead: Lead, draftType: EmailDraft["draft_type"]): LeadStatus {
  if (draftType === "initial" && lead.status === "Ready") return "Draft Created";
  return lead.status;
}

export function nextStatusAfterSend(draft: Pick<EmailDraft, "draft_type">): LeadStatus {
  return draft.draft_type === "initial" ? "Sent" : "Sent";
}

export function statusForReplyCategory(category: ReplyCategory): LeadStatus {
  switch (category) {
    case "Interested":
      return "Interested";
    case "Not Interested":
      return "Not Interested";
    case "Unsubscribe":
      return "Unsubscribed";
    case "Question":
    case "Wrong Contact":
    case "Other":
      return "Replied";
  }
}

export function stopReasonForReplyCategory(category: ReplyCategory) {
  if (category === "Not Interested") return "Negative reply";
  if (category === "Unsubscribe") return "Unsubscribe request";
  if (category === "Wrong Contact") return "Wrong contact until manually updated";
  return null;
}

export function assertValidStatusTransition(from: LeadStatus, to: LeadStatus): RuleResult {
  if (from === to) return allow();
  if (from === "Do Not Contact") return deny("Do Not Contact leads cannot transition automatically.");
  const allowed: Record<LeadStatus, LeadStatus[]> = {
    Ready: ["Draft Created", "Do Not Contact"],
    "Draft Created": ["Sent", "Ready", "Do Not Contact"],
    Sent: ["Replied", "Interested", "Not Interested", "Unsubscribed", "Do Not Contact"],
    Replied: ["Interested", "Not Interested", "Unsubscribed", "Ready", "Do Not Contact"],
    Interested: ["Replied", "Do Not Contact"],
    "Not Interested": ["Do Not Contact"],
    Unsubscribed: ["Do Not Contact"],
    "Do Not Contact": []
  };
  return allowed[from].includes(to) ? allow() : deny(`Cannot transition from ${from} to ${to}.`);
}

export function hasMandatoryOptOut(body: string) {
  return body.includes(mandatoryOptOutSentence);
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function sameUtcDate(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function allow(): RuleResult {
  return { allowed: true };
}

function deny(reason: string): RuleResult {
  return { allowed: false, reason };
}
