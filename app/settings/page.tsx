import { SettingsForm } from "@/components/settings-form";
import { getOwnerContext } from "@/lib/auth/owner";
import { getSettings } from "@/lib/supabase/repository";

type SettingsPageProps = {
  searchParams?: Promise<{ gmail?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [settings, owner] = await Promise.all([getSettings(), getOwnerContext()]);
  const params = await searchParams;
  const gmailOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage sender details, integrations, and outreach safeguards.</p>
      </div>
      <SettingsForm
        settings={settings}
        ownerEmail={owner.email}
        gmailOAuthConfigured={gmailOAuthConfigured}
        gmailStatus={params?.gmail}
      />
    </div>
  );
}
