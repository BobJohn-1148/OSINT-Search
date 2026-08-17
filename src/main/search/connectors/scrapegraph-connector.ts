import type { SearchSeed, SeedType } from "../../../shared/types/search.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";
import { normalizeScrapeGraphObservations, runScrapeGraphWorker } from "../scrapegraph-worker.js";

const SOURCE_ID = "scrapegraph-ai";

export const scrapeGraphConnector: SourceConnector = {
  id: SOURCE_ID,
  label: "ScrapeGraph AI",
  category: "business",
  tier: "passive",
  keyRequired: true,
  supports(seedType: SeedType): boolean {
    return seedType === "domain" || seedType === "business";
  },
  async run(seed: SearchSeed, context: SourceRunContext) {
    const output = await runScrapeGraphWorker({ seed }, context.signal);
    return normalizeScrapeGraphObservations(seed, output, SOURCE_ID);
  }
};
