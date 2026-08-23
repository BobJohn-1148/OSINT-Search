/**
 * IPinfo is kept as a passive IP enrichment connector so network identity facts
 * enter search as cited observations instead of UI-only decoration. If location
 * or ASN parsing lived in the renderer, saved evidence would drift from what
 * the search engine actually evaluated.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

export const ipinfoConnector: SourceConnector = {
  id: "ipinfo",
  label: "IPinfo",
  category: "network",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "ip";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const response = asRecord(
      await context.fetchJson(`https://ipinfo.io/${encodeURIComponent(seed.value)}/json`, { signal: context.signal })
    );
    const ip = asString(response.ip) ?? seed.value;
    const location = joinParts([asString(response.city), asString(response.region), asString(response.country)]);
    const coordinates = asString(response.loc);
    const observations = [
      maybeObservation(ip, "hostname", asString(response.hostname), response),
      maybeObservation(ip, "organization", asString(response.org), response),
      maybeObservation(ip, "location", location, response),
      maybeObservation(ip, "coordinates", coordinates, response),
      maybeObservation(ip, "timezone", asString(response.timezone), response),
      maybeObservation(ip, "postal-code", asString(response.postal), response)
    ];

    return observations.filter((entry): entry is ObservationInput => entry !== null);
  }
};

function maybeObservation(
  entity: string,
  type: string,
  value: string | null,
  raw: Record<string, unknown>
): ObservationInput | null {
  if (value === null) {
    return null;
  }

  return {
    entity,
    type,
    value,
    source: ipinfoConnector.id,
    raw
  };
}

function joinParts(parts: readonly (string | null)[]): string | null {
  const present = parts.filter((part): part is string => part !== null);
  return present.length > 0 ? present.join(", ") : null;
}
