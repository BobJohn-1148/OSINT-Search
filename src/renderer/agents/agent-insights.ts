/**
 * Insights are derived in one pure module rather than inside the view because
 * "how many runs succeeded" is a claim about the record, and a claim has to be
 * reproducible in a test. Computing it inline would make every number an
 * unverifiable side effect of render order.
 *
 * Everything here is derived from rows the renderer already holds, so insights
 * add no IPC round trip and cannot drift from the data the user is looking at.
 */
import type { AgentMemoryRecord, AgentPlaybook, AgentRunRecord } from "../../shared/schemas/agents-runtime";
import type { AgentRecord } from "../../shared/schemas/agents";
import { elapsedMs, median, tally, type DistributionSlice } from "../insights/metrics";

export type { DistributionSlice };
export { formatDuration, formatShare } from "../insights/metrics";

export interface AgentInsights {
  readonly totalRuns: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly inFlight: number;
  readonly successRate: number | null;
  readonly medianDurationMs: number | null;
  readonly busiestAgent: string | null;
  readonly seedMix: readonly DistributionSlice[];
  readonly providerMix: readonly DistributionSlice[];
  readonly memoryEntries: number;
  readonly averageMemoryConfidence: number | null;
  readonly activePlaybooks: number;
  readonly lastRunTs: string | null;
}

export function computeAgentInsights(input: {
  readonly agents: readonly AgentRecord[];
  readonly runs: readonly AgentRunRecord[];
  readonly memory: readonly AgentMemoryRecord[];
  readonly playbooks: readonly AgentPlaybook[];
}): AgentInsights {
  const { runs, memory, playbooks } = input;
  const succeeded = runs.filter((run) => run.status === "succeeded").length;
  const failed = runs.filter((run) => run.status === "failed").length;
  const inFlight = runs.filter((run) => run.status === "queued" || run.status === "running").length;
  const settled = succeeded + failed;

  const durations = runs
    .map((run) => elapsedMs(run.startedTs, run.completedTs))
    .filter((duration): duration is number => duration !== null);

  const nameById = new Map(input.agents.map((agent) => [agent.id, agent.name]));
  const runsByAgent = tally(runs.map((run) => nameById.get(run.agentId) ?? run.agentId));

  const confidences = memory.map((entry) => entry.confidence).filter((value) => Number.isFinite(value));

  const startTimes = runs
    .map((run) => Date.parse(run.startedTs))
    .filter((value) => Number.isFinite(value));

  return {
    totalRuns: runs.length,
    succeeded,
    failed,
    inFlight,
    successRate: settled === 0 ? null : succeeded / settled,
    medianDurationMs: median(durations),
    busiestAgent: runsByAgent.length === 0 ? null : runsByAgent[0].label,
    seedMix: tally(runs.map((run) => run.seed.type)),
    providerMix: tally(runs.map((run) => `${run.provider}/${run.model}`)),
    memoryEntries: memory.length,
    averageMemoryConfidence:
      confidences.length === 0 ? null : confidences.reduce((sum, value) => sum + value, 0) / confidences.length,
    activePlaybooks: playbooks.filter((playbook) => playbook.active).length,
    lastRunTs: startTimes.length === 0 ? null : new Date(Math.max(...startTimes)).toISOString()
  };
}

