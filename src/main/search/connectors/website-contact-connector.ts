/**
 * Website contact extraction stays deterministic because public emails, phone
 * numbers, and social URLs are high-signal facts that should not require LLM
 * credits. ScrapeGraph can still add semantic context; this connector keeps the
 * basic contact scrape available for any domain search.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const SOURCE_ID = "website-contact-scrape";
const MAX_PAGES = 5;
const MAX_OBSERVATIONS = 60;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d().\-\s]{6,}\d)(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?/gi;
const HREF_PATTERN = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const RELEVANT_LINK_PATTERN = /\b(contact|about|team|staff|people|directory|leadership|support|press|media|location|locations)\b/i;
const SOCIAL_HOST_PATTERN = /(^|\.)((facebook|instagram|linkedin|x|twitter|youtube|tiktok|github|reddit|threads|mastodon)\.com|bsky\.app)$/i;

export const websiteContactConnector: SourceConnector = {
  id: SOURCE_ID,
  label: "Website contacts",
  category: "identity",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "domain";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const startUrl = urlFromDomainSeed(seed);
    const observations: ObservationInput[] = [];
    const visited = new Set<string>();
    const pages = [startUrl];

    while (pages.length > 0 && visited.size < MAX_PAGES) {
      const pageUrl = pages.shift();
      if (!pageUrl || visited.has(pageUrl)) {
        continue;
      }
      visited.add(pageUrl);

      let html: string;
      try {
        html = await context.fetchText(pageUrl, { signal: context.signal });
      } catch (error) {
        if (visited.size === 1) {
          throw error;
        }
        continue;
      }

      observations.push(...extractContactObservations(seed.value, pageUrl, html));

      for (const link of extractRelevantInternalLinks(pageUrl, html)) {
        if (!visited.has(link) && pages.length + visited.size < MAX_PAGES) {
          pages.push(link);
        }
      }
    }

    return dedupeObservations(observations).slice(0, MAX_OBSERVATIONS);
  }
};

export function extractContactObservations(entity: string, sourceUrl: string, html: string): ObservationInput[] {
  const text = stripHtml(html);
  const observations: ObservationInput[] = [];

  for (const email of uniqueMatches(text, EMAIL_PATTERN)) {
    observations.push(observation(entity, "email", email.toLowerCase(), sourceUrl, "email"));
  }

  for (const phone of uniqueMatches(text, PHONE_PATTERN).map(normalizePhone).filter(isLikelyPhoneNumber)) {
    observations.push(observation(entity, "phone", phone, sourceUrl, "phone"));
  }

  for (const link of extractLinks(sourceUrl, html)) {
    if (isSocialUrl(link.url)) {
      observations.push(observation(entity, "social-profile", link.url, sourceUrl, "social-link", { title: link.text }));
    }
    if (RELEVANT_LINK_PATTERN.test(link.text) || RELEVANT_LINK_PATTERN.test(link.url)) {
      observations.push(observation(entity, "contact-page", link.url, sourceUrl, "contact-link", { title: link.text }));
    }
  }

  return dedupeObservations(observations);
}

function urlFromDomainSeed(seed: SearchSeed): string {
  const value = seed.value.trim();
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function extractRelevantInternalLinks(sourceUrl: string, html: string): string[] {
  const base = new URL(sourceUrl);
  return extractLinks(sourceUrl, html)
    .filter((link) => link.url.startsWith(base.origin))
    .filter((link) => RELEVANT_LINK_PATTERN.test(link.text) || RELEVANT_LINK_PATTERN.test(link.url))
    .map((link) => link.url);
}

function extractLinks(sourceUrl: string, html: string): { readonly url: string; readonly text: string }[] {
  const links: { url: string; text: string }[] = [];
  for (const match of html.matchAll(HREF_PATTERN)) {
    const href = match[1].trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) {
      continue;
    }
    try {
      const url = new URL(decodeHtml(href), sourceUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.hash = "";
        links.push({ url: url.toString(), text: stripHtml(match[2]) });
      }
    } catch {
      continue;
    }
  }
  return dedupeLinks(links);
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0].trim()).filter(Boolean))];
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s?-\s?/g, "-").trim();
}

function isLikelyPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 18) {
    return false;
  }
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value)) {
    return false;
  }
  return /[().+\-\s]/.test(value) || digits.length <= 11;
}

function isSocialUrl(value: string): boolean {
  try {
    return SOCIAL_HOST_PATTERN.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function observation(
  entity: string,
  type: string,
  value: string,
  sourceUrl: string,
  field: string,
  raw: Record<string, unknown> = {}
): ObservationInput {
  return {
    entity,
    type,
    value,
    source: SOURCE_ID,
    raw: { ...raw, field, sourceUrl }
  };
}

function dedupeLinks(links: readonly { readonly url: string; readonly text: string }[]): { readonly url: string; readonly text: string }[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) {
      return false;
    }
    seen.add(link.url);
    return true;
  });
}

function dedupeObservations(observations: readonly ObservationInput[]): ObservationInput[] {
  const seen = new Set<string>();
  return observations.filter((entry) => {
    const key = `${entry.type}\u0000${entry.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
