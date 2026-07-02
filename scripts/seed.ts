import { createClient } from "@supabase/supabase-js";
import { sampleActivities, sampleDrafts, sampleLeads, sampleNotifications, sampleReplies, sampleSettings, sampleTemplates } from "../lib/sample-data";
import type { Database } from "../lib/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedOwnerId = process.env.SEED_OWNER_ID;

if (!supabaseUrl || !serviceRole || !seedOwnerId) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SEED_OWNER_ID before running seed.");
}

const ownerId = seedOwnerId;

const supabase = createClient<Database>(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const leads = sampleLeads.map(({ owner_id, ...lead }) => ({ ...lead, owner_id: ownerId }));
  const drafts = sampleDrafts.map(({ owner_id, ...draft }) => ({ ...draft, owner_id: ownerId }));
  const replies = sampleReplies.map(({ owner_id, ...reply }) => ({ ...reply, owner_id: ownerId }));
  const activities = sampleActivities.map(({ owner_id, id, ...activity }) => ({ ...activity, owner_id: ownerId }));
  const templates = sampleTemplates.map(({ owner_id, id, ...template }) => ({ ...template, owner_id: ownerId }));
  const notifications = sampleNotifications.map(({ owner_id, id, ...notification }) => ({ ...notification, owner_id: ownerId }));

  await upsert("leads", leads);
  await upsert("email_drafts", drafts);
  await upsert("replies", replies);
  await upsert("activities", activities);
  await upsert("templates", templates);
  await upsert("notifications", notifications);

  const { id, owner_id, ...settings } = sampleSettings;
  const { error } = await supabase.from("settings").upsert(
    {
      ...settings,
      owner_id: ownerId,
      gmail_connection_metadata: settings.gmail_connection_metadata ?? { connected: false }
    },
    { onConflict: "owner_id" }
  );
  if (error) throw error;

  console.log("Seeded OutreachFlow sample data.");
}

async function upsert(table: keyof Database["public"]["Tables"], rows: unknown[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows as never[]);
  if (error) throw error;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
