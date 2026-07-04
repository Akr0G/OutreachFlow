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
  bulkProcessed?: boolean;
};

const businessTypeOptions = [
  "All businesses",
  "Dentists",
  "Med spas",
  "Chiropractors",
  "Physical therapy clinics",
  "Auto repair shops",
  "Roofing companies",
  "HVAC companies",
  "Plumbers",
  "Electricians",
  "Landscapers",
  "Restaurants",
  "Hair salons",
  "Gyms",
  "Law firms",
  "Real estate agencies"
];

const locationOptions = [
  { label: "Middletown, DE", value: "Middletown, DE" },
  { label: "Wilmington, DE", value: "Wilmington, DE" },
  { label: "Newark, DE", value: "Newark, DE" },
  { label: "Dover, DE", value: "Dover, DE" },
  { label: "Philadelphia, PA", value: "Philadelphia, PA" },
  { label: "Baltimore, MD", value: "Baltimore, MD" },
  { label: "New York, NY", value: "New York, NY" },
  { label: "Washington, DC", value: "Washington, DC" },
  { label: "USA - nationwide", value: "United States" },
  { label: "Custom", value: "custom" }
];

type TierFilter = "all" | "0" | "1" | "2" | "3";

export function ResearchClient() {
  const [businessType, setBusinessType] = useState(businessTypeOptions[0]);
  const [location, setLocation] = useState("Middletown, DE");
  const [locationPreset, setLocationPreset] = useState("Middletown, DE");
  const [limit, setLimit] = useState(20);
  const [includeWebsiteResearch, setIncludeWebsiteResearch] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
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
          notes: appendResearchNotes(candidate),
          source_place_id: candidate.source === "google_places" ? candidate.id : null
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

  async function importVerifiedCandidates() {
    const importable = candidates.filter((candidate) => candidate.importEmail && !candidate.importedLeadId && !candidate.bulkProcessed);
    if (!importable.length) {
      setMessage("No new candidates with public email addresses are ready to add.");
      return;
    }
    setBulkImporting(true);
    let added = 0;
    let failed = 0;

    for (const candidate of importable) {
      updateCandidate(candidate.id, { importMessage: "" });
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
          notes: appendResearchNotes(candidate),
          source_place_id: candidate.source === "google_places" ? candidate.id : null
        })
      });
      const body = await response.json().catch(() => null);
      if (response.ok) {
        added += 1;
        updateCandidate(candidate.id, {
          importMessage: body?.message ?? "Lead added.",
          importedLeadId: body?.demo ? undefined : body?.lead_id,
          bulkProcessed: true
        });
      } else {
        failed += 1;
        updateCandidate(candidate.id, {
          importMessage: body?.error ?? "Lead could not be added.",
          bulkProcessed: false
        });
      }
    }
    setBulkImporting(false);
    setMessage(`Added ${added} lead${added === 1 ? "" : "s"} with email${failed ? `; ${failed} failed or already existed.` : "."}`);
  }

  const filteredCandidates = useMemo(() => {
    if (tierFilter === "all") return candidates;
    return candidates.filter((candidate) => String(candidate.website_quality_tier) === tierFilter);
  }, [candidates, tierFilter]);
  const resultCount = filteredCandidates.length;

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
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_160px_120px_auto] lg:items-end">
            <Field label="Business type">
              <SelectControl value={businessType} onChange={setBusinessType} label="Business type">
                {businessTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectControl>
            </Field>
            <Field label="Location preset">
              <SelectControl
                value={locationPreset}
                onChange={(value) => {
                  setLocationPreset(value);
                  if (value !== "custom") setLocation(value);
                }}
                label="Location preset"
              >
                {locationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectControl>
            </Field>
            <Field label="Locations">
              <Input
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setLocationPreset("custom");
                }}
                placeholder="Wilmington, DE; Philadelphia, PA"
              />
            </Field>
            <Field label="Website tier">
              <SelectControl value={tierFilter} onChange={(value) => setTierFilter(value as TierFilter)} label="Website tier">
                <option value="all">All tiers</option>
                <option value="0">Tier 0 - No website</option>
                <option value="1">Tier 1 - Needs work</option>
                <option value="2">Tier 2 - Improvable</option>
                <option value="3">Tier 3 - Strong</option>
              </SelectControl>
            </Field>
            <Field label="Results">
              <Input type="number" min={1} max={20} value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
            </Field>
            <Button type="button" onClick={searchCandidates} disabled={loading || !businessType || !location}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
              Search
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Separate cities or states with semicolons. Searches are deduplicated, capped at 20 candidates, and sorted to show Tier 0-2 websites before Tier 3.
          </p>
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {resultCount} shown{candidates.length !== resultCount ? ` / ${candidates.length} found` : ""}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={importVerifiedCandidates}
            disabled={bulkImporting || !candidates.some((candidate) => candidate.importEmail && !candidate.importedLeadId && !candidate.bulkProcessed)}
          >
            {bulkImporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            Add leads with email
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredCandidates.map((candidate) => (
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
      {!loading && candidates.length > 0 && filteredCandidates.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-slate-50 p-6 text-sm text-slate-500">
          No candidates match the selected tier.
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
            <Badge className={websiteTierClassName(candidate.website_quality_tier)}>
              Tier {candidate.website_quality_tier}: {candidate.website_quality_label}
            </Badge>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
              {Math.round(candidate.confidence * 100)}%
            </Badge>
            {candidate.opening_date && (
              <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                Opened {candidate.opening_date}
              </Badge>
            )}
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
        {candidate.source_url && (
          <a
            href={candidate.source_url}
            target="_blank"
            rel="noreferrer"
            className="ml-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            View on Google Maps
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

function SelectControl({
  value,
  onChange,
  children,
  label
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
    >
      {children}
    </select>
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
    `Website tier: ${candidate.website_quality_tier} - ${candidate.website_quality_label}.`,
    candidate.phone ? `Phone from listing: ${candidate.phone}.` : null,
    candidate.source_url ? `Source URL: ${candidate.source_url}.` : null,
    candidate.needs_email_verification ? "Contact details require owner verification before sending." : null
  ];
  return parts.filter(Boolean).join(" ");
}

function websiteTierClassName(tier: number) {
  if (tier === 3) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tier === 2) return "border-sky-200 bg-sky-50 text-sky-800";
  if (tier === 1) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}
