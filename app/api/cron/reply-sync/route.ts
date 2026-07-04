import { NextRequest, NextResponse } from "next/server";
import { syncGmailReplies } from "@/lib/gmail/reply-sync";
import type { RawSettings } from "@/lib/supabase/repository";
import { fetchAllPages } from "@/lib/supabase/pagination";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (actual !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase admin credentials are not configured." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const settingsRows = await fetchAllPages<RawSettings>((from, to) =>
    admin
      .from("settings")
      .select("*")
      .not("encrypted_gmail_refresh_token", "is", null)
      .order("owner_id", { ascending: true })
      .range(from, to)
  );

  let synced = 0;
  let checkedThreads = 0;
  const errors: Array<{ owner_id: string; error: string }> = [];

  for (const settings of settingsRows) {
    if (!settings.owner_id) continue;
    try {
      const result = await syncGmailReplies(
        { id: settings.owner_id },
        { settings, supabase: admin }
      );
      synced += result.synced;
      checkedThreads += result.checked_threads;
    } catch (error) {
      errors.push({
        owner_id: settings.owner_id,
        error: error instanceof Error ? error.message : "Reply sync failed."
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    owner_count: settingsRows.length,
    synced,
    checked_threads: checkedThreads,
    errors
  }, { status: errors.length === settingsRows.length && errors.length > 0 ? 502 : 200 });
}
