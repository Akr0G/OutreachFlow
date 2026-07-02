import Link from "next/link";
import { CheckCircle2, ExternalLink, PencilLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { listDrafts, listLeads } from "@/lib/supabase/repository";
import { formatDateTime } from "@/lib/utils/format";

export default async function DraftsPage() {
  const [drafts, leads] = await Promise.all([listDrafts(), listLeads()]);
  const leadLookup = new Map(leads.map((lead) => [lead.id, lead]));
  const activeDrafts = drafts.filter((draft) => draft.state !== "deleted");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Drafts</h1>
        <p className="mt-1 text-sm text-slate-600">Review, edit, approve, or send from each lead page.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeDrafts.map((draft) => {
          const lead = leadLookup.get(draft.lead_id);
          return (
            <Card key={draft.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>{draft.subject}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">{lead?.business_name ?? "Unknown lead"}</p>
                </div>
                <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                  {draft.state.replace("_", " ")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-700">{draft.body}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{draft.draft_type === "initial" ? "Initial" : "Follow-up"} draft</span>
                  <span>{formatDateTime(draft.updated_at)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lead && (
                    <Link href={`/leads/${lead.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                      Review
                    </Link>
                  )}
                  {draft.state === "approved" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Approved
                    </span>
                  )}
                  {draft.gmail_draft_id && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Gmail draft saved
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {activeDrafts.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-slate-500">No active drafts are awaiting review.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
