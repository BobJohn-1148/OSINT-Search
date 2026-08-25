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
    provider: "ollama",
    model: "llama3.1:8b"
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

it("exposes expanded current model choices for Settings dropdowns", () => {
  const openai = getProviderAdapter("openai");
  const anthropic = getProviderAdapter("anthropic");

  expect(openai.defaultModel).toBe("gpt-5.6-terra");
  expect(openai.availableModels).toEqual(
    expect.arrayContaining(["codex", "gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.1", "gpt-5.1-mini"])
  );
  expect(anthropic.defaultModel).toBe("claude-sonnet-5");
  expect(anthropic.availableModels).toEqual(
    expect.arrayContaining([
      "claude-fable-5",
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-haiku-4-5-20251001",
      "claude-haiku-4-5",
      "claude-opus-4-8",
      "claude-sonnet-4-6"
    ])
  );
  // Anthropic model ids are hyphenated on the wire. The dotted forms were
  // unreachable strings that only became dangerous once chat-providers.ts
  // started making real calls, where selecting one guarantees a 404.
  expect(anthropic.availableModels).not.toContain("claude-sonnet-4.5");
  expect(anthropic.availableModels).not.toContain("claude-haiku-4.5");
});

it("defaults Ollama to a model that fits in consumer memory, with the 70B one still selectable", () => {
  const ollama = getProviderAdapter("ollama");

  // llama3.3 is a 70B model needing roughly 43GB; defaulting to it meant every
  // agent pointed at something that could not load on a 32GB machine.
  expect(ollama.defaultModel).toBe("llama3.1:8b");
  expect(ollama.availableModels).toEqual(expect.arrayContaining(["llama3.1:8b", "qwen2.5:14b", "llama3.3"]));
  // Local runtimes expose no effort control, so the agents view hides the picker.
  expect(ollama.supportedEfforts).toEqual([]);
});

it("declares each provider's reasoning-effort ladder so the UI only offers rungs the provider actually has", () => {
  // Full ladder for OpenAI reasoning models, a two-rung control for Grok, three
  // tiers for Anthropic thinking, and nothing for local runtimes.
  expect(getProviderAdapter("openai").supportedEfforts).toEqual(["minimal", "low", "medium", "high"]);
  expect(getProviderAdapter("xai").supportedEfforts).toEqual(["low", "high"]);
  expect(getProviderAdapter("anthropic").supportedEfforts).toEqual(["low", "medium", "high"]);
  expect(getProviderAdapter("ollama").supportedEfforts).toEqual([]);
  expect(getProviderAdapter("lm-studio").supportedEfforts).toEqual([]);
});
