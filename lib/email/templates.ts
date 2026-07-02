import { mandatoryOptOutSentence, safeTemplateVariables } from "@/lib/constants";
import type { Lead, TemplateType } from "@/lib/types";

export type TemplateContext = {
  business_name?: string | null;
  contact_name?: string | null;
  industry?: string | null;
  location?: string | null;
  website_issue?: string | null;
  agency_name?: string | null;
  sender_name?: string | null;
  agency_website?: string | null;
  portfolio_link?: string | null;
  calendly_link?: string | null;
};

const variablePattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function getTemplateVariables(content: string) {
  return Array.from(content.matchAll(variablePattern), (match) => match[1]);
}

export function validateTemplate(content: string, templateType?: TemplateType) {
  const variables = getTemplateVariables(content);
  const unsupported = variables.filter(
    (name) => !safeTemplateVariables.includes(name as (typeof safeTemplateVariables)[number])
  );
  const errors: string[] = [];

  if (unsupported.length) {
    errors.push(`Unsupported variables: ${Array.from(new Set(unsupported)).join(", ")}.`);
  }
  if (templateType === "initial" && !content.includes(mandatoryOptOutSentence)) {
    errors.push("Initial template must include the required opt-out sentence.");
  }

  return {
    valid: errors.length === 0,
    errors,
    variables
  };
}

export function renderTemplate(content: string, context: TemplateContext) {
  return content.replace(variablePattern, (_, rawName: string) => {
    const value = context[rawName as keyof TemplateContext];
    return value ? String(value) : "";
  });
}

export function missingVariables(content: string, context: TemplateContext) {
  const variables = getTemplateVariables(content);
  return Array.from(new Set(variables.filter((name) => !context[name as keyof TemplateContext])));
}

export function leadTemplateContext(lead: Lead, appContext: Omit<TemplateContext, "website_issue">) {
  const issue =
    lead.observed_website_issues[0] ??
    (lead.issue_details && lead.issue_details.trim().length > 0 ? lead.issue_details : null);

  return {
    business_name: lead.business_name,
    contact_name: lead.contact_name,
    industry: lead.industry,
    location: lead.location,
    website_issue: issue,
    ...appContext
  };
}
