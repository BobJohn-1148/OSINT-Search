/**
 * RDAP is a passive backbone source for registration and allocation facts
 * because it covers both domains and routable IPs without scraping WHOIS text.
 * If parsing here trusted the varied registry payloads, one unusual RDAP server
 * could break the whole search fan-out instead of yielding partial evidence.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString, asStringArray } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const SOURCE_ID = "rdap";

export const rdapConnector: SourceConnector = {
  id: SOURCE_ID,
  label: "RDAP",
  category: "domain",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "domain" || seedType === "ip";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const kind = seed.type === "ip" ? "ip" : "domain";
    const url = `https://rdap.org/${kind}/${encodeURIComponent(seed.value)}`;
    const payload = await context.fetchJson(url, { signal: context.signal });

    return parseRdap(seed, payload);
  }
};

function parseRdap(seed: SearchSeed, payload: unknown): ObservationInput[] {
  const record = asRecord(payload);
  const observations: ObservationInput[] = [observation(seed.value, seed.type, seed.value, { field: "query" })];

  pushString(observations, seed.value, "rdap-handle", record.handle, "handle");
  pushString(observations, seed.value, "rdap-name", record.name, "name");
  pushString(observations, seed.value, "rdap-country", record.country, "country");

  for (const status of asStringArray(record.status)) {
    observations.push(observation(seed.value, "rdap-status", status, { field: "status" }));
  }

  for (const nameserver of recordsFrom(record.nameservers)) {
    pushString(observations, seed.value, "nameserver", nameserver.ldhName, "nameserver");
  }

  for (const entity of recordsFrom(record.entities)) {
    pushString(observations, seed.value, "rdap-entity", entity.handle, "entity-handle");
    const roles = asStringArray(entity.roles);
    for (const role of roles) {
      observations.push(observation(seed.value, "rdap-role", role, { field: "entity.roles" }));
    }
  }

  for (const event of recordsFrom(record.events)) {
    const action = asString(event.eventAction);
    const date = asString(event.eventDate);
    if (action !== null && date !== null) {
      observations.push(observation(seed.value, "rdap-event", `${action}: ${date}`, { field: "events" }));
    }
  }

  const cidr = cidrFromNetwork(record);
  if (cidr !== null) {
    observations.push(observation(seed.value, "cidr", cidr, { field: "startAddress/endAddress/ipVersion" }));
  }

  return dedupeObservations(observations);
}

function recordsFrom(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((entry) => Object.keys(entry).length > 0) : [];
}

function pushString(
  observations: ObservationInput[],
  entity: string,
  type: string,
  value: unknown,
  field: string
): void {
  const text = asString(value);
  if (text !== null) {
    observations.push(observation(entity, type, text, { field }));
  }
}

function cidrFromNetwork(record: Record<string, unknown>): string | null {
  const startAddress = asString(record.startAddress);
  const endAddress = asString(record.endAddress);
  const ipVersion = asString(record.ipVersion);
  if (startAddress === null || endAddress === null || ipVersion === null) {
    return null;
  }

  return `${startAddress}-${endAddress} (${ipVersion})`;
}

function observation(entity: string, type: string, value: string, raw: Record<string, unknown>): ObservationInput {
  return {
    entity,
    type,
    value,
    source: SOURCE_ID,
    raw
  };
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
