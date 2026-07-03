import { formatWebsiteQualityTier, scoreWebsiteQuality } from "@/lib/research/website-score";
import type { ObservedWebsiteIssue, WebsiteQualityTier } from "@/lib/types";

export type WebsiteResearch = {
  email: string | null;
  issues: ObservedWebsiteIssue[];
  qualityTier: WebsiteQualityTier;
  qualityLabel: string;
  qualitySummary: string;
  issueDetails: string | null;
  notes: string | null;
};

const contactPathHints = ["contact", "about"];

export async function researchWebsite(url: string | null): Promise<WebsiteResearch> {
  if (!url) {
    return {
      email: null,
      issues: ["No website"],
      qualityTier: 0,
      qualityLabel: "No website",
      qualitySummary: "No business website was found in the available lead data.",
      issueDetails: "No website was provided by the business listing.",
      notes: "Research source: business listing did not include a website."
    };
  }

  const normalized = normalizeUrl(url);
  if (!normalized) return emptyResearch("Website URL could not be normalized.");

  try {
    const homepage = await fetchText(normalized);
    const contactLinks = findContactLinks(homepage.html, normalized).slice(0, 2);
    const contactPages = await Promise.all(contactLinks.map((link) => fetchText(link).catch(() => null)));
    const pages = [homepage, ...contactPages.filter((page): page is FetchedPage => Boolean(page))];
    return analyzePages(normalized, pages);
  } catch {
    return emptyResearch("Website could not be reached during safe research.");
  }
}

function analyzePages(url: string, pages: FetchedPage[]): WebsiteResearch {
  const html = pages.map((page) => page.html).join("\n");
  const text = htmlToText(html);
  const issues = new Set<ObservedWebsiteIssue>();
  const details: string[] = [];

  if (!url.startsWith("https://")) {
    issues.add("Other observed issue");
    details.push("Website listing is not using an HTTPS URL.");
  }
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    issues.add("Poor mobile responsiveness");
    details.push("No viewport meta tag was detected on the checked page.");
  }
  if (!/(contact|book|schedule|quote|call|order|get started|request)/i.test(text)) {
    issues.add("Missing calls to action");
    details.push("No clear contact, booking, quote, or request CTA was found in the checked text.");
  }
  if (!/mailto:|contact|phone|tel:/i.test(html)) {
    issues.add("Unclear contact options");
    details.push("Contact options were not obvious in the homepage markup.");
  }
  if (/(copyright|©)\s*(19|20)\d{2}/i.test(text)) {
    const years = Array.from(text.matchAll(/\b(20\d{2}|19\d{2})\b/g))
      .map((match) => Number(match[1]))
      .filter((year) => year >= 1990 && year <= new Date().getFullYear());
    const latest = Math.max(...years, 0);
    if (latest && latest < new Date().getFullYear() - 3) {
      issues.add("Outdated design");
      details.push(`Page text includes an older visible year (${latest}).`);
    }
  }

  const email = extractEmail(html);
  const quality = scoreWebsiteQuality({
    websiteUrl: url,
    issues: Array.from(issues),
    issueDetails: details.join(" ")
  });
  const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
  const notes = [
    "Research source: public website pages checked from the business listing.",
    `Website quality: ${formatWebsiteQualityTier(quality)}.`,
    title ? `Page title: ${decodeEntities(title)}.` : null,
    email ? "A public email address was detected and should be verified before outreach." : "No public email address was detected."
  ]
    .filter(Boolean)
    .join(" ");

  return {
    email,
    issues: Array.from(issues).slice(0, 3),
    qualityTier: quality.tier,
    qualityLabel: quality.label,
    qualitySummary: quality.summary,
    issueDetails: details.length ? details.join(" ") : null,
    notes
  };
}

type FetchedPage = {
  url: string;
  html: string;
};

async function fetchText(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "OutreachFlow safe lead research (+manual review)"
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      throw new Error("Unsupported response.");
    }
    const html = (await response.text()).slice(0, 250_000);
    return { url, html };
  } finally {
    clearTimeout(timeout);
  }
}

function findContactLinks(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1])
    .filter((href) => contactPathHints.some((hint) => href.toLowerCase().includes(hint)))
    .map((href) => {
      try {
        return new URL(href, base).toString();
      } catch {
        return null;
      }
    })
    .filter((href): href is string => Boolean(href));
  return Array.from(new Set(links)).filter((href) => new URL(href).origin === base.origin);
}

function extractEmail(html: string) {
  const mailto = html.match(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1];
  const visible = html.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const value = mailto ?? visible ?? null;
  if (!value || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(value)) return null;
  return value.toLowerCase();
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(value: string) {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function emptyResearch(issueDetails: string): WebsiteResearch {
  const quality = scoreWebsiteQuality({
    websiteUrl: "unreachable",
    issues: ["Other observed issue"],
    issueDetails
  });

  return {
    email: null,
    issues: ["Other observed issue"],
    qualityTier: quality.tier,
    qualityLabel: quality.label,
    qualitySummary: quality.summary,
    issueDetails,
    notes: `Research source: public website check attempted; verify details before outreach. Website quality: ${formatWebsiteQualityTier(quality)}.`
  };
}
