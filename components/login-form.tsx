"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ allowedEmails }: { allowedEmails: string[] }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const callbackError = searchParams.get("error");
    const errorMessage = callbackErrorMessage(callbackError);
    if (errorMessage) setMessage(errorMessage);
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!allowedEmails.includes(normalizedEmail)) {
      setMessage("Only the Digital Web Elevate Gmail account can access this workspace.");
      return;
    }

    if (!supabase) {
      setMessage("Demo mode is active because Supabase env vars are not configured.");
      return;
    }
    setPending(true);
    const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${redirectBase}/auth/callback?next=${encodeURIComponent(searchParams.get("next") ?? "/")}`
      }
    });
    setPending(false);
    setMessage(error ? `Magic link could not be sent: ${error.message}` : "Check your email for the sign-in link.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      {message && (
        <p className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">
          {message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Send magic link
      </Button>
    </form>
  );
}

function callbackErrorMessage(error: string | null) {
  if (error === "not-allowed") return "Only the Digital Web Elevate Gmail account can access this workspace.";
  if (error === "no-user") return "The sign-in link did not return a user. Try again.";
  if (error === "auth-callback") return "The sign-in link could not be verified. Try again.";
  return null;
}
