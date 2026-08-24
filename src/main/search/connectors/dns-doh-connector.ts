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
    // allSettled, not all: one record type erroring (a transient 5xx, a type
    // Cloudflare rejects) must not discard the other four record types that
    // already resolved. Only if every lookup fails do we re-throw, so the
    // orchestrator still reports this source as failed instead of silently
    // succeeding with zero observations, which would look identical to "this
    // domain genuinely has no DNS records."
    const settled = await Promise.allSettled(
      DNS_TYPES.map(async (recordType) => {
        const url = new URL("https://cloudflare-dns.com/dns-query");
        url.searchParams.set("name", seed.value);
        url.searchParams.set("type", recordType);
        // Cloudflare gates its JSON DoH responses on this media type; the
        // generic application/json default is answered with a 400.
        const payload = await context.fetchJson(url.toString(), {
          headers: { accept: "application/dns-json" },
          signal: context.signal
        });
        return parseDnsAnswer(seed, recordType, payload);
      })
    );

    const fulfilled = settled.filter(isFulfilled);
    if (fulfilled.length === 0) {
      const firstRejection = settled.find(isRejected);
      throw firstRejection?.reason instanceof Error ? firstRejection.reason : new Error("All DNS-over-HTTPS lookups failed");
    }

    return dedupeObservations(fulfilled.flatMap((result) => result.value));
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

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

function isRejected(result: PromiseSettledResult<unknown>): result is PromiseRejectedResult {
  return result.status === "rejected";
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
