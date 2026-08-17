/**
 * Correlation computes strength from source overlap because confidence is an
 * evidence property, not a UI label. If connectors could provide their own bands,
 * one noisy source could make a weak claim look confirmed.
 */
import type {
  CorrelatedEntity,
  Observation,
  SearchRunResult,
  SearchSeed,
  SearchTreeNode,
  SourceStatus,
  StrengthBand
} from "../../shared/types/search.js";

export function strengthBand(sourceCount: number): StrengthBand {
  if (sourceCount >= 4) {
    return "confirmed";
  }
  if (sourceCount === 3) {
    return "strong";
  }
  if (sourceCount === 2) {
    return "likely";
  }
  return "single-source";
}

export function correlateObservations(observations: readonly Observation[]): CorrelatedEntity[] {
  const grouped = new Map<string, Observation[]>();
  for (const observation of observations) {
    const key = factKey(observation);
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }

  return [...grouped.values()]
    .map((group) => {
      const sources = [...new Set(group.map((observation) => observation.source))].sort();
      const first = group[0];
      return {
        entity: first.entity,
        type: first.type,
        value: first.value,
        sourceIds: sources,
        strength: sources.length,
        band: strengthBand(sources.length)
      };
    })
    .sort((a, b) => b.strength - a.strength || a.entity.localeCompare(b.entity));
}

export function buildSearchTree(input: {
  readonly runId: string;
  readonly seed: SearchSeed;
  readonly statuses: readonly SourceStatus[];
  readonly observations: readonly Observation[];
  readonly entities: readonly CorrelatedEntity[];
}): SearchTreeNode {
  return {
    id: `run:${input.runId}`,
    label: `${input.seed.type}:${input.seed.value}`,
    kind: "root",
    saveable: true,
    pivotSeed: input.seed,
    children: input.statuses.map((status) => {
      const sourceObservations = input.observations.filter((observation) => observation.source === status.sourceId);
      return {
        id: `source:${input.runId}:${status.sourceId}`,
        label: status.label,
        kind: "source",
        sourceId: status.sourceId,
        saveable: true,
        children: sourceObservations.map((observation) => {
          const entity = input.entities.find((candidate) => factKey(candidate) === factKey(observation));
          return {
            id: `observation:${observation.id}`,
            label: observation.value,
            kind: "observation",
            sourceId: status.sourceId,
            observationId: observation.id,
            entity: observation.entity,
            strength: entity?.strength ?? 1,
            band: entity?.band ?? "single-source",
            saveable: true,
            pivotSeed: inferPivotSeed(observation.value),
            children: []
          };
        })
      };
    })
  };
}

export function buildSearchRunResult(input: Omit<SearchRunResult, "entities" | "tree">): SearchRunResult {
  const entities = correlateObservations(input.observations);
  const observations = input.observations.map((observation) => {
    const entity = entities.find((candidate) => factKey(candidate) === factKey(observation));
    return {
      ...observation,
      confidence: entity?.strength ?? 1
    };
  });
  const tree = buildSearchTree({ ...input, observations, entities });
  return { ...input, observations, entities, tree };
}

function normalizeEntity(entity: string): string {
  return entity.trim().toLowerCase();
}

function normalizeFactValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function factKey(fact: Pick<Observation, "entity" | "type" | "value">): string {
  return `${normalizeEntity(fact.entity)}\u0000${normalizeFactValue(fact.type)}\u0000${normalizeFactValue(fact.value)}`;
}

function inferPivotSeed(value: string): SearchSeed | undefined {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { type: "email", value: trimmed };
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return { type: "ip", value: trimmed };
  }
  if (/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/i.test(trimmed)) {
    return { type: "mac", value: trimmed };
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return { type: "domain", value: trimmed };
  }
  return undefined;
}
