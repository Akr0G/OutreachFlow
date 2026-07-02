import type {
  activityTypes,
  draftStates,
  draftTypes,
  generatedByValues,
  leadStatuses,
  observedWebsiteIssues,
  replyCategories,
  templateTypes
} from "@/lib/constants";

export type LeadStatus = (typeof leadStatuses)[number];
export type DraftType = (typeof draftTypes)[number];
export type DraftState = (typeof draftStates)[number];
export type GeneratedBy = (typeof generatedByValues)[number];
export type ReplyCategory = (typeof replyCategories)[number];
export type ObservedWebsiteIssue = (typeof observedWebsiteIssues)[number];
export type ActivityType = (typeof activityTypes)[number];
export type TemplateType = (typeof templateTypes)[number];

export type JsonRecord = Record<string, unknown>;

export type Lead = {
  id: string;
  owner_id?: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  website_url: string | null;
  industry: string | null;
  location: string | null;
  observed_website_issues: ObservedWebsiteIssue[];
  issue_details: string | null;
  notes: string | null;
  status: LeadStatus;
  date_contacted: string | null;
  follow_up_count: number;
  initial_sent_at: string | null;
  last_activity_at: string;
  gmail_thread_id: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailDraft = {
  id: string;
  owner_id?: string;
  lead_id: string;
  draft_type: DraftType;
  subject: string;
  body: string;
  state: DraftState;
  gmail_draft_id: string | null;
  gmail_message_id: string | null;
  generated_by: GeneratedBy;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

export type Reply = {
  id: string;
  owner_id?: string;
  lead_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  sender_email: string;
  received_at: string;
  body: string;
  classification: ReplyCategory;
  confidence: number;
  explanation: string;
  manually_overridden: boolean;
  created_at: string;
};

export type Activity = {
  id: string;
  owner_id?: string;
  lead_id: string;
  activity_type: ActivityType;
  description: string;
  metadata: JsonRecord;
  created_at: string;
};

export type Template = {
  id: string;
  owner_id?: string;
  template_type: TemplateType;
  content: string;
  updated_at: string;
};

export type AppSettings = {
  id: string;
  owner_id?: string;
  sender_name: string;
  sender_email: string;
  agency_name: string;
  agency_website: string | null;
  portfolio_link: string | null;
  calendly_link: string | null;
  daily_send_limit: number;
  follow_up_delay_days: number;
  encrypted_openai_key_reference: string | null;
  gmail_connection_metadata: {
    connected: boolean;
    email?: string;
    token_last_four?: string;
    watch_expiration?: string;
    history_id?: string;
  } | null;
  updated_at: string;
};

export type Notification = {
  id: string;
  owner_id?: string;
  type: string;
  lead_id: string | null;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export type GeneratedEmailDraft = {
  subject: string;
  body: string;
};

export type ReplyClassification = {
  category: ReplyCategory;
  confidence: number;
  explanation: string;
};
