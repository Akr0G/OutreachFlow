import { mandatoryOptOutSentence, observedWebsiteIssues } from "@/lib/constants";
import type { GeneratedEmailDraft, Lead } from "@/lib/types";

const unsupportedClaimPatterns = [
  /\b(audited|audit)\b/i,
  /\b(reviewed|review)\b/i,
  /\b(tested|test)\b/i,
  /\b(visited|visit)\b/i,
  /\bscanned\b/i,
  /\bscraped\b/i,
  /\byour traffic\b/i,
  /\byour conversion/i,
  /\byour customers\b/i
];

export type DraftValidationResult = {
  valid: boolean;
  errors: string[];
  wordCount: number;
};

export function countWords(value: string) {
  const matches = value.trim().match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
  return matches?.length ?? 0;
}

export function bodyExcludingSignature(body: string, signature?: string | null) {
  const trimmedBody = body.trim();
  if (!signature) return trimmedBody.replace(/\n\nBest,[\s\S]*$/i, "").trim();
  const trimmedSignature = signature.trim();
  if (trimmedSignature && trimmedBody.endsWith(trimmedSignature)) {
    return trimmedBody.slice(0, -trimmedSignature.length).trim();
  }
  return trimmedBody.replace(/\n\nBest,[\s\S]*$/i, "").trim();
}

export function validateInitialEmailDraft(
  draft: GeneratedEmailDraft,
  lead: Pick<Lead, "business_name" | "contact_name" | "observed_website_issues" | "issue_details" | "notes">,
  signature?: string | null
): DraftValidationResult {
  const errors: string[] = [];
  const draftBodyWithoutSignature = bodyExcludingSignature(draft.body, signature);
  const wordCount = countWords(draftBodyWithoutSignature);

  if (wordCount < 65 || wordCount > 130) {
    errors.push("Initial email body must be between 65 and 130 words, excluding the signature.");
  }
  if (!draft.body.includes(mandatoryOptOutSentence)) {
    errors.push("Initial email must include the required opt-out sentence exactly.");
  }
  if (lead.business_name && !draft.body.includes(lead.business_name)) {
    errors.push("Initial email should mention the business name.");
  }
  if (lead.contact_name && !draft.body.includes(lead.contact_name)) {
    errors.push("Initial email should mention the contact name.");
  }

  const supportedIssueText = [
    ...lead.observed_website_issues,
    lead.issue_details,
    lead.notes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const issue of observedWebsiteIssues) {
    const mentioned = draft.body.toLowerCase().includes(issue.toLowerCase());
    const supported = supportedIssueText.includes(issue.toLowerCase());
    if (mentioned && !supported) {
      errors.push(`Draft mentions unsupported website issue: ${issue}.`);
    }
  }

  for (const pattern of unsupportedClaimPatterns) {
    const match = draft.body.match(pattern);
    if (match && !(lead.notes ?? "").toLowerCase().includes(match[0].toLowerCase())) {
      errors.push(`Draft includes unsupported claim language: "${match[0]}".`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    wordCount
  };
}
