export const leadStatuses = [
  "Ready",
  "Draft Created",
  "Sent",
  "Replied",
  "Interested",
  "Not Interested",
  "Unsubscribed",
  "Do Not Contact"
] as const;

export const draftTypes = ["initial", "follow_up"] as const;
export const draftStates = ["awaiting_review", "approved", "sent", "deleted"] as const;
export const generatedByValues = ["ai", "manual"] as const;

export const replyCategories = [
  "Interested",
  "Not Interested",
  "Question",
  "Wrong Contact",
  "Unsubscribe",
  "Other"
] as const;

export const observedWebsiteIssues = [
  "Poor mobile responsiveness",
  "Outdated design",
  "Unclear contact options",
  "Missing calls to action",
  "Slow-loading pages",
  "No website",
  "Other observed issue"
] as const;

export const activityTypes = [
  "Lead created",
  "Lead updated",
  "Draft created",
  "Draft edited",
  "Draft approved",
  "Draft deleted",
  "Email sent",
  "Reply received",
  "Reply classified",
  "Status changed",
  "Follow-up created",
  "Follow-up canceled",
  "Lead marked Do Not Contact"
] as const;

export const templateTypes = ["initial", "follow_up", "signature", "cta"] as const;

export const safeTemplateVariables = [
  "business_name",
  "contact_name",
  "industry",
  "location",
  "website_issue",
  "agency_name",
  "sender_name",
  "agency_website",
  "portfolio_link",
  "calendly_link"
] as const;

export const mandatoryOptOutSentence =
  "If this is not relevant, just reply no thanks and I will not follow up.";

export const stopStatuses = [
  "Interested",
  "Not Interested",
  "Unsubscribed",
  "Do Not Contact"
] as const;

export const statusBadgeClasses: Record<(typeof leadStatuses)[number], string> = {
  Ready: "border-slate-200 bg-slate-50 text-slate-700",
  "Draft Created": "border-amber-200 bg-amber-50 text-amber-800",
  Sent: "border-sky-200 bg-sky-50 text-sky-800",
  Replied: "border-violet-200 bg-violet-50 text-violet-800",
  Interested: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Not Interested": "border-rose-200 bg-rose-50 text-rose-800",
  Unsubscribed: "border-zinc-200 bg-zinc-100 text-zinc-700",
  "Do Not Contact": "border-red-200 bg-red-50 text-red-800"
};
