/**
 * Insight numbers are claims about the run record, so they are pinned here. If
 * these drifted, the Agents surface would quietly report a success rate that
 * does not match the history sitting next to it.
 */
import { computeAgentInsights, formatDuration, formatShare } from "../../src/renderer/agents/agent-insights";
import type { AgentRecord } from "../../src/shared/schemas/agents";
import type { AgentMemoryRecord, AgentPlaybook, AgentRunRecord } from "../../src/shared/schemas/agents-runtime";

const agents: AgentRecord[] = [
  { id: "osint-agent", name: "OSINT agent", provider: "openai", model: "gpt-5.1", promptPath: "p.md", approvalMode: "manual", reasoningEffort: null },
  { id: "architect-agent", name: "Architect agent", provider: "openai", model: "gpt-5.1", promptPath: "a.md", approvalMode: "manual", reasoningEffort: null }
];

function run(overrides: Partial<AgentRunRecord>): AgentRunRecord {
  return {
    id: "run",
    agentId: "osint-agent",
    caseId: null,
    provider: "openai",
    model: "gpt-5.1",
    seed: { type: "domain", value: "example.com" },
    status: "succeeded",
    startedTs: "2026-08-15T10:00:00.000Z",
    completedTs: "2026-08-15T10:00:04.000Z",
    error: null,
    ...overrides
  };
}

it("success rate counts only settled runs so queued work does not drag the number down", () => {
  const insights = computeAgentInsights({
    agents,
    runs: [
      run({ id: "one", status: "succeeded" }),
      run({ id: "two", status: "succeeded" }),
      run({ id: "three", status: "failed", completedTs: null, error: "provider refused" }),
      run({ id: "four", status: "running", completedTs: null })
    ],
    memory: [],
    playbooks: []
  });

  expect(insights.totalRuns).toBe(4);
  expect(insights.succeeded).toBe(2);
  expect(insights.failed).toBe(1);
  expect(insights.inFlight).toBe(1);
  expect(insights.successRate).toBeCloseTo(2 / 3);
});

it("median run duration ignores unfinished runs so an in-flight job cannot skew timing", () => {
  const insights = computeAgentInsights({
    agents,
    runs: [
      run({ id: "one", startedTs: "2026-08-15T10:00:00.000Z", completedTs: "2026-08-15T10:00:02.000Z" }),
      run({ id: "two", startedTs: "2026-08-15T10:00:00.000Z", completedTs: "2026-08-15T10:00:06.000Z" }),
      run({ id: "three", status: "running", completedTs: null })
    ],
    memory: [],
    playbooks: []
  });

  expect(insights.medianDurationMs).toBe(4000);
  expect(formatDuration(insights.medianDurationMs)).toBe("4.0s");
});

it("busiest agent resolves to a display name so the panel never shows a raw id", () => {
  const insights = computeAgentInsights({
    agents,
    runs: [run({ id: "one" }), run({ id: "two" }), run({ id: "three", agentId: "architect-agent" })],
    memory: [],
    playbooks: []
  });

  expect(insights.busiestAgent).toBe("OSINT agent");
});

it("seed mix reports shares that add up so the distribution bars are honest", () => {
  const insights = computeAgentInsights({
    agents,
    runs: [
      run({ id: "one", seed: { type: "domain", value: "a.com" } }),
      run({ id: "two", seed: { type: "domain", value: "b.com" } }),
      run({ id: "three", seed: { type: "email", value: "x@y.com" } })
    ],
    memory: [],
    playbooks: []
  });

  expect(insights.seedMix[0]).toEqual({ label: "domain", count: 2, share: 2 / 3 });
  expect(insights.seedMix.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1);
});

it("empty history reports null rather than zero so the UI can say 'no data' instead of '0%'", () => {
  const insights = computeAgentInsights({ agents, runs: [], memory: [], playbooks: [] });

  expect(insights.successRate).toBeNull();
  expect(insights.medianDurationMs).toBeNull();
  expect(insights.busiestAgent).toBeNull();
  expect(insights.lastRunTs).toBeNull();
  expect(formatShare(insights.successRate)).toBe("—");
  expect(formatDuration(insights.medianDurationMs)).toBe("—");
});

it("memory and playbook counts summarize shared state so the den reflects standing work", () => {
  const memory: AgentMemoryRecord[] = [
    { id: "m1", scope: "default", key: "k", value: "v", sourceAgent: "osint-agent", citedRun: "one", confidence: 3, ts: "2026-08-15T10:00:00.000Z" },
    { id: "m2", scope: "default", key: "k2", value: "v2", sourceAgent: "osint-agent", citedRun: "one", confidence: 1, ts: "2026-08-15T10:00:00.000Z" }
  ];
  const playbooks: AgentPlaybook[] = [
    { id: "p1", title: "Nightly digest", agentId: "osint-agent", cadence: "nightly", active: true, nextRunTs: "2026-08-16T02:00:00.000Z" },
    { id: "p2", title: "Weekly", agentId: "osint-agent", cadence: "weekly", active: false, nextRunTs: "2026-08-22T02:00:00.000Z" }
  ];

  const insights = computeAgentInsights({ agents, runs: [], memory, playbooks });

  expect(insights.memoryEntries).toBe(2);
  expect(insights.averageMemoryConfidence).toBe(2);
  expect(insights.activePlaybooks).toBe(1);
});
