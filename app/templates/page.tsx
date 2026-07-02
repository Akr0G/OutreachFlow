import { TemplateManager } from "@/components/template-manager";
import { getSettings, listTemplates } from "@/lib/supabase/repository";

export default async function TemplatesPage() {
  const [templates, settings] = await Promise.all([listTemplates(), getSettings()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Template Manager</h1>
        <p className="mt-1 text-sm text-slate-600">Edit templates, signature, and CTA with safe variables.</p>
      </div>
      <TemplateManager templates={templates} settings={settings} />
    </div>
  );
}
