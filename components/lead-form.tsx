"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { observedWebsiteIssues, leadStatuses } from "@/lib/constants";
import { createLeadAction, type ActionState } from "@/lib/actions/leads";
import { leadInputSchema, type LeadInput } from "@/lib/schemas";
import { cn } from "@/lib/utils/cn";

const initialState: ActionState = {
  ok: false,
  message: ""
};

export function LeadForm() {
  const [serverState, setServerState] = useState<ActionState>(initialState);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LeadInput>({
    resolver: zodResolver(leadInputSchema),
    defaultValues: {
      business_name: "",
      contact_name: null,
      email: "",
      website_url: null,
      industry: null,
      location: null,
      observed_website_issues: [],
      issue_details: null,
      notes: null,
      status: "Ready",
      date_contacted: null,
      follow_up_count: 0
    }
  });

  function onSubmit(data: LeadInput) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(key, item));
      } else {
        formData.append(key, value == null ? "" : String(value));
      }
    }

    startTransition(async () => {
      const nextState = await createLeadAction(serverState, formData);
      setServerState(nextState);
      if (nextState.ok) reset();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverState.message && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border p-3 text-sm",
            serverState.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          )}
          role="status"
        >
          {serverState.ok && <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />}
          <span>{serverState.message}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Business name" error={errors.business_name?.message}>
          <Input {...register("business_name")} autoComplete="organization" />
        </Field>
        <Field label="Contact name" error={errors.contact_name?.message}>
          <Input {...register("contact_name")} autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} autoComplete="email" />
        </Field>
        <Field label="Website link" error={errors.website_url?.message}>
          <Input type="url" {...register("website_url")} placeholder="https://example.com" />
        </Field>
        <Field label="Industry" error={errors.industry?.message}>
          <Input {...register("industry")} />
        </Field>
        <Field label="Location" error={errors.location?.message}>
          <Input {...register("location")} />
        </Field>
        <Field label="Outreach status" error={errors.status?.message}>
          <select
            {...register("status")}
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          >
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date contacted" error={errors.date_contacted?.message}>
          <Input type="date" {...register("date_contacted")} />
        </Field>
        <Field label="Follow-up count" error={errors.follow_up_count?.message}>
          <Input type="number" min={0} max={1} {...register("follow_up_count", { valueAsNumber: true })} />
        </Field>
      </div>

      <div className="space-y-3">
        <Label>Observed website issues</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {observedWebsiteIssues.map((issue) => (
            <label
              key={issue}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                value={issue}
                {...register("observed_website_issues")}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>{issue}</span>
            </label>
          ))}
        </div>
      </div>

      <Field label="Observed issue details" error={errors.issue_details?.message}>
        <Textarea {...register("issue_details")} />
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register("notes")} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save lead
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </label>
  );
}
