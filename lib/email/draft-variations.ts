import { mandatoryOptOutSentence } from "@/lib/constants";
import type { AppSettings, GeneratedEmailDraft, Lead } from "@/lib/types";

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
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "calendly_link">,
  variation = pickDraftVariation()
): GeneratedEmailDraft {
  if (type === "follow_up") return buildFollowUpDraft(lead, settings, variation);
  return buildInitialDraft(lead, settings, variation);
}

function buildInitialDraft(
  lead: Lead,
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "calendly_link">,
  variation: DraftVariation
): GeneratedEmailDraft {
  const issue = lead.observed_website_issues[0] ?? lead.issue_details;
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  const issueSentence = issue
    ? `I noticed ${lead.business_name} has ${issue.toLowerCase()}.`
    : `I came across ${lead.business_name}.`;
  const signature = buildSignature(settings);

  if (variation.key === "customer-path") {
    return {
      subject: `A clearer next step for ${lead.business_name}`,
      body: `${greeting}\n\n${issueSentence} I run ${settings.agency_name} and help local businesses make their websites easier for customers to act on. I can put together a complimentary homepage mockup with a cleaner path to the next step. If it seems useful, we could walk through it on a short 10-15 minute call. ${mandatoryOptOutSentence}\n\n${signature}`
    };
  }

  if (variation.key === "local-owner") {
    return {
      subject: `Website idea for ${lead.business_name}`,
      body: `${greeting}\n\n${issueSentence} I work with local businesses through ${settings.agency_name}, and I had a simple homepage direction in mind that could make the first impression feel cleaner. I would be happy to create a complimentary homepage mockup and share it on a short 10-15 minute call. ${mandatoryOptOutSentence}\n\n${signature}`
    };
  }

  return {
    subject: `A homepage mockup idea for ${lead.business_name}`,
    body: `${greeting}\n\n${issueSentence} I run ${settings.agency_name} and build simple websites for local businesses. I thought a cleaner homepage could make it easier for customers to take the next step. I would be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. ${mandatoryOptOutSentence}\n\n${signature}`
  };
}

function buildFollowUpDraft(
  lead: Lead,
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "calendly_link">,
  variation: DraftVariation
): GeneratedEmailDraft {
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  const signature = buildSignature(settings, false);

  if (variation.key === "customer-path") {
    return {
      subject: `Re: ${lead.business_name} homepage idea`,
      body: `${greeting}\n\nQuick follow-up on the complimentary homepage mockup idea for ${lead.business_name}. If a clearer path for customers to contact you would be useful, I can send over a simple direction before a short 10-15 minute call. If now is not a fit, no worries.\n\n${signature}`
    };
  }

  if (variation.key === "local-owner") {
    return {
      subject: `Following up with ${lead.business_name}`,
      body: `${greeting}\n\nJust circling back on the local website idea I sent for ${lead.business_name}. I can keep it lightweight: a complimentary homepage mockup, then a short 10-15 minute call only if the direction feels useful. If not, no problem at all.\n\n${signature}`
    };
  }

  return {
    subject: `Following up on ${lead.business_name}`,
    body: `${greeting}\n\nJust wanted to follow up on my note about a complimentary homepage mockup for ${lead.business_name}. If it would be useful, I can send over a simple direction before a short 10-15 minute call. If now is not a fit, no worries.\n\n${signature}`
  };
}

function buildSignature(
  settings: Pick<AppSettings, "sender_name" | "agency_name" | "agency_website" | "calendly_link">,
  includeAgency = true
) {
  return ["Best,", settings.sender_name, includeAgency ? settings.agency_name : null, settings.agency_website].filter(Boolean).join("\n");
}
