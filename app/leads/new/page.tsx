import { LeadForm } from "@/components/lead-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Add Lead</h1>
        <p className="mt-1 text-sm text-slate-600">Record only what you have manually observed.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lead information</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadForm />
        </CardContent>
      </Card>
    </div>
  );
}
