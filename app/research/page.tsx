import { ResearchClient } from "@/components/research-client";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Research</h1>
        <p className="mt-1 text-sm text-slate-600">Find local businesses and move verified contacts into lead review.</p>
      </div>
      <ResearchClient />
    </div>
  );
}
