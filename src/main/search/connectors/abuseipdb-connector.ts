/**
 * AbuseIPDB is represented now as a passive IP connector with an explicit key
 * requirement so the catalog can show future capability without weakening vault
 * boundaries. Until the runner can supply vetted secrets, returning no
 * observations avoids hidden environment reads or unaudited key handling.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

export const abuseIpDbConnector: SourceConnector = {
  id: "abuseipdb",
  label: "AbuseIPDB",
  category: "network",
  tier: "passive",
  keyRequired: true,
  supports(seedType: SeedType): boolean {
    return seedType === "ip";
  },
  run(_seed: SearchSeed, _context: SourceRunContext): Promise<readonly ObservationInput[]> {
    void _seed;
    void _context;
    return Promise.resolve([]);
  }
};
