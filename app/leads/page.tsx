import Link from "next/link";
import { Plus } from "lucide-react";
import { LeadTable } from "@/components/lead-table";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { listDrafts, listLeads } from "@/lib/supabase/repository";

export default async function LeadsPage() {
  const [leads, drafts] = await Promise.all([listLeads(), listDrafts()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Leads</h1>
          <p className="mt-1 text-sm text-slate-600">Search, filter, and review local-business outreach records.</p>
        </div>
        <Link href="/leads/new" className={buttonClasses({ variant: "primary" })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Lead
        </Link>
      </div>

      <Card>
        <CardContent>
          <LeadTable leads={leads} drafts={drafts} />
        </CardContent>
      </Card>
    </div>
  );
}
