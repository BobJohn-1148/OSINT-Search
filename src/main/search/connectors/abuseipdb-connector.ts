/**
 * AbuseIPDB is the proof that a key-based search source works once a key is
 * stored: it declares its vault keySource, and the orchestrator resolves the
 * secret (audited) into context.apiKey. With no key it degrades to zero
 * observations rather than throwing, so an unconfigured source is quiet, not a
 * failure — and the secret never leaves the main process or the vault gate.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const sourceId = "abuseipdb";

export const abuseIpDbConnector: SourceConnector = {
  id: sourceId,
  label: "AbuseIPDB",
  category: "network",
  tier: "passive",
  keyRequired: true,
  keySource: "abuseipdb",
  supports(seedType: SeedType): boolean {
    return seedType === "ip";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    if (!context.apiKey) {
      // No key stored — stay silent instead of erroring, so the source simply
      // does not contribute until the investigator adds a key in Settings.
      return [];
    }
    const url = new URL("https://api.abuseipdb.com/api/v2/check");
    url.searchParams.set("ipAddress", seed.value.trim());
    url.searchParams.set("maxAgeInDays", "90");

    const payload = asRecord(
      await context.fetchJson(url.toString(), { headers: { Key: context.apiKey }, signal: context.signal })
    );
    const data = asRecord(payload.data);
    const entity = `ip:${seed.value.trim()}`;
    const score = typeof data.abuseConfidenceScore === "number" ? data.abuseConfidenceScore : null;

    const observations: (ObservationInput | null)[] = [
      score === null
        ? null
        : {
            entity,
            type: "abuse-score",
            value: `Abuse confidence ${score}%`,
            source: sourceId,
            raw: { ...data, lookupUrl: `https://www.abuseipdb.com/check/${encodeURIComponent(seed.value.trim())}` }
          },
      fact(entity, "total-reports", numberText(data.totalReports, "reports (90d)"), data),
      fact(entity, "country", asString(data.countryCode), data),
      fact(entity, "isp", asString(data.isp), data),
      fact(entity, "domain", asString(data.domain), data),
      fact(entity, "usage-type", asString(data.usageType), data),
      fact(entity, "last-reported", asString(data.lastReportedAt), data),
      data.isTor === true ? { entity, type: "tor-exit", value: "Listed as a Tor exit node", source: sourceId, raw: data } : null
    ];

    return observations.filter((observation): observation is ObservationInput => observation !== null);
  }
};

function fact(entity: string, type: string, value: string | null, raw: Record<string, unknown>): ObservationInput | null {
  return value === null ? null : { entity, type, value, source: sourceId, raw };
}

function numberText(value: unknown, label: string): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${value} ${label}` : null;
}
