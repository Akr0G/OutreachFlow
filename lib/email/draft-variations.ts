import { mandatoryOptOutSentence } from "@/lib/constants";
import type { AppSettings, GeneratedEmailDraft, Lead, ObservedWebsiteIssue } from "@/lib/types";

export type DraftVariation = {
  key: string;
  subjectTone: string;
  openingAngle: string;
  ctaAngle: string;
};

export const draftVariations: DraftVariation[] = [
  {
    key: "mockup-first",
    subjectTone: "complimentary homepage mockup",
    openingAngle: "practical and direct",
    ctaAngle: "short call in exchange for a mockup"
  },
  {
    key: "customer-path",
    subjectTone: "making the next step clearer",
    openingAngle: "focused on customer clarity",
    ctaAngle: "simple direction before a short call"
  },
  {
    key: "local-owner",
    subjectTone: "local website idea",
    openingAngle: "neighborly and concise",
    ctaAngle: "low-pressure mockup offer"
  }
];

export function pickDraftVariation(seed = crypto.randomUUID()) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return draftVariations[total % draftVariations.length];
}

export function buildLocalDraft(
  lead: Lead,
  type: "initial" | "follow_up",
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "portfolio_link" | "calendly_link">,
  variation = pickDraftVariation()
): GeneratedEmailDraft {
  if (type === "follow_up") return buildFollowUpDraft(lead, settings, variation);
  return buildInitialDraft(lead, settings, variation);
}

function buildInitialDraft(
  lead: Lead,
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "portfolio_link" | "calendly_link">,
  variation: DraftVariation
): GeneratedEmailDraft {
  const issue = lead.observed_website_issues[0] ?? lead.issue_details;
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : `Hi ${lead.business_name} Team,`;
  const praise = buildPraiseLine(lead);
  const opportunity = buildOpportunityLine(issue);
  const conceptTarget = shortBusinessName(lead.business_name);
  const introduction = `My friend Mhamed and I run ${settings.agency_name}, helping make websites clearer and easier to navigate.`;
  const signature = buildSignature(settings);

  if (variation.key === "customer-path") {
    return {
      subject: `A few website ideas for ${lead.business_name}`,
      body: `${greeting}\n\n${praise} ${opportunity} ${introduction} We would love to create a complimentary homepage or "Start Here" concept tailored to ${conceptTarget}. Would you be open to seeing a few ideas? ${mandatoryOptOutSentence}\n\n${signature}`
    };
  }

  if (variation.key === "local-owner") {
    return {
      subject: `Website idea for ${lead.business_name}`,
      body: `${greeting}\n\n${praise} ${opportunity} ${introduction} We can put together a complimentary homepage or "Start Here" concept tailored to ${conceptTarget}. Would you be open to seeing a few ideas? ${mandatoryOptOutSentence}\n\n${signature}`
    };
  }

  return {
    subject: `Homepage concept for ${lead.business_name}`,
    body: `${greeting}\n\n${praise} ${opportunity} ${introduction} We would love to create a complimentary homepage or "Start Here" concept tailored to ${conceptTarget}. Would you be open to seeing a few ideas? ${mandatoryOptOutSentence}\n\n${signature}`
  };
}

function buildFollowUpDraft(
  lead: Lead,
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "portfolio_link" | "calendly_link">,
  variation: DraftVariation
): GeneratedEmailDraft {
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  const signature = buildSignature(settings, false);

  if (variation.key === "customer-path") {
    return {
      subject: `Re: ${lead.business_name} homepage idea`,
      body: `${greeting}\n\nQuick follow-up on the complimentary homepage mockup idea for ${lead.business_name}. The goal would be simple: a cleaner path from first impression to contact, booking, or quote request. If that would be useful, I can share a draft direction before a short 10-15 minute call. If not, no worries.\n\n${signature}`
    };
  }

  if (variation.key === "local-owner") {
    return {
      subject: `Following up with ${lead.business_name}`,
      body: `${greeting}\n\nJust circling back on the website idea for ${lead.business_name}. I can keep it lightweight: one complimentary homepage mockup, focused on a cleaner first impression and easier contact flow, then a short 10-15 minute call only if the direction feels useful. If not, no problem at all.\n\n${signature}`
    };
  }

  return {
    subject: `Following up on ${lead.business_name}`,
    body: `${greeting}\n\nJust wanted to follow up on the complimentary homepage mockup idea for ${lead.business_name}. I can put together a simple direction that makes the business, services, and next step easier to scan. If it would be useful, we could walk through it on a short 10-15 minute call. If now is not a fit, no worries.\n\n${signature}`
  };
}

function formatWebsiteObservation(issue: ObservedWebsiteIssue | string) {
  const labels: Partial<Record<ObservedWebsiteIssue, string>> = {
    "Poor mobile responsiveness": "a mobile experience that may be hard to use",
    "Outdated design": "a website presentation that may feel dated",
    "Unclear contact options": "contact options that may be hard to find",
    "Missing calls to action": "the next step for visitors",
    "Slow-loading pages": "pages that may load slowly",
    "No website": "no clear website in the listing",
    "Other observed issue": "a website opportunity worth tightening up"
  };
  return labels[issue as ObservedWebsiteIssue] ?? String(issue).trim().slice(0, 120);
}

function buildPraiseLine(lead: Lead) {
  const audience = lead.industry
    ? `${lead.industry.toLowerCase()} customers`
    : lead.location
      ? `people around ${lead.location}`
      : "local customers";
  return `I came across ${lead.business_name} and was impressed by the work you do for ${audience}.`;
}

function buildOpportunityLine(issue: ObservedWebsiteIssue | string | null) {
  if (!issue) {
    return "There may be an opportunity to make the first-time visitor experience even simpler by helping people quickly find the right next step.";
  }
  return `There may be an opportunity to make the first-time visitor experience simpler, especially around ${formatWebsiteObservation(issue)}.`;
}

function shortBusinessName(name: string) {
  return name.replace(/\b(LLC|Inc\.?|Co\.?|Company|Studio|Clinic|Practice)\b/gi, "").replace(/\s+/g, " ").trim() || name;
}

function buildSignature(
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "portfolio_link" | "calendly_link">,
  includeAgency = true
) {
  return [
    "Best,",
    `${settings.sender_name} & Mhamed`,
    includeAgency ? settings.agency_name : null,
    settings.agency_website,
    settings.portfolio_link ? `Portfolio: ${settings.portfolio_link}` : null
  ]
    .filter(Boolean)
    .join("\n");
}
