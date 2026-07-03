import type { Lead, ObservedWebsiteIssue, WebsiteQualityTier } from "@/lib/types";

export type WebsiteQualityScore = {
  tier: WebsiteQualityTier;
  label: string;
  summary: string;
};

export const websiteQualityLabels: Record<WebsiteQualityTier, string> = {
  0: "No website",
  1: "Needs work",
  2: "Solid but improvable",
  3: "Strong"
};

const issueWeights: Record<ObservedWebsiteIssue, number> = {
  "Poor mobile responsiveness": 1,
  "Outdated design": 1,
  "Unclear contact options": 1,
  "Missing calls to action": 1,
  "Slow-loading pages": 1,
  "No website": 3,
  "Other observed issue": 1
};

export function scoreWebsiteQuality(input: {
  websiteUrl?: string | null;
  issues?: ObservedWebsiteIssue[] | null;
  issueDetails?: string | null;
}): WebsiteQualityScore {
  const issues = input.issues ?? [];

  if (!input.websiteUrl || issues.includes("No website")) {
    return {
      tier: 0,
      label: websiteQualityLabels[0],
      summary: "No business website was found in the available lead data."
    };
  }

  const penalty = issues.reduce((total, issue) => total + issueWeights[issue], 0);
  const tier: WebsiteQualityTier = penalty >= 2.5 ? 1 : penalty >= 1 ? 2 : 3;
  const primaryIssue = issues[0] ?? input.issueDetails;

  return {
    tier,
    label: websiteQualityLabels[tier],
    summary:
      tier === 3
        ? "No major website issues were flagged by the available research signals."
        : primaryIssue
          ? `Main flagged signal: ${primaryIssue}.`
          : "Website has room for improvement based on the available research signals."
  };
}

export function scoreLeadWebsite(lead: Pick<Lead, "website_url" | "observed_website_issues" | "issue_details">) {
  return scoreWebsiteQuality({
    websiteUrl: lead.website_url,
    issues: lead.observed_website_issues,
    issueDetails: lead.issue_details
  });
}

export function formatWebsiteQualityTier(score: WebsiteQualityScore) {
  return `Tier ${score.tier} - ${score.label}`;
}
