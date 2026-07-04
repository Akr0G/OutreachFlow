import { getOwnerContext } from "@/lib/auth/owner";
import {
  getActivitiesForLead,
  getDraftsForLead,
  getLeadById,
  getRepliesForLead,
  sampleActivities,
  sampleDrafts,
  sampleLeads,
  sampleNotifications,
  sampleReplies,
  sampleSettings,
  sampleTemplates
} from "@/lib/sample-data";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/pagination";
import type { Activity, AppSettings, EmailDraft, Lead, Notification, Reply, Template } from "@/lib/types";

export type RawSettings = AppSettings & {
  encrypted_gmail_refresh_token?: string | null;
};

export async function listLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured()) return sampleLeads;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  return fetchAllPages<Lead>((from, to) =>
    supabase
      .from("leads")
      .select("*")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function getLead(id: string): Promise<Lead | null> {
  if (!isSupabaseConfigured()) return getLeadById(id);
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase.from("leads").select("*").eq("owner_id", owner.id).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Lead | null;
}

export async function getLeadBundle(id: string): Promise<{
  lead: Lead | null;
  drafts: EmailDraft[];
  replies: Reply[];
  activities: Activity[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      lead: getLeadById(id),
      drafts: getDraftsForLead(id),
      replies: getRepliesForLead(id),
      activities: getActivitiesForLead(id)
    };
  }

  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const [leadResult, draftsResult, repliesResult, activitiesResult] = await Promise.all([
    supabase.from("leads").select("*").eq("owner_id", owner.id).eq("id", id).maybeSingle(),
    supabase.from("email_drafts").select("*").eq("owner_id", owner.id).eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("replies").select("*").eq("owner_id", owner.id).eq("lead_id", id).order("received_at", { ascending: false }),
    supabase.from("activities").select("*").eq("owner_id", owner.id).eq("lead_id", id).order("created_at", { ascending: false })
  ]);
  for (const result of [leadResult, draftsResult, repliesResult, activitiesResult]) {
    if (result.error) throw result.error;
  }
  return {
    lead: leadResult.data as Lead | null,
    drafts: draftsResult.data as EmailDraft[],
    replies: repliesResult.data as Reply[],
    activities: activitiesResult.data as Activity[]
  };
}

export async function listDrafts(): Promise<EmailDraft[]> {
  if (!isSupabaseConfigured()) return sampleDrafts;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  return fetchAllPages<EmailDraft>((from, to) =>
    supabase
      .from("email_drafts")
      .select("*")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function listReplies(): Promise<Reply[]> {
  if (!isSupabaseConfigured()) return sampleReplies;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  return fetchAllPages<Reply>((from, to) =>
    supabase
      .from("replies")
      .select("*")
      .eq("owner_id", owner.id)
      .order("received_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function listActivities(): Promise<Activity[]> {
  if (!isSupabaseConfigured()) return sampleActivities;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase.from("activities").select("*").eq("owner_id", owner.id).order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data as Activity[];
}

export async function listNotifications(): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return sampleNotifications;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("owner_id", owner.id)
    .is("read_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Notification[];
}

export async function listTemplates(): Promise<Template[]> {
  if (!isSupabaseConfigured()) return sampleTemplates;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase.from("templates").select("*").eq("owner_id", owner.id).order("template_type");
  if (error) throw error;
  return data as Template[];
}

export async function getSettings(): Promise<AppSettings> {
  if (!isSupabaseConfigured()) return sampleSettings;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase.from("settings").select("*").eq("owner_id", owner.id).maybeSingle();
  if (error) throw error;
  if (!data) return sampleSettings;
  return {
    ...data,
    encrypted_openai_key_reference: data.encrypted_openai_key_reference ? "connected" : null,
    gmail_connection_metadata: data.gmail_connection_metadata as AppSettings["gmail_connection_metadata"]
  } as AppSettings;
}

export async function getRawSettings(): Promise<RawSettings> {
  if (!isSupabaseConfigured()) return sampleSettings;
  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase.from("settings").select("*").eq("owner_id", owner.id).maybeSingle();
  if (error) throw error;
  if (!data) return sampleSettings;
  return {
    ...data,
    gmail_connection_metadata: data.gmail_connection_metadata as AppSettings["gmail_connection_metadata"]
  } as RawSettings;
}
