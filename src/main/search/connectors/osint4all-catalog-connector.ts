/**
 * OSINT4ALL is a link directory, not one API. This connector turns the public
 * catalog into cited "next resource" observations so every search carries the
 * relevant tools without attempting to automate 1,400+ third-party sites.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const SOURCE_ID = "osint4all-catalog";
const CATALOG_SOURCE_URL = "https://raw.githubusercontent.com/osint4all/osint4all.github.io/main/README.md";
const CATALOG_PAGE_URL = "https://start.me/p/L1rEYQ/osint4all";
const MAX_RESULTS = 75;
const LINK_PATTERN = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/;

interface CatalogLink {
  readonly category: string;
  readonly title: string;
  readonly url: string;
}

let catalogCache: readonly CatalogLink[] | null = null;

export const osint4AllCatalogConnector: SourceConnector = {
  id: SOURCE_ID,
  label: "OSINT4ALL tools",
  category: "identity",
  tier: "passive",
  keyRequired: false,
  supports(): boolean {
    return true;
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const catalog = await loadCatalog(context);
    return selectRelevantLinks(seed, catalog)
      .slice(0, MAX_RESULTS)
      .map((link) => ({
        entity: seed.value,
        type: "osint-tool",
        value: `${link.title} — ${link.url}`,
        source: SOURCE_ID,
        raw: {
          category: link.category,
          title: link.title,
          url: link.url,
          catalogSource: CATALOG_PAGE_URL,
          mirrorSource: CATALOG_SOURCE_URL
        }
      }));
  }
};

export function parseOsint4AllCatalog(markdown: string): CatalogLink[] {
  let category = "Uncategorized";
  const links: CatalogLink[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      category = cleanMarkdownText(heading[1]);
      continue;
    }

    const link = LINK_PATTERN.exec(line.trim());
    if (!link) {
      continue;
    }

    const title = cleanMarkdownText(link[1]);
    const url = link[2];
    if (title && url) {
      links.push({ category, title, url });
    }
  }

  return dedupeCatalogLinks(links);
}

export function selectRelevantLinks(seed: SearchSeed, catalog: readonly CatalogLink[]): CatalogLink[] {
  return catalog
    .map((link) => ({ link, score: relevanceScore(seed, link) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.link.category.localeCompare(b.link.category) || a.link.title.localeCompare(b.link.title))
    .map((entry) => entry.link);
}

async function loadCatalog(context: SourceRunContext): Promise<readonly CatalogLink[]> {
  if (catalogCache !== null) {
    return catalogCache;
  }

  const markdown = await context.fetchText(CATALOG_SOURCE_URL, { signal: context.signal });
  catalogCache = parseOsint4AllCatalog(markdown);
  return catalogCache;
}

function relevanceScore(seed: SearchSeed, link: CatalogLink): number {
  const haystack = `${link.category} ${link.title} ${link.url}`.toLowerCase();
  const category = normalizeCategory(link.category);
  let score = categoryScore(seed.type, category);

  for (const keyword of seedKeywords(seed.type)) {
    if (haystack.includes(keyword)) {
      score += 1;
    }
  }

  if (seed.value.trim() && haystack.includes(seed.value.trim().toLowerCase())) {
    score += 2;
  }

  return score;
}

function categoryScore(seedType: SeedType, category: string): number {
  const categoryMatches: Record<SeedType, readonly RegExp[]> = {
    business: [/business|corporation|company|public records|government|search engines|google cse|people/i],
    domain: [/domain|dns|ip|threat intel|malware|iot|analytics|open directory|search engines|google cse/i],
    email: [/email|data breach|data dump|people|search engines|google cse|threat intel/i],
    image: [/image|video|audio|media|imint|geo/i],
    ip: [/domain|dns|ip|threat intel|malware|iot|analytics/i],
    mac: [/domain|dns|ip|iot|toolset|hardware/i],
    phone: [/phone|people|public records|business|government|search engines|google cse/i],
    username: [/username|social media|twitter|x\b|facebook|instagram|reddit|telegram|discord|tiktok|youtube|twitch|github|people/i]
  };

  return categoryMatches[seedType].some((pattern) => pattern.test(category)) ? 5 : 0;
}

function seedKeywords(seedType: SeedType): readonly string[] {
  const keywords: Record<SeedType, readonly string[]> = {
    business: ["business", "company", "corporation", "registry", "filing", "linkedin", "opencorporates"],
    domain: ["domain", "dns", "subdomain", "whois", "urlscan", "website", "certificate", "archive"],
    email: ["email", "breach", "leak", "mail", "hunter", "harvester"],
    image: ["image", "photo", "video", "reverse", "exif", "media", "geolocation"],
    ip: ["ip", "dns", "shodan", "censys", "urlscan", "virustotal", "threat"],
    mac: ["mac", "vendor", "oui", "device", "iot"],
    phone: ["phone", "number", "sms", "caller", "carrier", "reverse"],
    username: ["username", "social", "profile", "account", "twitter", "instagram", "facebook", "reddit", "telegram", "discord"]
  };
  return keywords[seedType];
}

function normalizeCategory(value: string): string {
  return value.replaceAll("\\", "").toLowerCase();
}

function cleanMarkdownText(value: string): string {
  return value
    .replaceAll("\\[", "[")
    .replaceAll("\\]", "]")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeCatalogLinks(links: readonly CatalogLink[]): CatalogLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = link.url.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
