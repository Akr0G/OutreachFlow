import { researchWebsite } from "@/lib/research/website";
import { scoreWebsiteQuality } from "@/lib/research/website-score";
import type { ResearchSearchInput } from "@/lib/schemas";
import type { ResearchCandidate } from "@/lib/types";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  primaryTypeDisplayName?: { text?: string };
  googleMapsUri?: string;
  businessStatus?: string;
};

export async function searchResearchCandidates(input: ResearchSearchInput): Promise<ResearchCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return demoCandidates(input);
  const businessQuery = normalizeBusinessQuery(input.business_type);

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.primaryTypeDisplayName",
        "places.googleMapsUri",
        "places.businessStatus"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery: `${businessQuery} near ${input.location}`,
      pageSize: input.limit
    })
  });

  if (!response.ok) {
    throw new Error(`Places search failed with ${response.status}.`);
  }

  const body = (await response.json()) as { places?: GooglePlace[] };
  const places = (body.places ?? []).filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY");
  const candidates = await Promise.all(
    places.slice(0, input.limit).map((place) => placeToCandidate(place, input))
  );
  return candidates;
}

function normalizeBusinessQuery(value: string) {
  return value.toLowerCase() === "all businesses" ? "businesses" : value;
}

async function placeToCandidate(place: GooglePlace, input: ResearchSearchInput): Promise<ResearchCandidate> {
  const website = place.websiteUri ?? null;
  const websiteResearch = input.include_website_research ? await researchWebsite(website) : null;
  const fallbackQuality = scoreWebsiteQuality({ websiteUrl: website, issues: [] });
  const businessName = place.displayName?.text ?? "Unnamed business";
  const industry = place.primaryTypeDisplayName?.text ?? input.business_type;
  const notes = [
    `Lead found from Google Places text search for "${input.business_type}" near "${input.location}".`,
    place.googleMapsUri ? `Maps source: ${place.googleMapsUri}` : null,
    websiteResearch?.notes ?? null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: place.id ?? crypto.randomUUID(),
    business_name: businessName,
    contact_name: null,
    email: websiteResearch?.email ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website_url: website,
    industry,
    location: place.formattedAddress ?? input.location,
    address: place.formattedAddress ?? null,
    source: "google_places",
    source_url: place.googleMapsUri ?? null,
    observed_website_issues: websiteResearch?.issues ?? [],
    website_quality_tier: websiteResearch?.qualityTier ?? fallbackQuality.tier,
    website_quality_label: websiteResearch?.qualityLabel ?? fallbackQuality.label,
    issue_details: websiteResearch?.issueDetails ?? null,
    notes,
    confidence: websiteResearch?.email ? 0.78 : 0.56,
    needs_email_verification: true
  };
}

async function demoCandidates(input: ResearchSearchInput): Promise<ResearchCandidate[]> {
  const base = [
    {
      business_name: "Cornerstone Family Dental",
      industry: "Dental clinic",
      website_url: "https://cornerstone-family-dental.example",
      email: "hello@cornerstone-family-dental.example",
      issue_details: "Listing research suggests the homepage CTA could be easier to find for appointment requests.",
      observed_website_issues: ["Missing calls to action"] as const
    },
    {
      business_name: "Market Street Auto Care",
      industry: "Auto repair shop",
      website_url: "https://marketstreetautocare.example",
      email: "service@marketstreetautocare.example",
      issue_details: "Listing research suggests service and contact options may be hard to scan on mobile.",
      observed_website_issues: ["Poor mobile responsiveness", "Unclear contact options"] as const
    },
    {
      business_name: "Lakeside Physical Therapy",
      industry: "Physical therapy clinic",
      website_url: "https://lakeside-pt.example",
      email: null,
      issue_details: "Listing research did not find a public email. Verify a contact address before outreach.",
      observed_website_issues: ["Other observed issue"] as const
    }
  ];

  return base.slice(0, input.limit).map((item) => {
    const quality = scoreWebsiteQuality({
      websiteUrl: item.website_url,
      issues: [...item.observed_website_issues],
      issueDetails: item.issue_details
    });

    return {
      id: crypto.randomUUID(),
      business_name: item.business_name,
      contact_name: null,
      email: item.email,
      phone: "(555) 010-2000",
      website_url: item.website_url,
      industry: item.industry,
      location: input.location,
      address: input.location,
      source: "demo",
      source_url: null,
      observed_website_issues: [...item.observed_website_issues],
      website_quality_tier: quality.tier,
      website_quality_label: quality.label,
      issue_details: item.issue_details,
      notes: `Demo lead for "${input.business_type}" near "${input.location}". Website quality: Tier ${quality.tier} - ${quality.label}. Replace with Google Places by setting GOOGLE_PLACES_API_KEY. Verify contact details before outreach.`,
      confidence: item.email ? 0.72 : 0.42,
      needs_email_verification: true
    };
  });
}
