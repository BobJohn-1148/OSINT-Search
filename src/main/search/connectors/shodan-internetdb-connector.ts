/**
 * Shodan InternetDB stays isolated as a passive IP connector because it returns
 * unauthenticated internet exposure facts that should corroborate, not drive,
 * search confidence. If its response shape leaked into the orchestrator, one
 * source outage or schema change would break unrelated correlation work.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString, asStringArray } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

export const shodanInternetDbConnector: SourceConnector = {
  id: "shodan-internetdb",
  label: "Shodan InternetDB",
  category: "network",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "ip";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const response = asRecord(
      await context.fetchJson(`https://internetdb.shodan.io/${encodeURIComponent(seed.value)}`, { signal: context.signal })
    );
    const ip = asString(response.ip) ?? seed.value;
    const observations: ObservationInput[] = [
      ...asStringArray(response.hostnames).map((hostname) => observation(ip, "hostname", hostname, response)),
      ...asNumberArray(response.ports).map((port) => observation(ip, "open-port", String(port), response)),
      ...asStringArray(response.cpes).map((cpe) => observation(ip, "cpe", cpe, response)),
      ...asStringArray(response.vulns).map((vulnerability) => observation(ip, "vulnerability", vulnerability, response)),
      ...asStringArray(response.tags).map((tag) => observation(ip, "network-tag", tag, response))
    ];

    return observations;
  }
};

function observation(entity: string, type: string, value: string, raw: Record<string, unknown>): ObservationInput {
  return {
    entity,
    type,
    value,
    source: shodanInternetDbConnector.id,
    raw
  };
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is number => Number.isInteger(entry));
}
