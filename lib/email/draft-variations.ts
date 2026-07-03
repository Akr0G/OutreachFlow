import { mandatoryOptOutSentence } from "@/lib/constants";
import type {
  AppSettings,
  GeneratedEmailDraft,
  Lead,
  ObservedWebsiteIssue
} from "@/lib/types";

type DraftSettings = Pick<
  AppSettings,
  | "sender_name"
  | "agency_name"
  | "agency_website"
  | "portfolio_link"
  | "calendly_link"
>;

export type DraftVariation = {
  key: "mockup-first" | "customer-path" | "local-owner";
  subjectTone: string;
  openingAngle: string;
  ctaAngle: string;
};

export const draftVariations: DraftVariation[] = [
  {
    key: "mockup-first",
    subjectTone: "homepage idea",
    openingAngle: "specific website observation",
    ctaAngle: "show the homepage concept"
  },
  {
    key: "customer-path",
    subjectTone: "clearer customer path",
    openingAngle: "customer experience",
    ctaAngle: "show a clearer homepage direction"
  },
  {
    key: "local-owner",
    subjectTone: "local website idea",
    openingAngle: "friendly and concise",
    ctaAngle: "low-pressure Zoom walkthrough"
  }
];

export function pickDraftVariation(seed = crypto.randomUUID()) {
  const total = Array.from(seed).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );

  return draftVariations[total % draftVariations.length];
}

export function buildLocalDraft(
  lead: Lead,
  type: "initial" | "follow_up",
  settings: DraftSettings,
  variation = pickDraftVariation()
): GeneratedEmailDraft {
  if (type === "follow_up") {
    return buildFollowUpDraft(lead, settings, variation);
  }

  return buildInitialDraft(lead, settings, variation);
}

function buildInitialDraft(
  lead: Lead,
  settings: DraftSettings,
  variation: DraftVariation
): GeneratedEmailDraft {
  const greeting = lead.contact_name
    ? `Hi ${lead.contact_name},`
    : `Hi ${shortBusinessName(lead.business_name)} Team,`;

  const issue = lead.observed_website_issues?.[0] ?? lead.issue_details;
  const observationParagraph = buildObservationParagraph(lead, issue);
  const agencyParagraph = buildAgencyParagraph(settings, variation);
  const conceptParagraph = buildConceptParagraph(lead, variation);
  const callToAction = buildCallToAction();

  return {
    subject: buildSubject(lead, variation),
    body: [
      greeting,
      observationParagraph,
      agencyParagraph,
      conceptParagraph,
      callToAction,
      mandatoryOptOutSentence,
      buildSignature(settings)
    ].join("\n\n")
  };
}

function buildFollowUpDraft(
  lead: Lead,
  settings: DraftSettings,
  variation: DraftVariation
): GeneratedEmailDraft {
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  const businessName = shortBusinessName(lead.business_name);

  return {
    subject:
      variation.key === "customer-path"
        ? `Re: clearer website idea for ${businessName}`
        : `Following up on ${businessName}`,
    body: [
      greeting,
      `Just following up on the website idea for ${businessName}.`,
      "Would you be open to a quick 10-15 minute Zoom call to discuss a homepage idea for the business?",
      mandatoryOptOutSentence,
      buildSignature(settings, false)
    ].join("\n\n")
  };
}

function buildSubject(lead: Lead, variation: DraftVariation) {
  const businessName = shortBusinessName(lead.business_name);

  if (variation.key === "customer-path") {
    return `A clearer website idea for ${businessName}`;
  }

  if (variation.key === "local-owner") {
    return `Website idea for ${businessName}`;
  }

  return `A homepage idea for ${businessName}`;
}

function buildObservationParagraph(
  lead: Lead,
  issue: ObservedWebsiteIssue | string | null | undefined
) {
  const businessName = lead.business_name;

  if (issue === "No website") {
    return `I came across ${businessName} and did not see a clear website listed. A simple site could give people one place to understand the services and get in touch.`;
  }

  if (issue === "Poor mobile responsiveness") {
    return `I came across ${businessName} and saw an opportunity to make the mobile website experience clearer, especially around services and contact information.`;
  }

  if (issue === "Unclear contact options") {
    return `I came across ${businessName} and saw an opportunity to make the best contact step easier to find for first-time visitors.`;
  }

  if (issue === "Missing calls to action") {
    return `I came across ${businessName} and saw an opportunity to make the next step clearer, whether that is calling, booking, or requesting more information.`;
  }

  if (issue === "Outdated design") {
    return `I came across ${businessName} and saw an opportunity to make the website presentation clearer, easier to scan, and more current.`;
  }

  if (issue === "Slow-loading pages") {
    return `I came across ${businessName} and saw an opportunity to make the website feel faster and easier to use for first-time visitors.`;
  }

  if (issue) {
    return `I came across ${businessName} and saw an opportunity to make the website experience clearer for first-time visitors.`;
  }

  return `I came across ${businessName} and thought there may be an opportunity to make the website easier for first-time visitors to understand and use.`;
}

function buildAgencyParagraph(
  settings: DraftSettings,
  variation: DraftVariation
) {
  if (variation.key === "customer-path") {
    return `M'hamed and I run ${settings.agency_name}, a small web design studio that helps local businesses make services, contact options, and next steps easier to understand.`;
  }

  if (variation.key === "local-owner") {
    return `M'hamed and I run ${settings.agency_name}, a small web design studio that creates clear, modern, mobile-friendly websites for local businesses.`;
  }

  return `M'hamed and I run ${settings.agency_name}, a small web design studio for local businesses.`;
}

function buildConceptParagraph(
  lead: Lead,
  variation: DraftVariation
) {
  const businessName = lead.business_name;

  if (variation.key === "customer-path") {
    return `We already created a complimentary homepage concept for ${businessName}.`;
  }

  if (variation.key === "local-owner") {
    return `We already created a complimentary homepage concept for ${businessName}.`;
  }

  return `We already created a complimentary homepage concept for ${businessName}.`;
}

function buildCallToAction() {
  return "If you're open to a quick 10-15 minute Zoom call, we can show you this homepage concept and discuss next steps if it feels useful.";
}

function shortBusinessName(name: string) {
  return (
    name
      .replace(/\b(LLC|Inc\.?|Co\.?|Company|Studio|Clinic|Practice)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || name
  );
}

function normalizeUrl(url?: string | null) {
  return url?.trim().replace(/\/$/, "") ?? "";
}

function buildSignature(settings: DraftSettings, includeAgency = true) {
  const agencyWebsite = normalizeUrl(settings.agency_website);
  const portfolioLink = normalizeUrl(settings.portfolio_link);
  const sameLink =
    Boolean(agencyWebsite) &&
    Boolean(portfolioLink) &&
    agencyWebsite === portfolioLink;

  return [
    "Best,",
    `${settings.sender_name} & M'hamed`,
    includeAgency ? settings.agency_name : null,
    portfolioLink ? `Portfolio: ${settings.portfolio_link}` : null,
    agencyWebsite && !sameLink ? `Website: ${settings.agency_website}` : null
  ]
    .filter(Boolean)
    .join("\n");
}
