/**
 * NVD is modeled as passive vulnerability enrichment from a product-like seed
 * because Reacher should correlate public CVE evidence without scanning the
 * target. If domain or business names were queried without normalization, broad
 * marketing words would create noisy findings that look stronger than they are.
 */
import type { ObservationInput, SearchSeed } from "../../../shared/types/search.js";
import { asRecord, asString, asStringArray } from "../http.js";
import type { SourceConnector } from "../source-connector.js";

const sourceId = "nvd";
const maxResults = "10";

export const nvdConnector: SourceConnector = {
  id: sourceId,
  label: "NVD",
  category: "vulnerability",
  tier: "passive",
  keyRequired: false,
  supports(seedType) {
    return seedType === "business" || seedType === "domain";
  },
  async run(seed, context) {
    const keywords = productKeywords(seed);
    if (keywords === null) {
      return [];
    }

    const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
    url.searchParams.set("keywordSearch", keywords);
    url.searchParams.set("resultsPerPage", maxResults);
    url.searchParams.set("noRejected", "");

    const response = asRecord(await context.fetchJson(url.toString(), { signal: context.signal }));
    const vulnerabilities = response.vulnerabilities;
    if (!Array.isArray(vulnerabilities)) {
      return [];
    }

    return vulnerabilities.flatMap((entry) => observationFromVulnerability(entry));
  }
};

function observationFromVulnerability(value: unknown): ObservationInput[] {
  const wrapper = asRecord(value);
  const cve = asRecord(wrapper.cve);
  const cveId = asString(cve.id);
  if (cveId === null) {
    return [];
  }

  const summary = englishDescription(cve.descriptions);
  const severity = highestSeverity(asRecord(cve.metrics));
  const display = summary === null ? cveId : `${cveId}: ${summary}`;

  return [
    {
      entity: `cve:${cveId.toLowerCase()}`,
      type: "vulnerability",
      value: display,
      source: sourceId,
      raw: {
        cveId,
        severity,
        published: asString(cve.published),
        lastModified: asString(cve.lastModified)
      }
    }
  ];
}

function productKeywords(seed: SearchSeed): string | null {
  if (seed.type === "business") {
    return normalizeKeywords(seed.value);
  }
  if (seed.type === "domain") {
    return normalizeKeywords(domainProductSeed(seed.value));
  }
  return null;
}

function domainProductSeed(value: string): string {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const labels = host.split(".").filter((label) => label.length > 0);
  const productLabel = labels.length > 1 ? labels[labels.length - 2] : labels[0] ?? "";
  return productLabel.replace(/[-_]+/g, " ");
}

function normalizeKeywords(value: string): string | null {
  const words = value
    .trim()
    .replace(/[^a-z0-9 ._-]/gi, " ")
    .split(/[\s._-]+/)
    .filter((word) => word.length >= 2)
    .slice(0, 4);

  if (words.length === 0) {
    return null;
  }

  return words.join(" ");
}

function englishDescription(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const entry of value) {
    const description = asRecord(entry);
    if (asString(description.lang) === "en") {
      return asString(description.value);
    }
  }

  return null;
}

function highestSeverity(metrics: Record<string, unknown>): string | null {
  const severities = [
    ...metricSeverities(metrics.cvssMetricV40),
    ...metricSeverities(metrics.cvssMetricV31),
    ...metricSeverities(metrics.cvssMetricV30),
    ...metricSeverities(metrics.cvssMetricV2)
  ];

  return severities[0] ?? null;
}

function metricSeverities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const metric = asRecord(entry);
    const directSeverity = asString(metric.baseSeverity);
    if (directSeverity !== null) {
      return [directSeverity];
    }

    const cvssData = asRecord(metric.cvssData);
    return asStringArray([cvssData.baseSeverity]);
  });
}
