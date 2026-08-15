/**
 * Source connectors share one passive contract because the search surface is a
 * correlation engine, not a drawer of one-off lookup widgets. If each source
 * shaped observations differently, the merger could not isolate failures or
 * compute confidence from independent corroboration.
 */
import type { ObservationInput, SearchSeed, SeedType, SourceCategory, SourceTier } from "../../shared/types/search.js";

export interface SourceConnector {
  readonly id: string;
  readonly label: string;
  readonly category: SourceCategory;
  readonly tier: SourceTier;
  readonly keyRequired: boolean;
  supports(seedType: SeedType): boolean;
  run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]>;
}

export interface SourceRunContext {
  readonly signal?: AbortSignal;
  fetchJson(url: string, init?: RequestInit): Promise<unknown>;
}
