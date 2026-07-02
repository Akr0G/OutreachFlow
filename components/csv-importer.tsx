"use client";

import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import Papa from "papaparse";
import { Download, FileUp, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { domainFromUrl } from "@/lib/utils/format";

type RawRow = Record<string, string>;
type DuplicateAction = "skip" | "merge" | "import";
type AppField =
  | "business_name"
  | "contact_name"
  | "email"
  | "website_url"
  | "industry"
  | "location"
  | "observed_website_issues"
  | "issue_details"
  | "notes";

const appFields: { key: AppField; label: string; required?: boolean }[] = [
  { key: "business_name", label: "Business name", required: true },
  { key: "contact_name", label: "Contact name" },
  { key: "email", label: "Email", required: true },
  { key: "website_url", label: "Website link" },
  { key: "industry", label: "Industry" },
  { key: "location", label: "Location" },
  { key: "observed_website_issues", label: "Observed issues" },
  { key: "issue_details", label: "Issue details" },
  { key: "notes", label: "Notes" }
];

const templateCsv =
  "business_name,contact_name,email,website_url,industry,location,observed_website_issues,issue_details,notes\n" +
  "Maple Street Bakery,Avery,maple.owner@example.com,https://maplestreetbakery.example,Bakery,Fairview OH,Missing calls to action,Catering inquiry option is hard to spot,Fictional sample\n" +
  "BrightSmile Dental,Jordan,brightsmile.owner@example.com,https://brightsmile-dental.example,Dental,Cedar Falls IA,Outdated design,Homepage visuals feel older,Fictional sample";

export function CsvImporter() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<AppField, string>>(() => Object.fromEntries(appFields.map((field) => [field.key, ""])) as Record<AppField, string>);
  const [actions, setActions] = useState<Record<number, DuplicateAction>>({});
  const [message, setMessage] = useState("");

  const preview = useMemo(() => {
    const emailCounts = new Map<string, number>();
    const domainCounts = new Map<string, number>();

    rows.forEach((row) => {
      const mapped = mapRow(row, mapping);
      const email = mapped.email.toLowerCase();
      if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
      const domain = domainFromUrl(mapped.website_url);
      if (domain) domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    });

    return rows.map((row, index) => {
      const mapped = mapRow(row, mapping);
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!mapped.business_name) errors.push("Missing business name");
      if (!mapped.email) errors.push("Missing email");
      if (mapped.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) errors.push("Invalid email");
      if (mapped.website_url && !isValidUrl(mapped.website_url)) errors.push("Invalid website URL");

      const email = mapped.email.toLowerCase();
      const domain = domainFromUrl(mapped.website_url);
      if (email && (emailCounts.get(email) ?? 0) > 1) warnings.push("Duplicate email");
      if (domain && (domainCounts.get(domain) ?? 0) > 1) warnings.push("Duplicate website domain");

      return {
        index,
        mapped,
        errors,
        warnings,
        action: warnings.length ? actions[index] ?? "skip" : "import"
      };
    });
  }, [actions, mapping, rows]);

  const validCount = preview.filter((row) => row.errors.length === 0 && row.action !== "skip").length;

  function parseFile(file: File) {
    setMessage("");
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const fields = result.meta.fields ?? [];
        setHeaders(fields);
        setRows(result.data);
        setMapping(autoMap(fields));
        setActions({});
      },
      error: () => setMessage("CSV could not be parsed.")
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function confirmImport() {
    setMessage(`${validCount} valid row${validCount === 1 ? "" : "s"} ready to import.`);
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "outreachflow-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
      >
        <UploadCloud className="h-8 w-8 text-teal-700" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-900">Drop a CSV file here</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Choose file
          </Button>
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV template
          </Button>
        </div>
        <Input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) parseFile(file);
          }}
        />
      </div>

      {headers.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Map Columns</h2>
            <p className="mt-1 text-sm text-slate-500">{rows.length} rows detected</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {appFields.map((field) => (
              <label key={field.key} className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {field.label}
                  {field.required && <span className="text-red-700"> *</span>}
                </span>
                <select
                  value={mapping[field.key]}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                >
                  <option value="">Do not import</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {preview.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Preview</h2>
              <p className="mt-1 text-sm text-slate-500">{validCount} valid rows after duplicate choices</p>
            </div>
            <Button type="button" onClick={confirmImport} disabled={validCount === 0}>
              Import valid rows
            </Button>
          </div>
          {message && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
              {message}
            </p>
          )}
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Website</th>
                    <th className="px-4 py-3">Industry</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Validation</th>
                    <th className="px-4 py-3">Duplicate action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.slice(0, 20).map((row) => (
                    <tr key={row.index}>
                      <td className="px-4 py-3 font-medium text-slate-950">{row.mapped.business_name || "Missing"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.mapped.email || "Missing"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.mapped.website_url || "Not set"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.mapped.industry || "Not set"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.mapped.location || "Not set"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Valid</Badge>
                          )}
                          {row.errors.map((error) => (
                            <Badge key={error} className="border-red-200 bg-red-50 text-red-800">
                              {error}
                            </Badge>
                          ))}
                          {row.warnings.map((warning) => (
                            <Badge key={warning} className="border-amber-200 bg-amber-50 text-amber-800">
                              {warning}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.warnings.length > 0 ? (
                          <select
                            value={row.action}
                            onChange={(event) =>
                              setActions((current) => ({
                                ...current,
                                [row.index]: event.target.value as DuplicateAction
                              }))
                            }
                            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                          >
                            <option value="skip">Skip</option>
                            <option value="merge">Merge</option>
                            <option value="import">Import anyway</option>
                          </select>
                        ) : (
                          <span className="text-slate-500">Import</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function autoMap(headers: string[]) {
  const normalized = new Map(headers.map((header) => [header.toLowerCase().replace(/[^a-z0-9]/g, ""), header]));
  const aliases: Record<AppField, string[]> = {
    business_name: ["businessname", "business", "company", "companyname"],
    contact_name: ["contactname", "contact", "owner", "ownername"],
    email: ["email", "emailaddress"],
    website_url: ["website", "websiteurl", "url"],
    industry: ["industry", "category"],
    location: ["location", "city"],
    observed_website_issues: ["observedissues", "websiteissues", "issues"],
    issue_details: ["issuedetails", "details"],
    notes: ["notes"]
  };
  return Object.fromEntries(
    appFields.map((field) => [
      field.key,
      aliases[field.key].map((alias) => normalized.get(alias)).find(Boolean) ?? ""
    ])
  ) as Record<AppField, string>;
}

function mapRow(row: RawRow, mapping: Record<AppField, string>) {
  return Object.fromEntries(
    appFields.map((field) => [field.key, mapping[field.key] ? row[mapping[field.key]]?.trim() ?? "" : ""])
  ) as Record<AppField, string>;
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
