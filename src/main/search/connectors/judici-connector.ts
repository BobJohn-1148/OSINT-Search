/**
 * Judici public access is court-scoped, so this connector creates a verified
 * handoff to the participating-court selector instead of fabricating statewide
 * case-search results from a name.
 */
import type { ObservationInput } from "../../../shared/types/search.js";
import type { SourceConnector } from "../source-connector.js";

const sourceId = "judici";
const homeUrl = "https://www.judici.com/index.jsp";
const courtListUrl = "https://www.judici.com/courts/court_list.jsp";

export const judiciConnector: SourceConnector = {
  id: sourceId,
  label: "Judici public courts",
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

    return Promise.resolve([
      {
        entity: `public-record:${sourceId}:${query.toLowerCase()}`,
        type: "court-record-lookup",
        value: `Judici participating-court lookup for ${query}`,
        source: sourceId,
        raw: {
          query,
          lookupUrl: courtListUrl,
          homeUrl,
          mode: "select participating court, then search within that court",
          participatingCourts: 82,
          availableData: [
            "litigant info",
            "criminal charges, dispositions and sentences",
            "civil judgments",
            "fines, fees, balances, and payment details",
            "hearing dates",
            "case minutes",
            "will indexes",
            "documents"
          ],
          note: "Judici public access is court-scoped; choose the relevant participating court before searching the name."
        }
      }
    ] satisfies ObservationInput[]);
  }
};

function normalizeQuery(value: string): string | null {
  const query = value.trim().replace(/\s+/g, " ");
  return query.length > 0 ? query : null;
}
