import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { rateLimit } from "@/lib/rate-limit";
import { researchSearchSchema } from "@/lib/schemas";
import { searchResearchCandidates } from "@/lib/research/places";

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  const limited = rateLimit(`research-search:${owner.id}`, 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many research searches." }, { status: 429 });

  const parsed = researchSearchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid research search.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const candidates = await searchResearchCandidates(parsed.data);
    return NextResponse.json({
      candidates,
      source: process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY ? "google_places" : "demo"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research search failed." },
      { status: 502 }
    );
  }
}
