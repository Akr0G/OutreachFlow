import { cache } from "react";
import { createSupabaseAdminClient, createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type OwnerContext = {
  id: string;
  email: string;
  demo: boolean;
};

let localWorkspaceOwnerPromise: Promise<OwnerContext> | null = null;

export const getOwnerContext = cache(async (): Promise<OwnerContext> => {
  if (!isSupabaseConfigured()) {
    return {
      id: "demo-owner",
      email: "owner@example.com",
      demo: true
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (!error && user?.email) {
    return {
      id: user.id,
      email: user.email,
      demo: false
    };
  }

  return resolveLocalWorkspaceOwner();
});

async function resolveLocalWorkspaceOwner(): Promise<OwnerContext> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role key is required when login is disabled.");
  }

  localWorkspaceOwnerPromise ??= loadLocalWorkspaceOwner();
  return localWorkspaceOwnerPromise;
}

async function loadLocalWorkspaceOwner(): Promise<OwnerContext> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;

  const user = data.users[0];
  if (!user?.email) {
    throw new Error("Create at least one Supabase Auth user before using the workspace without login.");
  }

  return {
    id: user.id,
    email: user.email,
    demo: false
  };
}
