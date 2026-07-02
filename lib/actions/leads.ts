"use server";

import { revalidatePath } from "next/cache";
import { getOwnerContext } from "@/lib/auth/owner";
import { leadInputSchema } from "@/lib/schemas";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ActionState = {
  ok: boolean;
  message: string;
  id?: string;
  errors?: Record<string, string[]>;
};

export async function createLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = leadInputSchema.safeParse({
    business_name: formData.get("business_name"),
    contact_name: formData.get("contact_name"),
    email: formData.get("email"),
    website_url: formData.get("website_url"),
    industry: formData.get("industry"),
    location: formData.get("location"),
    observed_website_issues: formData.getAll("observed_website_issues"),
    issue_details: formData.get("issue_details"),
    notes: formData.get("notes"),
    status: formData.get("status") || "Ready",
    date_contacted: formData.get("date_contacted"),
    follow_up_count: formData.get("follow_up_count") || 0
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors
    };
  }

  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      message: "Lead validated and ready in demo mode.",
      id: crypto.randomUUID()
    };
  }

  const owner = await getOwnerContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...parsed.data,
      owner_id: owner.id,
      status: parsed.data.status ?? "Ready",
      last_activity_at: now,
      created_at: now,
      updated_at: now
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: "Lead could not be saved." };
  }

  await supabase.from("activities").insert({
    owner_id: owner.id,
    lead_id: data.id,
    activity_type: "Lead created",
    description: `${parsed.data.business_name} added`,
    metadata: {},
    created_at: now
  });

  revalidatePath("/leads");
  return { ok: true, message: "Lead added.", id: data.id };
}
