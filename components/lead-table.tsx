"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Download, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { leadStatuses } from "@/lib/constants";
import { canCreateFollowUpDraft } from "@/lib/business-rules";
import type { EmailDraft, Lead, LeadStatus } from "@/lib/types";
import { domainFromUrl, formatDate, formatDateTime } from "@/lib/utils/format";

type SortMode = "newest" | "oldest" | "date_contacted" | "last_activity";
type FollowFilter = "all" | "eligible" | "blocked";

export function LeadTable({ leads, drafts }: { leads: Lead[]; drafts: EmailDraft[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");
  const [dateContacted, setDateContacted] = useState("");
  const [followFilter, setFollowFilter] = useState<FollowFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const industries = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.industry).filter(Boolean))).sort() as string[],
    [leads]
  );
  const locations = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.location).filter(Boolean))).sort() as string[],
    [leads]
  );

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return leads
      .filter((lead) => {
        const haystack = [
          lead.business_name,
          lead.contact_name,
          lead.email,
          lead.industry,
          lead.location
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (normalized && !haystack.includes(normalized)) return false;
        if (status !== "all" && lead.status !== status) return false;
        if (industry !== "all" && lead.industry !== industry) return false;
        if (location !== "all" && lead.location !== location) return false;
        if (dateContacted && lead.date_contacted !== dateContacted) return false;
        if (followFilter !== "all") {
          const eligible = canCreateFollowUpDraft(
            lead,
            drafts.filter((draft) => draft.lead_id === lead.id),
            new Date("2026-07-02T12:00:00.000Z")
          ).allowed;
          if (followFilter === "eligible" && !eligible) return false;
          if (followFilter === "blocked" && eligible) return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (sortMode === "oldest") return Date.parse(left.created_at) - Date.parse(right.created_at);
        if (sortMode === "date_contacted") {
          return Date.parse(right.date_contacted ?? "1970-01-01") - Date.parse(left.date_contacted ?? "1970-01-01");
        }
        if (sortMode === "last_activity") {
          return Date.parse(right.last_activity_at) - Date.parse(left.last_activity_at);
        }
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
  }, [dateContacted, drafts, followFilter, industry, leads, location, query, sortMode, status]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function toggleLead(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((leadId) => leadId !== id) : [...current, id]
    );
  }

  function exportSelected() {
    const rows = leads.filter((lead) => selected.includes(lead.id));
    const headers = ["business_name", "contact_name", "email", "industry", "location", "website_url", "status"];
    const csv = [
      headers.join(","),
      ...rows.map((lead) =>
        headers
          .map((header) => {
            const value = String(lead[header as keyof Lead] ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "outreachflow-selected-leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))]">
        <label className="relative">
          <span className="sr-only">Search leads</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search leads"
            className="pl-9"
          />
        </label>
        <Select value={status} onChange={(value) => setStatus(value as LeadStatus | "all")} label="Status">
          <option value="all">All statuses</option>
          {leadStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={industry} onChange={setIndustry} label="Industry">
          <option value="all">All industries</option>
          {industries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={location} onChange={setLocation} label="Location">
          <option value="all">All locations</option>
          {locations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <label>
          <span className="sr-only">Date contacted</span>
          <Input
            type="date"
            value={dateContacted}
            onChange={(event) => setDateContacted(event.target.value)}
          />
        </label>
        <Select value={followFilter} onChange={(value) => setFollowFilter(value as FollowFilter)} label="Follow-up">
          <option value="all">All follow-ups</option>
          <option value="eligible">Eligible</option>
          <option value="blocked">Blocked</option>
        </Select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select value={sortMode} onChange={(value) => setSortMode(value as SortMode)} label="Sort">
            <option value="newest">Newest lead</option>
            <option value="oldest">Oldest lead</option>
            <option value="date_contacted">Date contacted</option>
            <option value="last_activity">Last activity</option>
          </Select>
          <p className="text-sm text-slate-500">{filtered.length} leads</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportSelected} disabled={selected.length === 0}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export selected
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Website</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date contacted</th>
                <th className="px-4 py-3">Follow-ups</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      aria-label={`Select ${lead.business_name}`}
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-950">{lead.business_name}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.contact_name ?? "Not set"}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.email}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.industry ?? "Not set"}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.location ?? "Not set"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.website_url ? (
                      <a
                        href={lead.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
                      >
                        {domainFromUrl(lead.website_url) ?? "Open"}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      "No website"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(lead.date_contacted)}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.follow_up_count}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(lead.last_activity_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-teal-700 hover:text-teal-900">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-slate-500">
                    No leads match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
          Previous
        </Button>
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={page === totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function Select({
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
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
      >
        {children}
      </select>
    </label>
  );
}
