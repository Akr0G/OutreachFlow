import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/supabase/repository";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage sender details, integrations, and outreach safeguards.</p>
      </div>
      <SettingsForm settings={settings} ownerAllowlistConfigured={Boolean(process.env.OWNER_EMAIL)} />
    </div>
  );
}
