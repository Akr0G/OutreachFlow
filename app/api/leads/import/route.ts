import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { rateLimit } from "@/lib/rate-limit";
import { csvImportRowSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`csv-import:${owner.id}`, 5, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many import attempts." }, { status: 429 });

  const body = (await request.json()) as { rows?: unknown[] };
  const rows = body.rows ?? [];
  const results = rows.map((row, index) => {
    const parsed = csvImportRowSchema.safeParse(row);
    return parsed.success
      ? { index, ok: true }
      : { index, ok: false, errors: parsed.error.flatten().fieldErrors };
  });
  return NextResponse.json({
    ok: results.every((result) => result.ok),
    rows: results,
    imported_count: results.filter((result) => result.ok).length
  });
}
