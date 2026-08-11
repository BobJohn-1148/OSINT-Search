/**
 * Tool types are separate from search sources because WSL tools have launch,
 * authorization, and captured-output concerns. If they reused connector types,
 * an active scan could slip through the passive search path without a target
 * authorization.
 */
export const toolTierValues = ["passive", "active"] as const;
export const toolCategoryValues = ["recon", "username", "email", "phone", "crawler", "network", "packet", "framework"] as const;
export const toolRunStatusValues = ["queued", "running", "succeeded", "failed", "blocked"] as const;

export type ToolTier = (typeof toolTierValues)[number];
export type ToolCategory = (typeof toolCategoryValues)[number];
export type ToolRunStatus = (typeof toolRunStatusValues)[number];
