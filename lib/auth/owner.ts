import { cache } from "react";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type OwnerContext = {
  id: string;
  email: string;
  demo: boolean;
};

export const getOwnerContext = cache(async (): Promise<OwnerContext> => {
  const ownerEmail = process.env.OWNER_EMAIL;

  if (!isSupabaseConfigured()) {
    return {
      id: "demo-owner",
      email: ownerEmail ?? "owner@example.com",
      demo: true
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new Error("Unauthorized");
  }
  if (!ownerEmail) {
    throw new Error("OWNER_EMAIL must be configured.");
  }
  if (user.email.toLowerCase() !== ownerEmail.toLowerCase()) {
    throw new Error("This app is restricted to the configured owner account.");
  }

  return {
    id: user.id,
    email: user.email,
    demo: false
  };
});

export function isOwnerEmail(email: string | null | undefined) {
  const ownerEmail = process.env.OWNER_EMAIL;
  return Boolean(email && ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase());
}
