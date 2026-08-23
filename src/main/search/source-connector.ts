/**
 * Source connectors share one passive contract because the search surface is a
 * correlation engine, not a drawer of one-off lookup widgets. If each source
 * shaped observations differently, the merger could not isolate failures or
 * compute confidence from independent corroboration.
 */
import type { ObservationInput, SearchSeed, SeedType, SourceCategory, SourceTier } from "../../shared/types/search.js";
import type { KeySource } from "../../shared/types/sources.js";

export interface SourceConnector {
  readonly id: string;
  readonly label: string;
  readonly category: SourceCategory;
  readonly tier: SourceTier;
  readonly keyRequired: boolean;
  // The vault key this connector reads, when it needs one. Declaring it lets the
  // orchestrator resolve and audit exactly one secret per connector instead of
  // handing every connector the whole vault.
  readonly keySource?: KeySource;
  supports(seedType: SeedType): boolean;
  run(seed: SearchSeed, context: SourceRunContext): Promise<readonly ObservationInput[]>;
}

export interface SourceRunContext {
  readonly signal?: AbortSignal;
  // The resolved secret for this connector's keySource, or null when no key is
  // stored. Resolved once by the orchestrator so a connector never touches the
  // vault directly and the read stays audited at one gate.
  readonly apiKey?: string | null;
  fetchJson(url: string, init?: RequestInit): Promise<unknown>;
}
