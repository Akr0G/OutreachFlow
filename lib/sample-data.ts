import { mandatoryOptOutSentence } from "@/lib/constants";
import type { Activity, AppSettings, EmailDraft, Lead, Notification, Reply, Template } from "@/lib/types";

const now = "2026-07-02T12:00:00.000Z";
const sampleSignature = "Best,\nAkhil\nOutreachFlow Studio";

export const sampleLeads: Lead[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    business_name: "Maple Street Bakery",
    contact_name: "Avery",
    email: "maple.owner@example.com",
    website_url: "https://maplestreetbakery.example",
    industry: "Bakery",
    location: "Fairview, OH",
    observed_website_issues: ["Missing calls to action"],
    issue_details: "Homepage menu is clear, but the catering inquiry option is hard to spot.",
    notes: "Avery handles catering requests.",
    status: "Ready",
    date_contacted: null,
    follow_up_count: 0,
    initial_sent_at: null,
    last_activity_at: "2026-07-02T09:10:00.000Z",
    gmail_thread_id: null,
    stop_reason: null,
    created_at: "2026-07-02T09:10:00.000Z",
    updated_at: "2026-07-02T09:10:00.000Z"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    business_name: "BrightSmile Dental",
    contact_name: "Jordan",
    email: "brightsmile.owner@example.com",
    website_url: "https://brightsmile-dental.example",
    industry: "Dental",
    location: "Cedar Falls, IA",
    observed_website_issues: ["Outdated design"],
    issue_details: "The homepage has older visuals and limited service highlights.",
    notes: "Mention a simple homepage refresh, not a full redesign.",
    status: "Draft Created",
    date_contacted: null,
    follow_up_count: 0,
    initial_sent_at: null,
    last_activity_at: "2026-07-01T16:30:00.000Z",
    gmail_thread_id: null,
    stop_reason: null,
    created_at: "2026-07-01T15:45:00.000Z",
    updated_at: "2026-07-01T16:30:00.000Z"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    business_name: "Northside Auto Repair",
    contact_name: "Casey",
    email: "northside.owner@example.com",
    website_url: "https://northside-auto.example",
    industry: "Auto repair",
    location: "Riverton, NJ",
    observed_website_issues: ["Poor mobile responsiveness"],
    issue_details: "Service list is difficult to scan on a phone.",
    notes: "Keep the tone practical and direct.",
    status: "Sent",
    date_contacted: "2026-06-27",
    follow_up_count: 0,
    initial_sent_at: "2026-06-27T14:00:00.000Z",
    last_activity_at: "2026-06-27T14:00:00.000Z",
    gmail_thread_id: "thread-northside-1",
    stop_reason: null,
    created_at: "2026-06-26T14:00:00.000Z",
    updated_at: "2026-06-27T14:00:00.000Z"
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    business_name: "Riverbend Fitness Studio",
    contact_name: "Morgan",
    email: "riverbend.owner@example.com",
    website_url: "https://riverbend-fitness.example",
    industry: "Fitness",
    location: "Asheville, NC",
    observed_website_issues: ["Unclear contact options"],
    issue_details: "Class trial booking is not easy to find from the homepage.",
    notes: "Morgan replied asking for mockup examples.",
    status: "Interested",
    date_contacted: "2026-06-24",
    follow_up_count: 0,
    initial_sent_at: "2026-06-24T13:15:00.000Z",
    last_activity_at: "2026-06-25T10:22:00.000Z",
    gmail_thread_id: "thread-riverbend-1",
    stop_reason: null,
    created_at: "2026-06-23T18:20:00.000Z",
    updated_at: "2026-06-25T10:22:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    business_name: "Willow & Pine Florist",
    contact_name: "Taylor",
    email: "willowpine.owner@example.com",
    website_url: "https://willow-pine-florist.example",
    industry: "Florist",
    location: "Boulder, CO",
    observed_website_issues: ["Slow-loading pages"],
    issue_details: "The gallery page was noted by the owner as feeling slow.",
    notes: "Do not follow up.",
    status: "Unsubscribed",
    date_contacted: "2026-06-21",
    follow_up_count: 0,
    initial_sent_at: "2026-06-21T15:40:00.000Z",
    last_activity_at: "2026-06-22T08:05:00.000Z",
    gmail_thread_id: "thread-willow-1",
    stop_reason: "Unsubscribe request",
    created_at: "2026-06-20T13:05:00.000Z",
    updated_at: "2026-06-22T08:05:00.000Z"
  }
];

export const sampleDrafts: EmailDraft[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    lead_id: "22222222-2222-4222-8222-222222222222",
    draft_type: "initial",
    subject: "A homepage idea for BrightSmile Dental",
    body: `Hi Jordan,\n\nI noticed BrightSmile Dental's homepage has an older design and limited service highlights. I run a small web-design studio and thought a cleaner homepage could make it easier for new patients to understand what you offer. I'd be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. ${mandatoryOptOutSentence}\n\n${sampleSignature}`,
    state: "awaiting_review",
    gmail_draft_id: "gmail-draft-brightsmile",
    gmail_message_id: null,
    generated_by: "ai",
    created_at: "2026-07-01T16:30:00.000Z",
    updated_at: "2026-07-01T16:30:00.000Z",
    sent_at: null
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    lead_id: "33333333-3333-4333-8333-333333333333",
    draft_type: "initial",
    subject: "Quick homepage mockup idea",
    body: `Hi Casey,\n\nI noticed Northside Auto Repair's service list is difficult to scan on a phone. I build simple websites for local businesses and thought a cleaner mobile layout could help customers find repair info faster. I'd be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. ${mandatoryOptOutSentence}\n\n${sampleSignature}`,
    state: "sent",
    gmail_draft_id: "gmail-draft-northside",
    gmail_message_id: "gmail-message-northside",
    generated_by: "ai",
    created_at: "2026-06-27T13:40:00.000Z",
    updated_at: "2026-06-27T14:00:00.000Z",
    sent_at: "2026-06-27T14:00:00.000Z"
  }
];

export const sampleReplies: Reply[] = [
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    lead_id: "44444444-4444-4444-8444-444444444444",
    gmail_message_id: "reply-riverbend-1",
    gmail_thread_id: "thread-riverbend-1",
    sender_email: "riverbend.owner@example.com",
    received_at: "2026-06-25T10:22:00.000Z",
    body: "Thanks, this sounds useful. Could you send a couple examples before we pick a time?",
    classification: "Interested",
    confidence: 0.92,
    explanation: "The sender expressed interest and asked for examples.",
    manually_overridden: false,
    created_at: "2026-06-25T10:22:00.000Z"
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    lead_id: "55555555-5555-4555-8555-555555555555",
    gmail_message_id: "reply-willow-1",
    gmail_thread_id: "thread-willow-1",
    sender_email: "willowpine.owner@example.com",
    received_at: "2026-06-22T08:05:00.000Z",
    body: "No thanks, please remove me from future follow ups.",
    classification: "Unsubscribe",
    confidence: 0.98,
    explanation: "The reply asks to be removed from future follow-ups.",
    manually_overridden: false,
    created_at: "2026-06-22T08:05:00.000Z"
  }
];

export const sampleActivities: Activity[] = [
  ...sampleLeads.map((lead) => ({
    id: `${lead.id.slice(0, 8)}-activity-created`,
    lead_id: lead.id,
    activity_type: "Lead created" as const,
    description: `${lead.business_name} added`,
    metadata: {},
    created_at: lead.created_at
  })),
  {
    id: "activity-brightsmile-draft",
    lead_id: "22222222-2222-4222-8222-222222222222",
    activity_type: "Draft created",
    description: "Initial draft created",
    metadata: { subject: "A homepage idea for BrightSmile Dental" },
    created_at: "2026-07-01T16:30:00.000Z"
  },
  {
    id: "activity-northside-sent",
    lead_id: "33333333-3333-4333-8333-333333333333",
    activity_type: "Email sent",
    description: "Initial email sent",
    metadata: { subject: "Quick homepage mockup idea" },
    created_at: "2026-06-27T14:00:00.000Z"
  },
  {
    id: "activity-riverbend-reply",
    lead_id: "44444444-4444-4444-8444-444444444444",
    activity_type: "Reply received",
    description: "Reply received",
    metadata: { classification: "Interested" },
    created_at: "2026-06-25T10:22:00.000Z"
  },
  {
    id: "activity-riverbend-classified",
    lead_id: "44444444-4444-4444-8444-444444444444",
    activity_type: "Reply classified",
    description: "Reply classified as Interested",
    metadata: { confidence: 0.92 },
    created_at: "2026-06-25T10:22:10.000Z"
  },
  {
    id: "activity-willow-unsubscribed",
    lead_id: "55555555-5555-4555-8555-555555555555",
    activity_type: "Follow-up canceled",
    description: "Follow-up canceled because a reply was received",
    metadata: { reason: "Unsubscribe request" },
    created_at: "2026-06-22T08:05:10.000Z"
  }
];

export const sampleTemplates: Template[] = [
  {
    id: "template-initial",
    template_type: "initial",
    content:
      "Hi {{contact_name}},\n\nI noticed {{business_name}} has {{website_issue}}. I run {{agency_name}} and thought a cleaner homepage could make it easier for local customers to take the next step. I would be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. Would next week be a good time to compare ideas?\n\n" +
      mandatoryOptOutSentence,
    updated_at: now
  },
  {
    id: "template-follow-up",
    template_type: "follow_up",
    content:
      "Hi {{contact_name}},\n\nJust wanted to follow up on my note about a complimentary homepage mockup for {{business_name}}. If it is useful, I can send over a simple direction before a short call. If now is not a fit, no worries.",
    updated_at: now
  },
  {
    id: "template-signature",
    template_type: "signature",
    content: sampleSignature,
    updated_at: now
  },
  {
    id: "template-cta",
    template_type: "cta",
    content: "Would next week be a good time to compare ideas?",
    updated_at: now
  }
];

export const sampleSettings: AppSettings = {
  id: "settings-single-owner",
  sender_name: "Akhil",
  sender_email: "owner@example.com",
  agency_name: "OutreachFlow Studio",
  agency_website: "https://agency.example",
  portfolio_link: "https://agency.example/portfolio",
  calendly_link: "https://calendly.example/intro",
  daily_send_limit: 20,
  follow_up_delay_days: 5,
  encrypted_openai_key_reference: null,
  gmail_connection_metadata: {
    connected: false
  },
  updated_at: now
};

export const sampleNotifications: Notification[] = [
  {
    id: "notification-riverbend",
    type: "Interested reply",
    lead_id: "44444444-4444-4444-8444-444444444444",
    title: "Riverbend Fitness Studio is interested",
    message: "Morgan asked to see examples before booking a call.",
    read_at: null,
    created_at: "2026-06-25T10:22:10.000Z"
  }
];

export function getLeadById(id: string) {
  return sampleLeads.find((lead) => lead.id === id) ?? null;
}

export function getDraftsForLead(leadId: string) {
  return sampleDrafts.filter((draft) => draft.lead_id === leadId);
}

export function getRepliesForLead(leadId: string) {
  return sampleReplies.filter((reply) => reply.lead_id === leadId);
}

export function getActivitiesForLead(leadId: string) {
  return sampleActivities
    .filter((activity) => activity.lead_id === leadId)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}
