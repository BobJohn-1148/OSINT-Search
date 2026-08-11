/**
 * Provider adapter tests bind agent rows to adapter validation because Phase 1
 * promises per-agent model selection before agents can run. If adapters ignored
 * the stored model, Phase 5 would execute a different model than Settings chose.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { getProviderAdapter } from "../../src/main/providers/provider-adapters";

it("selects model per agent so each prompt can switch providers independently", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const agentsRepository = new AgentsRepository(db);

  const agent = agentsRepository.setModel("osint-agent", "anthropic", "claude-sonnet-4.5");

  expect(agent).toMatchObject({
    id: "osint-agent",
    provider: "anthropic",
    model: "claude-sonnet-4.5",
    promptPath: "planning/agent-prompts/osint-agent.md"
  });
  expect(agentsRepository.get("architect-agent")).toMatchObject({
    provider: "openai",
    model: "codex"
  });
});

it("provider adapter honours the per-agent model selection before a connection is reported", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  const agentsRepository = new AgentsRepository(db);
  const agent = agentsRepository.setModel("architect-agent", "openai", "gpt-5.1-mini");
  const adapter = getProviderAdapter(agent.provider);

  expect(adapter.testConnection({ secret: "sk-phase-one-secret", model: agent.model })).toEqual({
    ok: true,
    message: "OpenAI is configured for gpt-5.1-mini"
  });
  expect(adapter.testConnection({ secret: "sk-phase-one-secret", model: "not-a-model" })).toMatchObject({
    ok: false
  });
});
