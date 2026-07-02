"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Demo mode is active because Supabase env vars are not configured.");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    setPending(false);
    setMessage(error ? "Magic link could not be sent." : "Check your email for the sign-in link.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label>Owner email</Label>
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
