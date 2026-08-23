/**
 * GovSalaries is exposed as a passive lookup handoff because the public site is
 * already searchable, but Reacher should not imply it verified a person match
 * unless a source API or reviewed record actually returned structured evidence.
 */
import type { ObservationInput } from "../../../shared/types/search.js";
import type { SourceConnector } from "../source-connector.js";

const sourceId = "govsalaries";
const homeUrl = "https://govsalaries.com/";

export const govSalariesConnector: SourceConnector = {
  id: sourceId,
  label: "GovSalaries",
  category: "public-records",
  tier: "passive",
  keyRequired: false,
  supports(seedType) {
    return seedType === "name" || seedType === "business";
  },
  run(seed) {
    const query = normalizeQuery(seed.value);
    if (query === null) {
      return Promise.resolve([]);
    }

    const lookupUrl = seed.type === "business" ? employerSearchUrl(query) : employeeSearchUrl(query);
    return Promise.resolve([
      {
        entity: `public-record:${sourceId}:${query.toLowerCase()}`,
        type: seed.type === "business" ? "public-employer-lookup" : "public-salary-lookup",
        value: `GovSalaries ${seed.type === "business" ? "employer" : "employee"} lookup for ${query}`,
        source: sourceId,
        raw: {
          query,
          lookupUrl,
          homeUrl,
          recordsAdvertised: "150M+",
          employersAdvertised: "60.8k",
          fcraRestricted: true,
          note: "External public-record lookup; verify identity before treating salary records as a match."
        }
      }
    ] satisfies ObservationInput[]);
  }
};

function normalizeQuery(value: string): string | null {
  const query = value.trim().replace(/\s+/g, " ");
  return query.length > 0 ? query : null;
}

function employeeSearchUrl(query: string): string {
  const url = new URL("/search", homeUrl);
  url.searchParams.set("employee", query);
  return url.toString();
}

function employerSearchUrl(query: string): string {
  const url = new URL("/search", homeUrl);
  url.searchParams.set("employer", query);
  return url.toString();
}
