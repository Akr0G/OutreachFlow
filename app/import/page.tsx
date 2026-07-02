import { CsvImporter } from "@/components/csv-importer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">CSV Import</h1>
        <p className="mt-1 text-sm text-slate-600">Preview, map, validate, and import only clean lead rows.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Import leads</CardTitle>
        </CardHeader>
        <CardContent>
          <CsvImporter />
        </CardContent>
      </Card>
    </div>
  );
}
