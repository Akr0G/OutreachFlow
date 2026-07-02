"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  MailPlus,
  MessageSquare,
  Pencil,
  Send,
  ShieldOff,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  mandatoryOptOutSentence,
  observedWebsiteIssues,
  replyCategories
} from "@/lib/constants";
import {
  canCreateFollowUpDraft,
  canCreateInitialDraft,
  canSendDraft,
  statusForReplyCategory
} from "@/lib/business-rules";
import type { Activity, AppSettings, EmailDraft, Lead, LeadStatus, Reply, ReplyCategory } from "@/lib/types";
import { domainFromUrl, formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function LeadDetailClient({
  lead,
  drafts,
  replies,
  activities,
  settings
}: {
  lead: Lead;
  drafts: EmailDraft[];
  replies: Reply[];
  activities: Activity[];
  settings: AppSettings;
}) {
  const [leadState, setLeadState] = useState(lead);
  const [draftState, setDraftState] = useState(drafts);
  const [replyState, setReplyState] = useState(replies);
  const [activityState, setActivityState] = useState(activities);
  const [sendCandidate, setSendCandidate] = useState<EmailDraft | null>(null);
  const [message, setMessage] = useState("");

  const initialEligibility = canCreateInitialDraft(leadState);
  const followUpEligibility = canCreateFollowUpDraft(
    leadState,
    draftState,
    new Date("2026-07-02T12:00:00.000Z"),
    settings.follow_up_delay_days
  );

  const outreachBlocked = ["Not Interested", "Unsubscribed", "Do Not Contact"].includes(leadState.status);

  function updateLeadField<K extends keyof Lead>(key: K, value: Lead[K]) {
    setLeadState((current) => ({
      ...current,
      [key]: value,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    }));
  }

  function toggleIssue(issue: (typeof observedWebsiteIssues)[number]) {
    setLeadState((current) => {
      const exists = current.observed_website_issues.includes(issue);
      return {
        ...current,
        observed_website_issues: exists
          ? current.observed_website_issues.filter((item) => item !== issue)
          : [...current.observed_website_issues, issue]
      };
    });
  }

  function saveLeadChanges() {
    appendActivity("Lead updated", "Lead details updated", {});
    setMessage("Lead changes saved in this workspace session.");
  }

  function generateDraft(type: EmailDraft["draft_type"]) {
    const eligibility =
      type === "initial"
        ? canCreateInitialDraft(leadState)
        : canCreateFollowUpDraft(leadState, draftState, new Date("2026-07-02T12:00:00.000Z"), settings.follow_up_delay_days);
    if (!eligibility.allowed) {
      setMessage(eligibility.reason ?? "Draft cannot be created.");
      return;
    }

    const draft: EmailDraft = {
      id: crypto.randomUUID(),
      lead_id: leadState.id,
      draft_type: type,
      subject:
        type === "initial"
          ? `A homepage mockup idea for ${leadState.business_name}`
          : `Following up on ${leadState.business_name}`,
      body: type === "initial" ? initialBody(leadState, settings) : followUpBody(leadState, settings),
      state: "awaiting_review",
      gmail_draft_id: null,
      gmail_message_id: null,
      generated_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sent_at: null
    };
    setDraftState((current) => [draft, ...current]);
    if (type === "initial") updateLeadField("status", "Draft Created");
    appendActivity(type === "initial" ? "Draft created" : "Follow-up created", type === "initial" ? "Initial draft created" : "Follow-up draft created", { subject: draft.subject });
    setMessage(`${type === "initial" ? "Initial" : "Follow-up"} draft created.`);
  }

  function updateDraft(id: string, updates: Partial<EmailDraft>) {
    setDraftState((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...updates, updated_at: new Date().toISOString() } : draft))
    );
  }

  function approveDraft(draft: EmailDraft) {
    updateDraft(draft.id, { state: "approved" });
    appendActivity("Draft approved", "Draft approved", { subject: draft.subject });
  }

  function deleteDraft(draft: EmailDraft) {
    updateDraft(draft.id, { state: "deleted" });
    appendActivity("Draft deleted", "Draft deleted", { subject: draft.subject });
  }

  function requestSend(draft: EmailDraft) {
    const result = canSendDraft(leadState, draft, settings, 0);
    if (!result.allowed) {
      setMessage(result.reason ?? "Draft cannot be sent.");
      return;
    }
    setSendCandidate(draft);
  }

  function confirmSend() {
    if (!sendCandidate) return;
    const sentAt = new Date().toISOString();
    updateDraft(sendCandidate.id, {
      state: "sent",
      sent_at: sentAt,
      gmail_message_id: sendCandidate.gmail_message_id ?? `demo-${sendCandidate.id}`,
      gmail_draft_id: sendCandidate.gmail_draft_id ?? `demo-draft-${sendCandidate.id}`
    });
    setLeadState((current) => ({
      ...current,
      status: "Sent",
      date_contacted: current.date_contacted ?? sentAt.slice(0, 10),
      initial_sent_at: sendCandidate.draft_type === "initial" ? sentAt : current.initial_sent_at,
      follow_up_count: sendCandidate.draft_type === "follow_up" ? 1 : current.follow_up_count,
      last_activity_at: sentAt
    }));
    appendActivity("Email sent", `${sendCandidate.draft_type === "initial" ? "Initial" : "Follow-up"} email sent`, {
      subject: sendCandidate.subject
    });
    setSendCandidate(null);
    setMessage("Email marked sent in this workspace session.");
  }

  function markStatus(status: LeadStatus) {
    setLeadState((current) => ({
      ...current,
      status,
      stop_reason: status === "Do Not Contact" ? "Manual block" : current.stop_reason,
      last_activity_at: new Date().toISOString()
    }));
    appendActivity(status === "Do Not Contact" ? "Lead marked Do Not Contact" : "Status changed", `Status changed to ${status}`, {});
  }

  function recordManualReply() {
    const reply: Reply = {
      id: crypto.randomUUID(),
      lead_id: leadState.id,
      gmail_message_id: `manual-${Date.now()}`,
      gmail_thread_id: leadState.gmail_thread_id ?? `manual-thread-${leadState.id}`,
      sender_email: leadState.email,
      received_at: new Date().toISOString(),
      body: "Manual reply recorded for review.",
      classification: "Other",
      confidence: 0.55,
      explanation: "Manual reply needs review.",
      manually_overridden: false,
      created_at: new Date().toISOString()
    };
    setReplyState((current) => [reply, ...current]);
    setLeadState((current) => ({ ...current, status: "Replied", last_activity_at: reply.received_at }));
    appendActivity("Reply received", "Reply received", {});
    appendActivity("Follow-up canceled", "Follow-up canceled because a reply was received", {});
  }

  function overrideReply(id: string, category: ReplyCategory) {
    setReplyState((current) =>
      current.map((reply) =>
        reply.id === id
          ? {
              ...reply,
              classification: category,
              confidence: 1,
              manually_overridden: true,
              explanation: "Manually overridden."
            }
          : reply
      )
    );
    setLeadState((current) => ({ ...current, status: statusForReplyCategory(category) }));
    appendActivity("Reply classified", `Reply classified as ${category}`, { manual: true });
  }

  function appendActivity(activity_type: Activity["activity_type"], description: string, metadata: Activity["metadata"]) {
    setActivityState((current) => [
      {
        id: crypto.randomUUID(),
        lead_id: leadState.id,
        activity_type,
        description,
        metadata,
        created_at: new Date().toISOString()
      },
      ...current
    ]);
  }

  const activeDrafts = useMemo(() => draftState.filter((draft) => draft.state !== "deleted"), [draftState]);

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link href="/leads" className="text-sm font-medium text-teal-700 hover:text-teal-900">
            Back to leads
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{leadState.business_name}</h1>
            <p className="mt-1 text-sm text-slate-600">{leadState.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={leadState.status} />
            <EligibilityBadge blocked={outreachBlocked} initial={initialEligibility} followUp={followUpEligibility} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => generateDraft("initial")} disabled={!initialEligibility.allowed}>
            <MailPlus className="h-4 w-4" aria-hidden="true" />
            Initial Draft
          </Button>
          <Button variant="secondary" onClick={() => generateDraft("follow_up")} disabled={!followUpEligibility.allowed}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Follow-Up
          </Button>
          <Button variant="danger" onClick={() => markStatus("Do Not Contact")}>
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
            Do Not Contact
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lead Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <EditField label="Business name" value={leadState.business_name} onChange={(value) => updateLeadField("business_name", value)} />
              <EditField label="Contact name" value={leadState.contact_name ?? ""} onChange={(value) => updateLeadField("contact_name", value || null)} />
              <EditField label="Email" value={leadState.email} onChange={(value) => updateLeadField("email", value)} />
              <EditField label="Industry" value={leadState.industry ?? ""} onChange={(value) => updateLeadField("industry", value || null)} />
              <EditField label="Location" value={leadState.location ?? ""} onChange={(value) => updateLeadField("location", value || null)} />
              <EditField label="Date contacted" type="date" value={leadState.date_contacted ?? ""} onChange={(value) => updateLeadField("date_contacted", value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <div className="flex gap-2">
                <Input value={leadState.website_url ?? ""} onChange={(event) => updateLeadField("website_url", event.target.value || null)} />
                {leadState.website_url && (
                  <a
                    href={leadState.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50"
                    aria-label={`Open ${domainFromUrl(leadState.website_url) ?? "website"}`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Follow-up count</p>
                <p className="mt-1 font-medium text-slate-950">{leadState.follow_up_count}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Last activity</p>
                <p className="mt-1 font-medium text-slate-950">{formatDateTime(leadState.last_activity_at)}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={saveLeadChanges}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Save changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {observedWebsiteIssues.map((issue) => (
                <label key={issue} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={leadState.observed_website_issues.includes(issue)}
                    onChange={() => toggleIssue(issue)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  {issue}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Observed issue details</Label>
              <Textarea value={leadState.issue_details ?? ""} onChange={(event) => updateLeadField("issue_details", event.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={leadState.notes ?? ""} onChange={(event) => updateLeadField("notes", event.target.value || null)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Email Drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeDrafts.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-slate-50 p-4 text-sm text-slate-500">
                No active drafts for this lead.
              </p>
            ) : (
              activeDrafts.map((draft) => (
                <div key={draft.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {draft.draft_type === "initial" ? "Initial" : "Follow-up"} draft
                      </p>
                      <p className="text-xs text-slate-500">State: {draft.state.replace("_", " ")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => approveDraft(draft)} disabled={draft.state === "approved"}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Approve
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => requestSend(draft)} disabled={draft.state !== "approved"}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Send
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => deleteDraft(draft)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <Input value={draft.subject} onChange={(event) => updateDraft(draft.id, { subject: event.target.value })} />
                  <Textarea value={draft.body} onChange={(event) => updateDraft(draft.id, { body: event.target.value })} className="min-h-52" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reply History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="secondary" size="sm" onClick={recordManualReply}>
              Record manual reply
            </Button>
            {replyState.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-slate-50 p-4 text-sm text-slate-500">
                No replies synced yet.
              </p>
            ) : (
              replyState.map((reply) => (
                <div key={reply.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-violet-200 bg-violet-50 text-violet-800">{reply.classification}</Badge>
                    {reply.confidence < 0.7 && (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800">Needs Review</Badge>
                    )}
                    {reply.manually_overridden && (
                      <Badge className="border-slate-200 bg-slate-50 text-slate-700">Overridden</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{reply.body}</p>
                  <p className="text-xs text-slate-500">
                    {reply.sender_email} · {formatDateTime(reply.received_at)} · confidence {Math.round(reply.confidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-500">{reply.explanation}</p>
                  <select
                    value={reply.classification}
                    onChange={(event) => overrideReply(reply.id, event.target.value as ReplyCategory)}
                    className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                  >
                    {replyCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {activityState.map((activity) => (
              <li key={activity.id} className="grid grid-cols-[24px_1fr] gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-slate-950">{activity.description}</p>
                  <p className="text-xs text-slate-500">
                    {activity.activity_type} · {formatDateTime(activity.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {sendCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-soft">
            <div className="border-b border-border p-5">
              <h2 className="text-lg font-semibold text-slate-950">Final Send Confirmation</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                This message will be sent through Gmail.
              </p>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="text-sm font-medium text-slate-500">Recipient</p>
                <p className="mt-1 text-sm text-slate-950">{leadState.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Subject</p>
                <p className="mt-1 text-sm text-slate-950">{sendCandidate.subject}</p>
              </div>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-slate-50 p-4 text-sm text-slate-800">
                {sendCandidate.body}
              </pre>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setSendCandidate(null)}>
                  Cancel
                </Button>
                <Button onClick={confirmSend}>Send with Gmail</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EligibilityBadge({
  blocked,
  initial,
  followUp
}: {
  blocked: boolean;
  initial: { allowed: boolean; reason?: string };
  followUp: { allowed: boolean; reason?: string };
}) {
  const allowed = !blocked && (initial.allowed || followUp.allowed);
  return (
    <Badge
      className={cn(
        allowed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"
      )}
      title={allowed ? "Outreach action available" : initial.reason ?? followUp.reason}
    >
      {allowed ? "Eligible" : "Not eligible"}
    </Badge>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function initialBody(lead: Lead, settings: AppSettings) {
  const issue = lead.observed_website_issues[0] ?? lead.issue_details;
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  const issueSentence = issue
    ? `I noticed ${lead.business_name} has ${issue.toLowerCase()}.`
    : `I came across ${lead.business_name}.`;
  return `${greeting}\n\n${issueSentence} I run ${settings.agency_name} and build simple websites for local businesses. I thought a cleaner homepage could make it easier for customers to take the next step. I would be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. ${mandatoryOptOutSentence}\n\nBest,\n${settings.sender_name}\n${settings.agency_name}`;
}

function followUpBody(lead: Lead, settings: AppSettings) {
  const greeting = lead.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  return `${greeting}\n\nJust wanted to follow up on my note about a complimentary homepage mockup for ${lead.business_name}. If it would be useful, I can send over a simple direction before a short 10-15 minute call. If now is not a fit, no worries.\n\nBest,\n${settings.sender_name}`;
}
