/**
 * Gravatar is a keyless email pivot: an email hashed to MD5 addresses a public
 * profile if the owner made one, often exposing a display name, location, and
 * linked social accounts. It is the free way to turn an email seed into identity
 * leads with no signup. A hash with no profile 404s, which is a clean "nothing
 * public here" rather than an error.
 */
import { createHash } from "node:crypto";
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { asRecord, asString, HttpLookupError } from "../http.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const sourceId = "gravatar";

export const gravatarConnector: SourceConnector = {
  id: sourceId,
  label: "Gravatar",
  category: "identity",
  tier: "passive",
  keyRequired: false,
  supports(seedType: SeedType): boolean {
    return seedType === "email";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    const email = seed.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return [];
    }
    const hash = createHash("md5").update(email).digest("hex");
    const entity = `email:${email}`;

    let payload: Record<string, unknown>;
    try {
      payload = asRecord(await context.fetchJson(`https://www.gravatar.com/${hash}.json`, { signal: context.signal }));
    } catch (error) {
      if (error instanceof HttpLookupError && error.message.includes("404")) {
        return []; // No public Gravatar for this address.
      }
      throw error;
    }

    const entry = asRecord(Array.isArray(payload.entry) ? payload.entry[0] : {});
    const profileUrl = asString(entry.profileUrl);
    const observations: (ObservationInput | null)[] = [
      {
        entity,
        type: "gravatar-profile",
        value: `Gravatar profile for ${email}`,
        source: sourceId,
        raw: { hash, ...entry, lookupUrl: profileUrl ?? `https://www.gravatar.com/${hash}` }
      },
      fact(entity, "display-name", asString(entry.displayName), entry),
      usernameFact(entity, asString(entry.preferredUsername), entry),
      fact(entity, "location", asString(entry.currentLocation), entry),
      fact(entity, "about", asString(entry.aboutMe), entry)
    ];

    for (const account of asRecordArray(entry.accounts)) {
      const url = asString(account.url);
      const shortname = asString(account.shortname) ?? asString(account.domain) ?? "account";
      const username = asString(account.username);
      if (url) {
        observations.push({
          entity,
          type: "linked-account",
          value: `${shortname}${username ? ` (${username})` : ""}`,
          source: sourceId,
          raw: { ...account, lookupUrl: url, ...(username ? { pivotSeed: { type: "username", value: username } } : {}) }
        });
      }
    }

    return observations.filter((observation): observation is ObservationInput => observation !== null);
  }
};

function fact(entity: string, type: string, value: string | null, raw: Record<string, unknown>): ObservationInput | null {
  return value === null ? null : { entity, type, value, source: sourceId, raw };
}

function usernameFact(entity: string, username: string | null, raw: Record<string, unknown>): ObservationInput | null {
  if (username === null) {
    return null;
  }
  return { entity, type: "username", value: username, source: sourceId, raw: { ...raw, pivotSeed: { type: "username", value: username } } };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((entry) => asRecord(entry)) : [];
}
