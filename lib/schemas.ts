import { z } from "zod";
import {
  draftStates,
  draftTypes,
  generatedByValues,
  leadStatuses,
  observedWebsiteIssues,
  replyCategories,
  templateTypes
} from "@/lib/constants";

const emptyToNull = (value: unknown) => (value === "" ? null : value);
const nullableUrl = z.preprocess(
  emptyToNull,
  z.string().url("Enter a valid URL.").nullable().optional()
);
const nullableText = z.preprocess(emptyToNull, z.string().trim().nullable().optional());

export const leadInputSchema = z.object({
  business_name: z.string().trim().min(1, "Business name is required.").max(160),
  contact_name: nullableText,
  email: z.string().trim().email("Enter a valid email address.").max(254),
  website_url: nullableUrl,
  industry: nullableText,
  location: nullableText,
  observed_website_issues: z.array(z.enum(observedWebsiteIssues)).default([]),
  issue_details: nullableText,
  notes: nullableText,
  status: z.enum(leadStatuses).default("Ready"),
  date_contacted: nullableText,
  follow_up_count: z.coerce.number().int().min(0).max(1).default(0)
});

export const leadUpdateSchema = leadInputSchema.partial().extend({
  id: z.string().uuid()
});

export const draftInputSchema = z.object({
  lead_id: z.string().uuid(),
  draft_type: z.enum(draftTypes),
  subject: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(5000),
  state: z.enum(draftStates).default("awaiting_review"),
  gmail_draft_id: nullableText,
  gmail_message_id: nullableText,
  generated_by: z.enum(generatedByValues).default("manual")
});

export const draftUpdateSchema = z.object({
  subject: z.string().trim().min(1).max(140).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  state: z.enum(draftStates).optional(),
  gmail_draft_id: nullableText,
  gmail_message_id: nullableText
});

export const sendDraftSchema = z.object({
  draft_id: z.string().uuid(),
  final_confirmation: z.literal(true),
  subject: z.string().trim().min(1).max(140).optional(),
  body: z.string().trim().min(1).max(5000).optional()
});

export const generateDraftRequestSchema = z.object({
  lead_id: z.string().uuid(),
  draft_type: z.enum(draftTypes).default("initial")
});

export const classifyReplyRequestSchema = z.object({
  lead_id: z.string().uuid(),
  reply_body: z.string().trim().min(1).max(20_000),
  sender_email: z.string().email()
});

export const replyClassificationSchema = z.object({
  category: z.enum(replyCategories),
  confidence: z.number().min(0).max(1),
  explanation: z.string().trim().min(1).max(300)
});

export const replyOverrideSchema = z.object({
  classification: z.enum(replyCategories)
});

export const templateSchema = z.object({
  template_type: z.enum(templateTypes),
  content: z.string().trim().min(1).max(8000)
});

export const settingsSchema = z.object({
  sender_name: z.string().trim().min(1).max(120),
  sender_email: z.string().trim().email(),
  agency_name: z.string().trim().min(1).max(160),
  agency_website: nullableUrl,
  portfolio_link: nullableUrl,
  calendly_link: nullableUrl,
  daily_send_limit: z.coerce.number().int().min(1).max(20).default(20),
  follow_up_delay_days: z.coerce.number().int().min(1).max(30).default(5)
});

export const openAiSecretSchema = z.object({
  api_key: z.string().trim().min(20)
});

export const researchSearchSchema = z.object({
  business_type: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(8).default(5),
  include_website_research: z.boolean().default(true)
});

export const researchImportSchema = z.object({
  business_name: z.string().trim().min(1).max(160),
  contact_name: nullableText,
  email: z.string().trim().email("Enter a valid email address.").max(254),
  website_url: nullableUrl,
  industry: nullableText,
  location: nullableText,
  observed_website_issues: z.array(z.enum(observedWebsiteIssues)).default([]),
  issue_details: nullableText,
  notes: nullableText
});

export const csvImportRowSchema = leadInputSchema
  .omit({ status: true, follow_up_count: true })
  .extend({
    status: z.enum(leadStatuses).default("Ready").optional(),
    follow_up_count: z.coerce.number().int().min(0).max(1).default(0).optional()
  });

export type LeadInput = z.infer<typeof leadInputSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type ResearchSearchInput = z.infer<typeof researchSearchSchema>;
export type ResearchImportInput = z.infer<typeof researchImportSchema>;
