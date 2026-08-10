/**
 * Search types model correlation instead of ranked results because every phase
 * after this depends on cited observations as evidence. If a connector returned
 * loose link lists, the scoring engine could not prove which sources corroborate
 * a claim.
 */
export const seedTypeValues = ["email", "ip", "phone", "username", "domain", "business", "mac"] as const;
export const sourceTierValues = ["passive", "active"] as const;
export const sourceCategoryValues = [
  "identity",
  "network",
  "domain",
  "breach",
  "hardware",
  "vulnerability",
  "business"
] as const;
export const strengthBandValues = ["single-source", "likely", "strong", "confirmed"] as const;
export const searchEventTypeValues = ["search:source-returned", "search:observations"] as const;

export type SeedType = (typeof seedTypeValues)[number];
export type SourceTier = (typeof sourceTierValues)[number];
export type SourceCategory = (typeof sourceCategoryValues)[number];
export type StrengthBand = (typeof strengthBandValues)[number];
export type SearchEventType = (typeof searchEventTypeValues)[number];

export interface SearchSeed {
  readonly type: SeedType;
  readonly value: string;
}

export interface ObservationInput {
  readonly entity: string;
  readonly type: string;
  readonly value: string;
  readonly source: string;
  readonly raw?: Record<string, unknown>;
}

export interface Observation extends ObservationInput {
  readonly id: string;
  readonly runId: string;
  readonly confidence: number;
}

export interface SourceStatus {
  readonly sourceId: string;
  readonly label: string;
  readonly status: "returned" | "failed";
  readonly observationCount: number;
  readonly error?: string;
}

export interface CorrelatedEntity {
  readonly entity: string;
  readonly type: string;
  readonly value: string;
  readonly sourceIds: string[];
  readonly strength: number;
  readonly band: StrengthBand;
}

export interface SearchTreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: "root" | "source" | "observation";
  readonly sourceId?: string;
  readonly observationId?: string;
  readonly entity?: string;
  readonly strength?: number;
  readonly band?: StrengthBand;
  readonly saveable: boolean;
  readonly pivotSeed?: SearchSeed;
  readonly children: SearchTreeNode[];
}

export interface SearchRunResult {
  readonly runId: string;
  readonly seed: SearchSeed;
  readonly startedTs: string;
  readonly completedTs: string | null;
  readonly statuses: SourceStatus[];
  readonly observations: Observation[];
  readonly entities: CorrelatedEntity[];
  readonly tree: SearchTreeNode;
}
