/**
 * Provider identifiers are shared because agents store model selections while
 * provider adapters execute connection checks. If UI and main process used
 * separate ids, an agent could point at a provider adapter that does not exist.
 */
export const providerValues = ["openai", "xai", "anthropic", "ollama", "lm-studio"] as const;

export const approvalModeValues = ["manual", "auto"] as const;

/**
 * Reasoning effort is one canonical ladder shared across providers, and each
 * provider declares which rungs it supports (see provider-adapters). Modeling it
 * as a shared enum rather than per-provider strings means an agent's stored
 * effort stays valid when it switches to another provider that supports the same
 * rung, and the UI can render one control against a capability list.
 */
export const reasoningEffortValues = ["minimal", "low", "medium", "high"] as const;

export type ProviderId = (typeof providerValues)[number];
export type ApprovalMode = (typeof approvalModeValues)[number];
export type ReasoningEffort = (typeof reasoningEffortValues)[number];
