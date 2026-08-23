/**
 * Provider adapters share one lightweight chat-facing contract before agents are
 * executable. If each provider test used its own shape, per-agent model
 * switching would need rewriting when the Phase 5 agent hub starts calling them.
 */
import type { KeySource } from "../../shared/types/sources.js";
import type { ProviderId, ReasoningEffort } from "../../shared/types/providers.js";

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly label: string;
  readonly keySource: KeySource | null;
  readonly requiresKey: boolean;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];
  // Which reasoning-effort rungs this provider exposes. Empty means the provider
  // has no effort knob (local runtimes), and the UI hides the control entirely.
  readonly supportedEfforts: readonly ReasoningEffort[];
  testConnection(input: { readonly secret: string | null; readonly model: string }): ProviderTestResult;
}

export interface ProviderTestResult {
  readonly ok: boolean;
  readonly message: string;
}

function externalProvider(
  id: ProviderId,
  label: string,
  keySource: KeySource,
  defaultModel: string,
  availableModels: readonly string[],
  expectedPrefix: string | null,
  supportedEfforts: readonly ReasoningEffort[]
): ProviderAdapter {
  return {
    id,
    label,
    keySource,
    requiresKey: true,
    defaultModel,
    availableModels,
    supportedEfforts,
    testConnection: ({ secret, model }) => {
      if (!secret) {
        return { ok: false, message: `${label} key is not stored` };
      }
      if (expectedPrefix && !secret.startsWith(expectedPrefix)) {
        return { ok: false, message: `${label} key format is not recognized` };
      }
      if (!availableModels.includes(model)) {
        return { ok: false, message: `${model} is not available for ${label}` };
      }
      return { ok: true, message: `${label} is configured for ${model}` };
    }
  };
}

function localProvider(id: ProviderId, label: string, defaultModel: string, availableModels: readonly string[]): ProviderAdapter {
  return {
    id,
    label,
    keySource: null,
    requiresKey: false,
    defaultModel,
    availableModels,
    // Local runtimes (Ollama, LM Studio) expose no server-side reasoning-effort
    // control, so the ladder is empty and the UI omits the selector for them.
    supportedEfforts: [],
    testConnection: ({ model }) => {
      if (!availableModels.includes(model)) {
        return { ok: false, message: `${model} is not available for ${label}` };
      }
      return { ok: true, message: `${label} is selected for ${model}` };
    }
  };
}

const openAiModels = [
  "codex",
  "gpt-5.6",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.1",
  "gpt-5.1-mini"
] as const;

const anthropicModels = [
  "claude-fable-5",
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-sonnet-4.5",
  "claude-haiku-4.5"
] as const;

export const providerAdapters: readonly ProviderAdapter[] = [
  // OpenAI reasoning models expose the full minimal|low|medium|high effort ladder.
  externalProvider("openai", "OpenAI", "openai", "gpt-5.6-terra", openAiModels, "sk-", ["minimal", "low", "medium", "high"]),
  // xAI Grok's reasoning effort is a two-rung low|high control.
  externalProvider("xai", "xAI Grok", "xai", "grok-4.1", ["grok-4.1", "grok-4.1-fast"], "xai-", ["low", "high"]),
  // Anthropic extended thinking is expressed here as low|medium|high thinking budget.
  externalProvider("anthropic", "Anthropic", "anthropic", "claude-sonnet-5", anthropicModels, "sk-ant-", ["low", "medium", "high"]),
  localProvider("ollama", "Ollama", "llama3.3", ["llama3.3", "qwen2.5-coder", "mistral-small"]),
  localProvider("lm-studio", "LM Studio", "local-model", ["local-model", "openai-compatible"])
] as const;

export function getProviderAdapter(provider: ProviderId): ProviderAdapter {
  const adapter = providerAdapters.find((candidate) => candidate.id === provider);
  if (!adapter) {
    throw new Error(`Provider ${provider} is not supported`);
  }

  return adapter;
}
