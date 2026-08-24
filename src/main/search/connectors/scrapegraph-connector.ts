/**
 * ScrapeGraph is the only source that reads a page instead of an API, so it is
 * what turns a bare domain or business name into contact-shaped facts no
 * registry exposes. It is shaped as an ordinary connector rather than a
 * special-cased pipeline so it inherits per-source failure isolation, the
 * concurrency cap, and the abort signal — a headless browser that hangs must not
 * be able to take the rest of the fan-out with it.
 *
 * Passive tier: it fetches public pages the same way a browser would and does
 * not touch the target's infrastructure beyond an ordinary page load.
 */
import type { ObservationInput, SearchSeed, SeedType } from "../../../shared/types/search.js";
import { normalizeScrapeGraphObservations, runScrapeGraphWorker } from "../scrapegraph-worker.js";
import type { SourceConnector, SourceRunContext } from "../source-connector.js";

const sourceId = "scrapegraph-ai";

export const scrapeGraphConnector: SourceConnector = {
  id: sourceId,
  label: "ScrapeGraph AI",
  category: "business",
  tier: "passive",
  keyRequired: true,
  keySource: "openai",
  supports(seedType: SeedType): boolean {
    return seedType === "domain" || seedType === "business";
  },
  async run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]> {
    if (!context.apiKey) {
      // Matches every other keyed connector: with no key stored the source stays
      // quiet rather than reporting a failure the investigator cannot act on
      // from the results board.
      return [];
    }
    const output = await runScrapeGraphWorker({ seed }, context.apiKey, context.signal);
    return normalizeScrapeGraphObservations(seed, output, sourceId);
  }
};
