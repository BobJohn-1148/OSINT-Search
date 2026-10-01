/**
 * The results model is a pure function of what the sources actually returned, because the investigator
 * must be able to trust every number, band and graph edge on screen. If this logic lived inside the
 * component, a layout tweak could quietly change what counts as "corroborated", and nothing would
 * fail. Everything here is derived from observations and source statuses only: no sample links, no
 * inferred identity, no confidence typed by the UI.
 *
 * Corroboration is recomputed from the observations with the same exact-match rule the main-process
 * correlator uses (kind + entity + type + value, counted over distinct known upstream families) instead of trusting
 * `run.entities`. Rejected: reading the band off `run.entities`. A stale or hand-built entity row
 * could then promote a fact the observations do not support; recomputing can only ever agree with, or
 * be stricter than, the data in front of the investigator.
 */
import type { Observation, ObservationKind, PublicRecordSourcePolicy, SearchRunResult, SearchSeed, SearchTreeNode, SourceStatus, StrengthBand } from "../../shared/types/search";

export type EvidenceFilter = "all" | "corroborated" | "single";
export type SourceState = "returned" | "failed" | "skipped" | "observed";

export interface EvidenceFact {
  readonly key: string;
  readonly kind: ObservationKind;
  readonly entity: string;
  readonly type: string;
  readonly value: string;
  readonly sourceIds: readonly string[];
  readonly upstreamFamilyIds: readonly string[];
  readonly band: StrengthBand;
  readonly corroborated: boolean;
  readonly observations: readonly Observation[];
}

export interface SourceRow {
  readonly sourceId: string;
  /** The run was stopped before this source finished. Not an error, and still never evidence of absence. */
  readonly cancelled?: boolean;
  readonly label: string;
  readonly state: SourceState;
  readonly stateLabel: string;
  readonly count: number | null;
  readonly summary: string;
  readonly detail: string;
  readonly warning?: string;
  readonly policy?: PublicRecordSourcePolicy;
}

export interface ResultTotals {
  readonly observations: number;
  readonly sourcesWithEvidence: number;
  readonly uniqueFacts: number;
  readonly corroboratedFacts: number;
  readonly failedSources: number;
  readonly skippedSources: number;
  readonly cancelledSources: number;
  readonly returnedSources: number;
  readonly partialSources: number;
  readonly totalSources: number;
}

export interface EvidenceQuery {
  readonly filter: EvidenceFilter;
  readonly text: string;
  readonly sourceId: string | null;
}

export function bandForSourceCount(count: number): StrengthBand {
  if (count >= 4) {
    return "confirmed";
  }
  if (count === 3) {
    return "strong";
  }
  if (count === 2) {
    return "likely";
  }
  return "single-source";
}

export function bandLabel(band: StrengthBand, sourceCount: number, kind: ObservationKind = "evidence"): string {
  if (kind === "discovery") {
    return "Discovery resource · not evidence";
  }
  if (band === "single-source") {
    return "Single source · uncorroborated";
  }
  return `Exact match · ${sourceCount} upstream families`;
}

function normalizeEntity(entity: string): string {
  return entity.trim().toLowerCase();
}

function normalizeFactText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Same normalisation as the main-process correlator, so the two can never disagree about what "exact" means. */
export function factKey(fact: Pick<Observation, "entity" | "type" | "value" | "kind">): string {
  const kind = fact.kind ?? "evidence";
  return `${kind}\u0000${normalizeEntity(fact.entity)}\u0000${normalizeFactText(fact.type)}\u0000${normalizeFactText(fact.value)}`;
}

export function buildFacts(observations: readonly Observation[]): EvidenceFact[] {
  const grouped = new Map<string, Observation[]>();
  for (const observation of observations) {
    const key = factKey(observation);
    const group = grouped.get(key);
    if (group) {
      group.push(observation);
    } else {
      grouped.set(key, [observation]);
    }
  }
  const facts: EvidenceFact[] = [];
  for (const [key, group] of grouped) {
    // Every map bucket is created alongside its first observation above.
    const first = group[0];
    const sourceIds = [...new Set(group.map((observation) => observation.source))].sort();
    const upstreamFamilyIds = [...new Set(group.flatMap((observation) => observation.upstreamFamilyId ? [observation.upstreamFamilyId] : []))].sort();
    const kind = first.kind ?? "evidence";
    const sourceCount = Math.max(1, upstreamFamilyIds.length);
    facts.push({
      key,
      kind,
      entity: first.entity,
      type: first.type,
      value: first.value,
      sourceIds,
      upstreamFamilyIds,
      band: bandForSourceCount(kind === "discovery" ? 1 : sourceCount),
      corroborated: kind === "evidence" && upstreamFamilyIds.length > 1,
      observations: group
    });
  }
  return facts.sort(
    (a, b) =>
      b.upstreamFamilyIds.length - a.upstreamFamilyIds.length ||
      a.type.localeCompare(b.type) ||
      a.value.localeCompare(b.value, undefined, { numeric: true }) ||
      a.entity.localeCompare(b.entity)
  );
}

/**
 * A finished run normally carries its observations. When it carries none, the tree is the only record of
 * what came back; the tree does not store an observation type, so those rows say so instead of borrowing
 * the seed's type (which would present a guess as a source-returned field).
 */
export function observationsForOutput(run: SearchRunResult | null, liveObservations: readonly Observation[]): Observation[] {
  if (!run) {
    return [...liveObservations];
  }
  if (run.observations.length > 0) {
    return [...run.observations];
  }
  return treeObservations(run.tree, run.runId, run.seed);
}

function treeObservations(root: SearchTreeNode, runId: string, seed: SearchSeed): Observation[] {
  const observations: Observation[] = [];
  const visit = (node: SearchTreeNode): void => {
    if (node.kind === "observation" && node.observationId) {
      observations.push({
        id: node.observationId,
        runId,
        kind: node.recordKind ?? "evidence",
        entity: node.entity ?? seed.value,
        type: "observation",
        value: node.label,
        source: node.sourceId ?? "search",
        confidence: node.strength ?? 1,
        raw: { treeNodeId: node.id }
      });
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return observations;
}

const TIMEOUT_PATTERN = /\btime(?:d)?[ -]?out\b/i;

export function buildSourceRows(statuses: readonly SourceStatus[], observations: readonly Observation[]): SourceRow[] {
  const counts = new Map<string, number>();
  for (const observation of observations) {
    counts.set(observation.source, (counts.get(observation.source) ?? 0) + 1);
  }
  const rows: SourceRow[] = [];
  const seen = new Set<string>();
  for (const status of statuses) {
    if (seen.has(status.sourceId)) {
      continue;
    }
    seen.add(status.sourceId);
    if (status.status === "skipped") {
      rows.push({
        sourceId: status.sourceId,
        label: status.label,
        state: "skipped",
        stateLabel: "Skipped",
        count: null,
        summary: status.error ?? "Not run by the current source policy",
        detail: `${status.error ?? "This source was not run."} Skipped sources have no result; they are not evidence that the seed is absent or safe.`,
        ...(status.policy === undefined ? {} : { policy: status.policy })
      });
    } else if (status.status === "failed") {
      const timedOut = TIMEOUT_PATTERN.test(status.error ?? "");
      // A cancelled source did not fail: the run was stopped. It is still "not returned" (never evidence of absence), but it
      // must read as cancelled, not as an error.
      const cancelled = status.failureKind === "cancelled";
      rows.push({
        sourceId: status.sourceId,
        label: status.label,
        state: "failed",
        ...(cancelled ? { cancelled: true } : {}),
        stateLabel: cancelled ? "Cancelled" : timedOut ? "Timed out" : "Failed",
        count: null,
        summary: cancelled ? "Cancelled before it finished" : (status.error ?? "The source did not return"),
        detail: cancelled
          ? "The run was cancelled before this source finished. Evidence returned so far is kept. A cancelled source is a status, not evidence: it does not show that the seed is absent or safe."
          : `${status.error ?? "No error detail was reported."} A failed source is a status, not evidence: it does not show that the seed is absent or safe, and results from other sources are kept.`,
        ...(status.policy === undefined ? {} : { policy: status.policy })
      });
    } else {
      const count = counts.get(status.sourceId) ?? status.observationCount;
      rows.push({
        sourceId: status.sourceId,
        label: status.label,
        state: "returned",
        stateLabel: status.warning ? "Partial" : "Returned",
        count,
        summary: status.warning ?? (count === 0 ? "No matching records" : `${count} observation${count === 1 ? "" : "s"}`),
        detail:
          status.warning
            ? `${status.warning} This is an incomplete source result, not a complete lookup.`
            : count === 0
            ? "The source answered with no records for this seed. That is a result for this source only, not proof that nothing exists."
            : `The source answered with ${count} observation${count === 1 ? "" : "s"}.`,
        ...(status.warning === undefined ? {} : { warning: status.warning }),
        ...(status.policy === undefined ? {} : { policy: status.policy })
      });
    }
  }
  // A source can stream observations before (or without) a status row; show it as observed, never as failed or absent.
  for (const [sourceId, count] of counts) {
    if (!seen.has(sourceId)) {
      rows.push({
        sourceId,
        label: sourceId,
        state: "observed",
        stateLabel: "Reporting",
        count,
        summary: `${count} observation${count === 1 ? "" : "s"} so far`,
        detail: "Observations arrived from this source before its final status was reported."
      });
    }
  }
  return rows;
}

export function computeTotals(observations: readonly Observation[], facts: readonly EvidenceFact[], rows: readonly SourceRow[]): ResultTotals {
  return {
    observations: observations.length,
    sourcesWithEvidence: new Set(observations.map((observation) => observation.source)).size,
    uniqueFacts: facts.length,
    corroboratedFacts: facts.filter((fact) => fact.corroborated).length,
    failedSources: rows.filter((row) => row.state === "failed" && row.cancelled !== true).length,
    skippedSources: rows.filter((row) => row.state === "skipped").length,
    cancelledSources: rows.filter((row) => row.cancelled === true).length,
    returnedSources: rows.filter((row) => row.state === "returned").length,
    partialSources: rows.filter((row) => row.warning !== undefined).length,
    totalSources: rows.length
  };
}

export function filterFacts(facts: readonly EvidenceFact[], query: EvidenceQuery, labels: ReadonlyMap<string, string>): EvidenceFact[] {
  const needle = query.text.trim().toLowerCase();
  return facts.filter((fact) => {
    if (query.filter === "corroborated" && !fact.corroborated) {
      return false;
    }
    if (query.filter === "single" && fact.corroborated) {
      return false;
    }
    if (query.sourceId !== null && !fact.sourceIds.includes(query.sourceId)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = [fact.entity, fact.type, fact.value, ...fact.sourceIds, ...fact.sourceIds.map((id) => labels.get(id) ?? "")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function runDurationLabel(startedTs: string | null, completedTs: string | null): string | null {
  if (!startedTs || !completedTs) {
    return null;
  }
  const started = Date.parse(startedTs);
  const completed = Date.parse(completedTs);
  if (Number.isNaN(started) || Number.isNaN(completed) || completed < started) {
    return null;
  }
  const seconds = Math.round((completed - started) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function shorten(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}…` : text;
}
