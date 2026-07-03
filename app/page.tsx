import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Bell,
  Clock3,
  FilePenLine,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Upload,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { leadStatuses } from "@/lib/constants";
import { canCreateFollowUpDraft } from "@/lib/business-rules";
import {
  listActivities,
  listDrafts,
  listLeads,
  listNotifications,
  listReplies,
  getSettings
} from "@/lib/supabase/repository";
import { formatDateTime } from "@/lib/utils/format";

export default async function DashboardPage() {
  const [leads, drafts, replies, activities, notifications, settings] = await Promise.all([
    listLeads(),
    listDrafts(),
    listReplies(),
    listActivities(),
    listNotifications(),
    getSettings()
  ]);

  const stats = [
    { label: "Total leads", value: leads.length, icon: Users },
    {
      label: "Drafts awaiting review",
      value: drafts.filter((draft) => draft.state === "awaiting_review").length,
      icon: FilePenLine
    },
    { label: "Emails sent", value: drafts.filter((draft) => draft.state === "sent").length, icon: Send },
    { label: "Replies received", value: replies.length, icon: MessageSquare },
    { label: "Interested leads", value: leads.filter((lead) => lead.status === "Interested").length, icon: Bell },
    { label: "Unsubscribes", value: leads.filter((lead) => lead.status === "Unsubscribed").length, icon: Mail }
  ];

  const followUpsDue = leads.filter((lead) =>
    canCreateFollowUpDraft(
      lead,
      drafts.filter((draft) => draft.lead_id === lead.id),
      new Date("2026-07-02T12:00:00.000Z"),
      settings.follow_up_delay_days
    ).allowed
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Thoughtful outreach, one lead at a time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction href="/research" icon={Search} label="Research" />
          <QuickAction href="/leads/new" icon={Plus} label="Add Lead" />
          <QuickAction href="/import" icon={Upload} label="Import CSV" />
          <QuickAction href="/drafts" icon={FilePenLine} label="View Drafts" />
          <QuickAction href="/api/gmail/sync" icon={RefreshCw} label="Sync Replies" />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Outreach summary">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{stat.value}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Outreach Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leadStatuses.map((status) => {
                const count = leads.filter((lead) => lead.status === status).length;
                const percent = leads.length ? Math.round((count / leads.length) * 100) : 0;
                return (
                  <div key={status} className="grid gap-2 md:grid-cols-[150px_1fr_52px] md:items-center">
                    <StatusBadge status={status} />
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-teal-600" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="text-right text-sm font-medium text-slate-700">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interested Replies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notifications.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-slate-50 p-4 text-sm text-slate-500">
                No unread interested replies.
              </p>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.lead_id ? `/leads/${notification.lead_id}` : "/leads"}
                  className="block rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm hover:bg-emerald-100"
                >
                  <p className="font-medium text-emerald-950">{notification.title}</p>
                  <p className="mt-1 text-emerald-800">{notification.message}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Follow-Ups Due Soon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUpsDue.length === 0 ? (
              <p className="text-sm text-slate-500">No eligible follow-ups today.</p>
            ) : (
              followUpsDue.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{lead.business_name}</span>
                    <span className="text-xs text-slate-500">{lead.email}</span>
                  </span>
                  <Clock3 className="h-4 w-4 text-teal-700" aria-hidden="true" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {activities.slice(0, 8).map((activity) => (
                <li key={activity.id} className="grid grid-cols-[24px_1fr] gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                    <p className="text-xs text-slate-500">
                      {activity.activity_type} · {formatDateTime(activity.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
}) {
  return (
    <Link href={href} className={buttonClasses({ variant: "secondary", size: "sm" })}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
