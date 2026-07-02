import { notFound } from "next/navigation";
import { LeadDetailClient } from "@/components/lead-detail-client";
import { getLeadBundle, getSettings } from "@/lib/supabase/repository";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, drafts, replies, activities }, settings] = await Promise.all([
    getLeadBundle(id),
    getSettings()
  ]);

  if (!lead) notFound();

  return (
    <LeadDetailClient
      lead={lead}
      drafts={drafts}
      replies={replies}
      activities={activities}
      settings={settings}
    />
  );
}
