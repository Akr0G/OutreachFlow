import { cache } from "react";
import { redirect } from "next/navigation";
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
    assertAllowedOwnerEmail(user.email);
    return {
      id: user.id,
      email: user.email,
      demo: false
    };
  }

  if (process.env.ALLOW_LOCAL_WORKSPACE_OWNER !== "true") {
    redirect("/login");
  }

  return resolveLocalWorkspaceOwner();
});

export function getAllowedOwnerEmails() {
  return (process.env.ALLOWED_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAllowedOwnerEmail(email: string) {
  const allowedEmails = getAllowedOwnerEmails();
  if (allowedEmails.length === 0) {
    throw new Error("ALLOWED_OWNER_EMAILS must be configured before using this workspace.");
  }
  if (!allowedEmails.includes(email.trim().toLowerCase())) {
    throw new Error("This email is not allowed to access this workspace.");
  }
}

async function resolveLocalWorkspaceOwner(): Promise<OwnerContext> {
  if (process.env.ALLOW_LOCAL_WORKSPACE_OWNER !== "true") {
    throw new Error("Sign in with the allowed workspace email to access OutreachFlow.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role key is required when login is disabled.");
  }

  localWorkspaceOwnerPromise ??= loadLocalWorkspaceOwner();
  return localWorkspaceOwnerPromise;
}

async function loadLocalWorkspaceOwner(): Promise<OwnerContext> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;

  const allowedEmails = getAllowedOwnerEmails();
  if (allowedEmails.length === 0) {
    throw new Error("ALLOWED_OWNER_EMAILS must be configured before using this workspace.");
  }
  const user = data.users.find((candidate: { email?: string | null }) =>
    candidate.email ? allowedEmails.includes(candidate.email.toLowerCase()) : false
  );

  if (!user?.email) {
    throw new Error(`Create a Supabase Auth user for ${allowedEmails.join(", ")} before using the workspace.`);
  }

  return {
    id: user.id,
    email: user.email,
    demo: false
  };
}
