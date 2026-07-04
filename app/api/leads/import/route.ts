import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { observedWebsiteIssues } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { csvImportRowSchema } from "@/lib/schemas";
import { fetchAllPages } from "@/lib/supabase/pagination";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

const MAX_IMPORT_ROWS = 5000;
const INSERT_BATCH_SIZE = 250;

type ImportAction = "skip" | "merge" | "import";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`csv-import:${owner.id}`, 5, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many import attempts." }, { status: 429 });

  const body = (await request.json()) as {
    rows?: Array<Record<string, unknown> & { duplicate_action?: ImportAction }>;
    source?: "csv" | "research";
  };
  const rows = body.rows ?? [];
  const source = body.source === "research" ? "research" : "csv";
  if (rows.length === 0 || rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Import between 1 and ${MAX_IMPORT_ROWS} rows at a time.` },
      { status: 400 }
    );
  }

  const validated = rows.map((row, index) => {
    const parsed = csvImportRowSchema.safeParse({
      ...row,
      observed_website_issues: normalizeIssues(row.observed_website_issues)
    });
    return parsed.success
      ? { index, ok: true as const, data: parsed.data, action: row.duplicate_action ?? "import" }
      : { index, ok: false as const, errors: parsed.error.flatten().fieldErrors };
  });
  const invalidRows = validated.filter((row) => !row.ok);
  if (invalidRows.length > 0) {
    return NextResponse.json({ error: "Some rows are invalid.", rows: invalidRows }, { status: 400 });
  }

  const candidates = validated.filter((row) => row.ok);
  if (!isSupabaseConfigured()) {
    const importedCount = candidates.filter((row) => row.action !== "skip").length;
    return NextResponse.json({
      ok: true,
      demo: true,
      imported_count: importedCount,
      merged_count: 0,
      skipped_count: rows.length - importedCount,
      message: `${importedCount} rows validated. Connect Supabase to save them.`
    });
  }

  const supabase = await createSupabaseWorkspaceClient();
  const existing = await fetchAllPages<{ id: string; email: string; source_place_id: string | null }>((from, to) =>
    supabase
      .from("leads")
      .select("id,email,source_place_id")
      .eq("owner_id", owner.id)
      .order("id", { ascending: true })
      .range(from, to)
  );
  const existingByEmail = new Map(existing.map((lead) => [lead.email.toLowerCase(), lead]));
  const existingByPlaceId = new Map(
    existing.filter((lead) => lead.source_place_id).map((lead) => [lead.source_place_id!, lead])
  );
  const pendingByEmail = new Map<string, (typeof candidates)[number]["data"]>();
  const pendingKeyByEmail = new Map<string, string>();
  let skippedCount = 0;
  let mergedCount = 0;
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    if (candidate.action === "skip") {
      skippedCount += 1;
      continue;
    }

    const emailKey = candidate.data.email.toLowerCase();
    const placeId = candidate.data.source_place_id;
    const businessKey = placeId ? `place:${placeId}` : `email:${emailKey}`;
    const existingLead = (placeId ? existingByPlaceId.get(placeId) : undefined) ?? existingByEmail.get(emailKey);
    if (existingLead) {
      if (candidate.action !== "merge") {
        skippedCount += 1;
        continue;
      }
      const { error } = await supabase
        .from("leads")
        .update({ ...mergeableLeadFields(candidate.data), updated_at: now, last_activity_at: now })
        .eq("owner_id", owner.id)
        .eq("id", existingLead.id);
      if (error) return NextResponse.json({ error: "An existing lead could not be merged." }, { status: 500 });
      mergedCount += 1;
      continue;
    }

    const pendingEmailKey = pendingKeyByEmail.get(emailKey);
    if (pendingEmailKey && pendingEmailKey !== businessKey) {
      skippedCount += 1;
      continue;
    }
    const pending = pendingByEmail.get(businessKey);
    if (pending) {
      if (candidate.action === "merge") {
        pendingByEmail.set(businessKey, { ...pending, ...mergeableLeadFields(candidate.data) });
        mergedCount += 1;
      } else {
        skippedCount += 1;
      }
      continue;
    }
    pendingByEmail.set(businessKey, candidate.data);
    pendingKeyByEmail.set(emailKey, businessKey);
  }

  const pendingRows = Array.from(pendingByEmail.values()).map((row) => ({
    ...row,
    owner_id: owner.id,
    status: row.status ?? "Ready",
    follow_up_count: row.follow_up_count ?? 0,
    last_activity_at: now,
    created_at: now,
    updated_at: now
  }));
  const inserted: Array<{ id: string; business_name: string }> = [];

  for (let offset = 0; offset < pendingRows.length; offset += INSERT_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .insert(pendingRows.slice(offset, offset + INSERT_BATCH_SIZE))
      .select("id,business_name");
    if (error) {
      return NextResponse.json({ error: "Import stopped because a lead batch could not be saved." }, { status: 500 });
    }
    inserted.push(...(data ?? []));
  }

  for (let offset = 0; offset < inserted.length; offset += INSERT_BATCH_SIZE) {
    const { error } = await supabase.from("activities").insert(
      inserted.slice(offset, offset + INSERT_BATCH_SIZE).map((lead) => ({
        owner_id: owner.id,
        lead_id: lead.id,
        activity_type: "Lead created",
        description: `${lead.business_name} added from ${source === "research" ? "research" : "CSV"}`,
        metadata: { source },
        created_at: now
      }))
    );
    if (error) return NextResponse.json({ error: "Leads were imported, but activity history could not be saved." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported_count: inserted.length,
    merged_count: mergedCount,
    skipped_count: skippedCount,
    message: `Imported ${inserted.length}, merged ${mergedCount}, skipped ${skippedCount}.`
  });
}

function normalizeIssues(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[;|]/)
      : [];
  return values
    .map((issue) => String(issue).trim())
    .filter((issue): issue is (typeof observedWebsiteIssues)[number] =>
      observedWebsiteIssues.includes(issue as (typeof observedWebsiteIssues)[number])
    );
}

function mergeableLeadFields(row: Record<string, unknown>) {
  const { status: _status, follow_up_count: _followUpCount, ...fields } = row;
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== "" && value !== undefined)
  );
}
