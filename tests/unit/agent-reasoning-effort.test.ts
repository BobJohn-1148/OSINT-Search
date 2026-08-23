/**
 * Reasoning effort is a per-agent selection that must survive validation and
 * persistence, so it is pinned end to end: the repository stores and clears it,
 * and the handler refuses a rung the agent's current provider does not expose.
 * Storing an unsupported effort would let the future inference loop send a value
 * the provider rejects at call time, far from where the mistake was made.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { createAgentsHandlers } from "../../src/main/ipc/handlers/agents-handlers";

function harness() {
  const db = new Database(":memory:");
  runMigrations(db);
  const agentsRepository = new AgentsRepository(db);
  const handlers = createAgentsHandlers(agentsRepository);
  return { agentsRepository, handlers };
}

it("defaults to no effort override so agents start on the provider default", () => {
  const { agentsRepository } = harness();
  expect(agentsRepository.get("osint-agent").reasoningEffort).toBeNull();
});

it("stores and clears a reasoning-effort rung so the choice is durable", () => {
  const { agentsRepository } = harness();

  const raised = agentsRepository.setReasoningEffort("osint-agent", "high");
  expect(raised.reasoningEffort).toBe("high");
  expect(agentsRepository.get("osint-agent").reasoningEffort).toBe("high");

  const cleared = agentsRepository.setReasoningEffort("osint-agent", null);
  expect(cleared.reasoningEffort).toBeNull();
});

it("accepts an effort the current provider supports through the handler", () => {
  const { agentsRepository, handlers } = harness();
  // The OSINT agent now defaults to the free local runtime, so opt it onto an
  // effort-capable provider first — that is the real path to using effort.
  agentsRepository.setModel("osint-agent", "openai", "gpt-5.1");
  const result = handlers["agents:setEffort"]({ agentId: "osint-agent", reasoningEffort: "minimal" });
  expect(result.agent.reasoningEffort).toBe("minimal");
  expect(agentsRepository.get("osint-agent").reasoningEffort).toBe("minimal");
});

it("rejects an effort the current provider does not expose so an invalid rung is never stored", () => {
  const { agentsRepository, handlers } = harness();
  // osint-agent defaults to the local Ollama provider, which has no effort control.
  expect(agentsRepository.get("osint-agent").provider).toBe("ollama");

  expect(() => handlers["agents:setEffort"]({ agentId: "osint-agent", reasoningEffort: "high" })).toThrow(/does not support/);
  expect(agentsRepository.get("osint-agent").reasoningEffort).toBeNull();
});

it("always allows clearing to the provider default even on a provider with no effort control", () => {
  const { handlers } = harness();
  // osint-agent defaults to Ollama (no effort control), yet clearing to null must
  // still succeed — you can always fall back to the provider default.
  const result = handlers["agents:setEffort"]({ agentId: "osint-agent", reasoningEffort: null });
  expect(result.agent.reasoningEffort).toBeNull();
});
