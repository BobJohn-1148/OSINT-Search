/**
 * DNS-over-HTTPS keeps DNS lookup passive and platform-neutral for the Windows
 * desktop app. If the connector depended on local resolver behavior, searches
 * would vary by machine network policy and correlation evidence would be harder
 * to reproduce.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const SOURCE_ID = "dns-doh";
const DNS_TYPES = ["A", "AAAA", "MX", "NS", "TXT"] as const;

export const dnsDohConnector: SourceConnector = {
  id: SOURCE_ID,
  label: "DNS over HTTPS",
  category: "network",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "domain";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const results = await Promise.all(
      DNS_TYPES.map(async (recordType) => {
        const url = new URL("https://cloudflare-dns.com/dns-query");
        url.searchParams.set("name", seed.value);
        url.searchParams.set("type", recordType);
        const payload = await context.fetchJson(url.toString(), { signal: context.signal });
        return parseDnsAnswer(seed, recordType, payload);
      })
    );

    return dedupeObservations(results.flat());
  }
};

function parseDnsAnswer(seed: SearchSeed, recordType: string, payload: unknown): ObservationInput[] {
  const record = asRecord(payload);
  const answer = Array.isArray(record.Answer) ? record.Answer : [];
  const observations: ObservationInput[] = [];

  for (const item of answer) {
    const answerRecord = asRecord(item);
    const data = asString(answerRecord.data);
    if (data === null) {
      continue;
    }

    observations.push({
      entity: seed.value,
      type: `dns-${recordType.toLowerCase()}`,
      value: cleanDnsData(recordType, data),
      source: SOURCE_ID,
      raw: {
        recordType,
        ttl: answerRecord.TTL
      }
    });
  }

  return observations;
}

function cleanDnsData(recordType: string, value: string): string {
  if (recordType === "TXT") {
    return value.replaceAll("\"", "");
  }

  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function dedupeObservations(observations: readonly ObservationInput[]): ObservationInput[] {
  const seen = new Set<string>();
  return observations.filter((entry) => {
    const key = `${entry.entity}\u0000${entry.type}\u0000${entry.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
