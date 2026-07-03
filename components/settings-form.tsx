"use client";

import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { KeyRound, Link2Off, Mail, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppSettings } from "@/lib/types";

export function SettingsForm({
  settings,
  ownerEmail,
  gmailOAuthConfigured,
  gmailStatus
}: {
  settings: AppSettings;
  ownerEmail: string;
  gmailOAuthConfigured: boolean;
  gmailStatus?: string;
}) {
  const [form, setForm] = useState(settings);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const gmailConnected = Boolean(form.gmail_connection_metadata?.connected);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveOpenAiKey() {
    setMessage("");
    const response = await fetch("/api/settings/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey })
    });
    if (response.ok) {
      setApiKey("");
      setMessage("OpenAI connection saved.");
    } else {
      setMessage("OpenAI key could not be saved.");
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_name: form.sender_name,
        sender_email: form.sender_email,
        agency_name: form.agency_name,
        agency_website: form.agency_website,
        portfolio_link: form.portfolio_link,
        calendly_link: form.calendly_link,
        daily_send_limit: form.daily_send_limit,
        follow_up_delay_days: form.follow_up_delay_days
      })
    });
    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setMessage(body?.error ?? "Settings could not be saved.");
      return;
    }

    if (body?.settings) {
      setForm((current) => ({
        ...current,
        ...body.settings
      }));
    }
    setMessage(body?.demo ? "Settings validated in demo mode." : "Settings saved.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Agency Settings</CardTitle>
          <Button type="button" onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? "Saving" : "Save"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {message && (
            <p className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">
              {message}
            </p>
          )}
          {gmailStatus && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
              {gmailStatusMessage(gmailStatus)}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sender name">
              <Input value={form.sender_name} onChange={(event) => update("sender_name", event.target.value)} />
            </Field>
            <Field label="Sender email">
              <Input value={form.sender_email} onChange={(event) => update("sender_email", event.target.value)} />
            </Field>
            <Field label="Agency name">
              <Input value={form.agency_name} onChange={(event) => update("agency_name", event.target.value)} />
            </Field>
            <Field label="Agency website">
              <Input value={form.agency_website ?? ""} onChange={(event) => update("agency_website", event.target.value || null)} />
            </Field>
            <Field label="Portfolio link">
              <Input value={form.portfolio_link ?? ""} onChange={(event) => update("portfolio_link", event.target.value || null)} />
            </Field>
            <Field label="Calendly link">
              <Input value={form.calendly_link ?? ""} onChange={(event) => update("calendly_link", event.target.value || null)} />
            </Field>
            <Field label="Daily send limit">
              <Input
                type="number"
                min={1}
                max={20}
                value={form.daily_send_limit}
                onChange={(event) => update("daily_send_limit", Number(event.target.value))}
              />
            </Field>
            <Field label="Default follow-up delay">
              <Input
                type="number"
                min={1}
                max={30}
                value={form.follow_up_delay_days}
                onChange={(event) => update("follow_up_delay_days", Number(event.target.value))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ConnectionRow
              icon={KeyRound}
              title="OpenAI"
              status={form.encrypted_openai_key_reference ? "Connected" : "Not connected"}
            />
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="OpenAI API key"
                autoComplete="off"
              />
              <Button type="button" variant="secondary" onClick={saveOpenAiKey} disabled={!apiKey}>
                Save
              </Button>
            </div>
            <ConnectionRow
              icon={Mail}
              title="Gmail"
              status={
                gmailConnected
                  ? form.gmail_connection_metadata?.email ?? "Connected"
                  : gmailOAuthConfigured
                    ? "Not connected"
                    : "OAuth not configured"
              }
            />
            <div className="flex flex-wrap gap-2">
              {gmailOAuthConfigured ? (
                <a
                  href="/api/gmail/oauth/start"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Connect Gmail
                </a>
              ) : (
                <Button type="button" variant="secondary" disabled>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Connect Gmail
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setMessage("Gmail connection removed in this workspace session.")}>
                <Link2Off className="h-4 w-4" aria-hidden="true" />
                Disconnect Gmail
              </Button>
            </div>
            {!gmailOAuthConfigured && (
              <p className="text-sm text-slate-600">
                Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to .env.local, then restart the server.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConnectionRow
              icon={ShieldCheck}
              title="Workspace owner"
              status={ownerEmail}
            />
            <ConnectionRow
              icon={ShieldCheck}
              title="Daily hard limit"
              status={`${form.daily_send_limit} sends per day`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function gmailStatusMessage(status: string) {
  switch (status) {
    case "not-configured":
      return "Gmail OAuth is not configured yet. Add the Google OAuth client values to .env.local and restart the server.";
    case "invalid-state":
      return "Gmail connection expired or the browser state did not match. Try connecting again.";
    case "missing-refresh-token":
      return "Google did not return a refresh token. Remove the app from your Google account access list, then connect again.";
    case "demo-connected":
      return "Gmail OAuth completed in demo mode. Connect Supabase to persist the connection.";
    case "connected":
      return "Gmail connected.";
    case "connection-failed":
      return "Gmail connection failed. Start Connect Gmail again; do not refresh the Google callback page.";
    default:
      return "Gmail connection needs attention.";
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ConnectionRow({
  icon: Icon,
  title,
  status
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-900">{title}</p>
      </div>
      <p className="text-sm text-slate-600">{status}</p>
    </div>
  );
}
