"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { safeTemplateVariables } from "@/lib/constants";
import { missingVariables, renderTemplate, validateTemplate, type TemplateContext } from "@/lib/email/templates";
import type { AppSettings, Template, TemplateType } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const templateLabels: Record<TemplateType, string> = {
  initial: "Initial email template",
  follow_up: "Follow-up email template",
  signature: "Signature",
  cta: "CTA"
};

export function TemplateManager({ templates, settings }: { templates: Template[]; settings: AppSettings }) {
  const [selected, setSelected] = useState<TemplateType>("initial");
  const [drafts, setDrafts] = useState<Record<TemplateType, string>>(
    Object.fromEntries(templates.map((template) => [template.template_type, template.content])) as Record<TemplateType, string>
  );
  const [message, setMessage] = useState("");
  const content = drafts[selected] ?? "";
  const validation = validateTemplate(content, selected);
  const previewContext: TemplateContext = useMemo(
    () => ({
      business_name: "Maple Street Bakery",
      contact_name: "Avery",
      industry: "Bakery",
      location: "Fairview, OH",
      website_issue: "missing calls to action",
      agency_name: settings.agency_name,
      sender_name: settings.sender_name,
      agency_website: settings.agency_website,
      portfolio_link: settings.portfolio_link,
      calendly_link: settings.calendly_link
    }),
    [
      settings.agency_name,
      settings.agency_website,
      settings.calendly_link,
      settings.portfolio_link,
      settings.sender_name
    ]
  );
  const missing = useMemo(() => missingVariables(content, previewContext), [content, previewContext]);
  const preview = renderTemplate(content, previewContext);

  function saveTemplate() {
    if (!validation.valid) return;
    setMessage(`${templateLabels[selected]} saved in this workspace session.`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(templateLabels) as TemplateType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelected(type);
                  setMessage("");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium",
                  selected === type ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                {templateLabels[type]}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {safeTemplateVariables.map((variable) => (
              <Badge key={variable} className="border-slate-200 bg-slate-50 text-slate-700">
                {`{{${variable}}}`}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{templateLabels[selected]}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Changes are validated before saving.</p>
            </div>
            <Button onClick={saveTemplate} disabled={!validation.valid}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
                {message}
              </p>
            )}
            <Textarea
              value={content}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected]: event.target.value
                }))
              }
              className="min-h-72 font-mono text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {validation.errors.map((error) => (
                <Badge key={error} className="border-red-200 bg-red-50 text-red-800">
                  {error}
                </Badge>
              ))}
              {missing.map((variable) => (
                <Badge key={variable} className="border-amber-200 bg-amber-50 text-amber-800">
                  Missing sample value: {variable}
                </Badge>
              ))}
              {validation.valid && missing.length === 0 && (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Ready</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-slate-50 p-4 text-sm leading-6 text-slate-800">
              {preview}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
