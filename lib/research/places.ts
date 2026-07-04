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
  openingDate?: { year?: number; month?: number; day?: number };
  searchLocation?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

export async function searchResearchCandidates(input: ResearchSearchInput): Promise<ResearchCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return demoCandidates(input);
  const businessQuery = normalizeBusinessQuery(input.business_type);
  const locations = parseResearchLocations(input.location);
  const placesById = new Map<string, GooglePlace>();
  const searchBudget = input.include_website_research ? Math.min(60, input.limit * 3) : input.limit;
  const targetPerLocation = Math.max(1, Math.ceil(searchBudget / locations.length));

  for (const location of locations) {
    if (placesById.size >= searchBudget) break;
    const locationPlaces = await searchLocationPages(
      apiKey,
      businessQuery,
      location,
      Math.min(targetPerLocation, searchBudget - placesById.size)
    );
    for (const place of locationPlaces) {
      if (place.businessStatus === "CLOSED_PERMANENTLY") continue;
      const key = place.id ?? `${place.displayName?.text ?? ""}:${place.formattedAddress ?? ""}`;
      if (key) placesById.set(key, { ...place, searchLocation: location });
      if (placesById.size >= searchBudget) break;
    }
  }

  const candidates = await mapWithConcurrency(
    Array.from(placesById.values()),
    5,
    (place) => placeToCandidate(place, input)
  );
  return candidates.sort(compareResearchCandidates).slice(0, input.limit);
}

async function searchLocationPages(
  apiKey: string,
  businessQuery: string,
  location: string,
  requestedCount: number
) {
  const places: GooglePlace[] = [];
  let pageToken: string | undefined;

  do {
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
          "places.businessStatus",
          "places.openingDate",
          "nextPageToken"
        ].join(",")
      },
      body: JSON.stringify({
        textQuery: `${businessQuery} in ${location}`,
        pageSize: Math.min(20, requestedCount - places.length),
        ...(pageToken ? { pageToken } : {})
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(error?.error?.message ?? `Places search failed with ${response.status}.`);
    }

    const body = (await response.json()) as GooglePlacesResponse;
    places.push(...(body.places ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken && places.length < Math.min(60, requestedCount));

  return places.slice(0, requestedCount);
}

function normalizeBusinessQuery(value: string) {
  return value.toLowerCase() === "all businesses" ? "businesses" : value;
}

export function parseResearchLocations(value: string) {
  const locations = expandNationwideLocation(value)
    .split(/[;\n]/)
    .map((location) => location.trim())
    .filter(Boolean);
  if (locations.some((location) => location.toLowerCase() === "near me")) {
    throw new Error("Use an explicit city and state; 'near me' is inaccurate for server-side searches.");
  }
  if (!locations.length) {
    throw new Error("Enter at least one explicit city and state.");
  }
  return Array.from(new Set(locations)).slice(0, 10);
}

function expandNationwideLocation(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["usa", "us", "u.s.", "u.s.a.", "united states", "united states of america"].includes(normalized)) {
    return "United States";
  }
  return value;
}

async function placeToCandidate(place: GooglePlace, input: ResearchSearchInput): Promise<ResearchCandidate> {
  const website = place.websiteUri ?? null;
  const websiteResearch = input.include_website_research ? await researchWebsite(website) : null;
  const fallbackQuality = scoreWebsiteQuality({ websiteUrl: website, issues: [] });
  const businessName = place.displayName?.text ?? "Unnamed business";
  const industry = place.primaryTypeDisplayName?.text ?? input.business_type;
  const openingDate = formatOpeningDate(place.openingDate);
  const notes = [
    `Lead found from Google Places text search for "${input.business_type}" in "${place.searchLocation ?? input.location}".`,
    openingDate ? `Google Places lists an opening date of ${openingDate}.` : null,
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
    needs_email_verification: true,
    opening_date: openingDate
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
      needs_email_verification: true,
      opening_date: null
    };
  });
}

function formatOpeningDate(value?: { year?: number; month?: number; day?: number }) {
  if (!value?.year) return null;
  return [value.year, value.month ? String(value.month).padStart(2, "0") : null, value.day ? String(value.day).padStart(2, "0") : null]
    .filter(Boolean)
    .join("-");
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function compareResearchCandidates(left: ResearchCandidate, right: ResearchCandidate) {
  if (left.website_quality_tier !== right.website_quality_tier) {
    return left.website_quality_tier - right.website_quality_tier;
  }
  if (Boolean(left.email) !== Boolean(right.email)) return left.email ? -1 : 1;
  return right.confidence - left.confidence;
}
