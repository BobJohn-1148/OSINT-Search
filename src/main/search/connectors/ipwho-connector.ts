/**
 * ipwho.is is a keyless IP intelligence source that adds the routing and carrier
 * facts ipinfo's free tier omits — explicit ASN, ISP, org, and connection domain
 * — with no signup. It complements the other IP connectors rather than repeating
 * them, and a lookup the API marks unsuccessful returns empty instead of a source
 * failure so a bad IP does not read like an outage.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const sourceId = "ipwho";

export const ipwhoConnector: SourceConnector = {
  id: sourceId,
  label: "ipwho.is",
  category: "network",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "ip";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const ip = seed.value.trim();
    const response = asRecord(await context.fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: context.signal }));
    if (response.success !== true) {
      return []; // API reports the address could not be resolved.
    }
    const entity = `ip:${ip}`;
    const connection = asRecord(response.connection);
    const timezone = asRecord(response.timezone);
    const location = joinParts([asString(response.city), asString(response.region), asString(response.country)]);
    const asnId = typeof connection.asn === "number" ? connection.asn : null;

    const observations: (ObservationInput | null)[] = [
      fact(entity, "location", location, response),
      coordinateFact(entity, response),
      fact(entity, "country", joinParts([asString(response.country), asString(response.country_code)]), response),
      asnId === null && asString(connection.org) === null
        ? null
        : {
            entity,
            type: "asn",
            value: [asnId === null ? null : `AS${asnId}`, asString(connection.org)].filter((part): part is string => part !== null).join(" "),
            source: sourceId,
            raw: { ...connection, lookupUrl: asnId === null ? undefined : `https://bgp.he.net/AS${asnId}` }
          },
      fact(entity, "isp", asString(connection.isp), connection),
      fact(entity, "connection-domain", asString(connection.domain), connection),
      fact(entity, "timezone", asString(timezone.id), timezone),
      fact(entity, "postal-code", asString(response.postal), response),
      fact(entity, "calling-code", asString(response.calling_code), response)
    ];

    return observations.filter((observation): observation is ObservationInput => observation !== null);
  }
};

function fact(entity: string, type: string, value: string | null, raw: Record<string, unknown>): ObservationInput | null {
  return value === null ? null : { entity, type, value, source: sourceId, raw };
}

function coordinateFact(entity: string, response: Record<string, unknown>): ObservationInput | null {
  const latitude = response.latitude;
  const longitude = response.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  return { entity, type: "coordinates", value: `${latitude},${longitude}`, source: sourceId, raw: response };
}

function joinParts(parts: readonly (string | null)[]): string | null {
  const present = parts.filter((part): part is string => part !== null);
  return present.length > 0 ? present.join(", ") : null;
}
