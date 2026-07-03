"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, MapPin, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResearchCandidate } from "@/lib/types";

type CandidateState = ResearchCandidate & {
  importEmail: string;
  importContactName: string;
  importMessage?: string;
  importedLeadId?: string;
};

export function ResearchClient() {
  const [businessType, setBusinessType] = useState("dentists");
  const [location, setLocation] = useState("near me");
  const [limit, setLimit] = useState(5);
  const [includeWebsiteResearch, setIncludeWebsiteResearch] = useState(true);
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function searchCandidates() {
    setLoading(true);
    setMessage("");
    setCandidates([]);
    try {
      const response = await fetch("/api/research/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_type: businessType,
          location,
          limit,
          include_website_research: includeWebsiteResearch
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Research search failed.");
      setCandidates(
        body.candidates.map((candidate: ResearchCandidate) => ({
          ...candidate,
          importEmail: candidate.email ?? "",
          importContactName: candidate.contact_name ?? ""
        }))
      );
      setMessage(body.source === "demo" ? "Demo candidates loaded. Add a Places API key for live local search." : "Research candidates loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Research search failed.");
    } finally {
      setLoading(false);
    }
  }

  function updateCandidate(id: string, updates: Partial<CandidateState>) {
    setCandidates((current) => current.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  }

  async function importCandidate(candidate: CandidateState) {
    updateCandidate(candidate.id, { importMessage: "" });
    try {
      const response = await fetch("/api/research/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_name: candidate.business_name,
          contact_name: candidate.importContactName || null,
          email: candidate.importEmail,
          website_url: candidate.website_url,
          industry: candidate.industry,
          location: candidate.location,
          observed_website_issues: candidate.observed_website_issues,
          issue_details: candidate.issue_details,
          notes: appendResearchNotes(candidate)
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Lead could not be added.");
      updateCandidate(candidate.id, {
        importMessage: body.message,
        importedLeadId: body.demo ? undefined : body.lead_id
      });
    } catch (error) {
      updateCandidate(candidate.id, {
        importMessage: error instanceof Error ? error.message : "Lead could not be added."
      });
    }
  }

  const resultCount = useMemo(() => candidates.length, [candidates]);

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Local Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_120px_auto] lg:items-end">
            <Field label="Business type">
              <Input value={businessType} onChange={(event) => setBusinessType(event.target.value)} />
            </Field>
            <Field label="Location">
              <Input value={location} onChange={(event) => setLocation(event.target.value)} />
            </Field>
            <Field label="Results">
              <Input type="number" min={1} max={8} value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
            </Field>
            <Button type="button" onClick={searchCandidates} disabled={loading || !businessType || !location}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
              Search
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeWebsiteResearch}
              onChange={(event) => setIncludeWebsiteResearch(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            Include website observations
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-normal text-slate-950">Candidates</h2>
        <span className="text-sm text-slate-500">{resultCount} found</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onUpdate={(updates) => updateCandidate(candidate.id, updates)}
            onImport={() => importCandidate(candidate)}
          />
        ))}
      </div>

      {!loading && candidates.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-slate-50 p-6 text-sm text-slate-500">
          No candidates loaded.
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  onUpdate,
  onImport
}: {
  candidate: CandidateState;
  onUpdate: (updates: Partial<CandidateState>) => void;
  onImport: () => void;
}) {
  const canImport = Boolean(candidate.importEmail);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{candidate.business_name}</CardTitle>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {candidate.location ?? "Location unavailable"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">{candidate.source.replace("_", " ")}</Badge>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
              {Math.round(candidate.confidence * 100)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={candidate.importEmail} onChange={(event) => onUpdate({ importEmail: event.target.value })} />
          </Field>
          <Field label="Contact name">
            <Input value={candidate.importContactName} onChange={(event) => onUpdate({ importContactName: event.target.value })} />
          </Field>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Industry" value={candidate.industry} />
          <Info label="Phone" value={candidate.phone} />
        </div>

        {candidate.website_url && (
          <a
            href={candidate.website_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Website
          </a>
        )}

        <div className="space-y-2">
          <Label>Observed issues</Label>
          <div className="flex flex-wrap gap-2">
            {candidate.observed_website_issues.length ? (
              candidate.observed_website_issues.map((issue) => (
                <Badge key={issue} className="border-amber-200 bg-amber-50 text-amber-800">
                  {issue}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-slate-500">None flagged</span>
            )}
          </div>
        </div>

        <Field label="Issue details">
          <Textarea
            value={candidate.issue_details ?? ""}
            onChange={(event) => onUpdate({ issue_details: event.target.value || null })}
            className="min-h-24"
          />
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" onClick={onImport} disabled={!canImport}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Lead
          </Button>
          {candidate.importedLeadId && (
            <Link href={`/leads/${candidate.importedLeadId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Open Lead
            </Link>
          )}
        </div>

        {candidate.importMessage && (
          <p className="flex items-center gap-2 rounded-md border border-border bg-slate-50 p-3 text-sm text-slate-700">
            <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            {candidate.importMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-950">{value ?? "Not found"}</p>
    </div>
  );
}

function appendResearchNotes(candidate: CandidateState) {
  const parts = [
    candidate.notes,
    candidate.phone ? `Phone from listing: ${candidate.phone}.` : null,
    candidate.source_url ? `Source URL: ${candidate.source_url}.` : null,
    candidate.needs_email_verification ? "Contact details require owner verification before sending." : null
  ];
  return parts.filter(Boolean).join(" ");
}
