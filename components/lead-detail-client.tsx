"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { observedWebsiteIssues, replyCategories } from "@/lib/constants";
import {
  canCreateFollowUpDraft,
  canCreateInitialDraft,
  canSendDraft,
  statusForReplyCategory
} from "@/lib/business-rules";
import { scoreLeadWebsite } from "@/lib/research/website-score";
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
  const router = useRouter();
  const autoDraftAttempted = useRef(false);
  const [leadState, setLeadState] = useState(lead);
  const [draftState, setDraftState] = useState(drafts);
  const [replyState, setReplyState] = useState(replies);
  const [activityState, setActivityState] = useState(activities);
  const [sendCandidate, setSendCandidate] = useState<EmailDraft | null>(null);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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

  async function generateDraft(type: EmailDraft["draft_type"], options: { automatic?: boolean } = {}) {
    const eligibility =
      type === "initial"
        ? canCreateInitialDraft(leadState)
        : canCreateFollowUpDraft(leadState, draftState, new Date("2026-07-02T12:00:00.000Z"), settings.follow_up_delay_days);
    if (!eligibility.allowed) {
      setMessage(eligibility.reason ?? "Draft cannot be created.");
      return;
    }

    setPendingAction(`generate:${type}`);
    try {
      const response = await fetch("/api/ai/generate-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadState.id, draft_type: type })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Draft could not be created.");

      const draft = body.draft as EmailDraft;
      setDraftState((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
      if (type === "initial") updateLeadField("status", "Draft Created");
      appendActivity(type === "initial" ? "Draft created" : "Follow-up created", type === "initial" ? "Initial draft created" : "Follow-up draft created", { subject: draft.subject });
      setMessage(options.automatic ? "Initial draft automatically saved for review." : `${type === "initial" ? "Initial" : "Follow-up"} draft saved for review.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft could not be created.");
    } finally {
      setPendingAction(null);
    }
  }

  function updateDraft(id: string, updates: Partial<EmailDraft>) {
    setDraftState((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...updates, updated_at: new Date().toISOString() } : draft))
    );
  }

  async function approveDraft(draft: EmailDraft) {
    setPendingAction(`approve:${draft.id}`);
    try {
      const saved = await persistDraft(draft, { state: "approved" });
      appendActivity("Draft approved", "Draft approved", { subject: saved.subject });
      setMessage("Draft approved and saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft could not be approved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteDraft(draft: EmailDraft) {
    setPendingAction(`delete:${draft.id}`);
    try {
      const saved = await persistDraft(draft, { state: "deleted" });
      appendActivity("Draft deleted", "Draft deleted", { subject: saved.subject });
      setMessage("Draft deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft could not be deleted.");
    } finally {
      setPendingAction(null);
    }
  }

  function requestSend(draft: EmailDraft) {
    const result = canSendDraft(leadState, draft, settings, 0);
    if (!result.allowed) {
      setMessage(result.reason ?? "Draft cannot be sent.");
      return;
    }
    setSendCandidate(draft);
  }

  async function confirmSend() {
    if (!sendCandidate) return;
    const latestDraft = draftState.find((draft) => draft.id === sendCandidate.id) ?? sendCandidate;
    setPendingAction(`send:${latestDraft.id}`);
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft_id: latestDraft.id,
          final_confirmation: true,
          subject: latestDraft.subject,
          body: latestDraft.body
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Email could not be sent.");

      if (body.draft) replaceDraft(body.draft as EmailDraft);
      if (body.lead) setLeadState(body.lead as Lead);
      appendActivity("Email sent", `${latestDraft.draft_type === "initial" ? "Initial" : "Follow-up"} email sent through Gmail`, {
        subject: latestDraft.subject,
        gmail_message_id: body.messageId
      });
      setSendCandidate(null);
      setMessage("Email sent through Gmail.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email could not be sent.");
    } finally {
      setPendingAction(null);
    }
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

  async function deleteLead() {
    if (!window.confirm(`Delete ${leadState.business_name}? This also removes its drafts, replies, and activity history.`)) return;
    setPendingAction("delete-lead");
    try {
      const response = await fetch(`/api/leads/${leadState.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Lead could not be deleted.");
      router.push("/leads");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lead could not be deleted.");
      setPendingAction(null);
    }
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

  async function overrideReply(id: string, category: ReplyCategory) {
    const previousReplies = replyState;
    const previousLead = leadState;
    const updatedAt = new Date().toISOString();

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
    setLeadState((current) => ({
      ...current,
      status: statusForReplyCategory(category),
      last_activity_at: updatedAt,
      updated_at: updatedAt
    }));

    try {
      const response = await fetch(`/api/replies/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classification: category })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Reply classification could not be saved.");

      if (body.reply) {
        setReplyState((current) => current.map((reply) => (reply.id === id ? { ...reply, ...body.reply } : reply)));
      }
      if (body.lead) {
        setLeadState((current) => ({ ...current, ...body.lead }));
      }
      appendActivity("Reply classified", `Reply classified as ${category}`, { manual: true });
      setMessage("Reply classification saved.");
    } catch (error) {
      setReplyState(previousReplies);
      setLeadState(previousLead);
      setMessage(error instanceof Error ? error.message : "Reply classification could not be saved.");
    }
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

  function replaceDraft(updatedDraft: EmailDraft) {
    setDraftState((current) => current.map((draft) => (draft.id === updatedDraft.id ? updatedDraft : draft)));
  }

  async function persistDraft(draft: EmailDraft, updates: Partial<EmailDraft>) {
    const response = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: updates.subject ?? draft.subject,
        body: updates.body ?? draft.body,
        state: updates.state ?? draft.state,
        gmail_draft_id: updates.gmail_draft_id ?? draft.gmail_draft_id,
        gmail_message_id: updates.gmail_message_id ?? draft.gmail_message_id
      })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Draft could not be saved.");
    const saved = { ...draft, ...body.draft } as EmailDraft;
    replaceDraft(saved);
    return saved;
  }

  const activeDrafts = useMemo(() => draftState.filter((draft) => draft.state !== "deleted"), [draftState]);
  const hasInitialDraft = activeDrafts.some((draft) => draft.draft_type === "initial");
  const websiteScore = scoreLeadWebsite(leadState);

  useEffect(() => {
    if (autoDraftAttempted.current || hasInitialDraft || !initialEligibility.allowed || pendingAction) return;
    autoDraftAttempted.current = true;
    void generateDraft("initial", { automatic: true });
    // Auto-draft should only evaluate the lead's opening state once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialDraft, initialEligibility.allowed, pendingAction]);

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
            <Badge className={websiteTierClassName(websiteScore.tier)}>
              Tier {websiteScore.tier}: {websiteScore.label}
            </Badge>
            <EligibilityBadge blocked={outreachBlocked} initial={initialEligibility} followUp={followUpEligibility} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => generateDraft("initial")} disabled={!initialEligibility.allowed || Boolean(pendingAction)}>
            <MailPlus className="h-4 w-4" aria-hidden="true" />
            Initial Draft
          </Button>
          <Button variant="secondary" onClick={() => generateDraft("follow_up")} disabled={!followUpEligibility.allowed || Boolean(pendingAction)}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Follow-Up
          </Button>
          <Button variant="danger" onClick={() => markStatus("Do Not Contact")} disabled={Boolean(pendingAction)}>
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
            Do Not Contact
          </Button>
          <Button variant="danger" onClick={deleteLead} disabled={Boolean(pendingAction)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Lead
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
            <div className="rounded-md border border-border bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-950">Website tier: {websiteScore.tier} - {websiteScore.label}</p>
              <p className="mt-1">{websiteScore.summary}</p>
            </div>
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
                      <Button variant="secondary" size="sm" onClick={() => approveDraft(draft)} disabled={draft.state === "approved" || Boolean(pendingAction)}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Approve
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => requestSend(draft)} disabled={draft.state !== "approved" || Boolean(pendingAction)}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Send
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => deleteDraft(draft)} disabled={Boolean(pendingAction)}>
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
                    onChange={(event) => void overrideReply(reply.id, event.target.value as ReplyCategory)}
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
                <Button onClick={confirmSend} disabled={pendingAction === `send:${sendCandidate.id}`}>
                  Send with Gmail
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function websiteTierClassName(tier: number) {
  if (tier === 3) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tier === 2) return "border-sky-200 bg-sky-50 text-sky-800";
  if (tier === 1) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
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
