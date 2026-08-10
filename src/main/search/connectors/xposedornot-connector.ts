/**
 * XposedOrNot stays isolated as a passive breach connector because email
 * exposure lookups carry higher privacy risk than generic enrichment. If this
 * parsing leaked raw provider shapes into the orchestrator, one response change
 * could either expose noisy detail or break every other source in the fan-out.
 */
import type { ObservationInput } from "../../../shared/types/search.js";
import { asRecord, asString, asStringArray } from "../http.js";
import type { SourceConnector } from "../source-connector.js";

const sourceId = "xposedornot";

export const xposedOrNotConnector: SourceConnector = {
  id: sourceId,
  label: "XposedOrNot",
  category: "breach",
  tier: "passive",
  keyRequired: false,
  supports(seedType) {
    return seedType === "email";
  },
  async run(seed, context) {
    if (seed.type !== "email") {
      return [];
    }

    const email = seed.value.trim().toLowerCase();
    if (!isEmail(email)) {
      return [];
    }

    const response = asRecord(
      await context.fetchJson(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, {
        signal: context.signal
      })
    );

    return breachNames(response)
      .map((breachName) => breachName.trim())
      .filter((breachName, index, all) => breachName.length > 0 && all.indexOf(breachName) === index)
      .map((breachName): ObservationInput => ({
        entity: `breach:${breachName.toLowerCase()}`,
        type: "breach",
        value: breachName,
        source: sourceId,
        raw: {
          email,
          breachName
        }
      }));
  }
};

function breachNames(response: Record<string, unknown>): string[] {
  const flatBreaches = asStringArray(response.breaches);
  if (flatBreaches.length > 0) {
    return flatBreaches;
  }

  const nestedBreaches = response.breaches;
  if (Array.isArray(nestedBreaches)) {
    return nestedBreaches.flatMap((entry) => asStringArray(entry));
  }

  const singleBreach = asString(response.breach);
  return singleBreach === null ? [] : [singleBreach];
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
