/**
 * Provider identifiers are shared because agents store model selections while
 * provider adapters execute connection checks. If UI and main process used
 * separate ids, an agent could point at a provider adapter that does not exist.
 */
export const providerValues = ["openai", "xai", "anthropic", "ollama", "lm-studio"] as const;

export const approvalModeValues = ["manual", "auto"] as const;

export type ProviderId = (typeof providerValues)[number];
export type ApprovalMode = (typeof approvalModeValues)[number];
