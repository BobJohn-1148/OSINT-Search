/**
 * Tool types are separate from search sources because WSL tools have launch,
 * authorization, and captured-output concerns. If they reused connector types,
 * an active scan could slip through the passive search path without a target
 * authorization.
 */
/**
 * The distro setting key and its default are shared because main resolves them
 * when launching a tool while the settings view writes them. A private copy on
 * either side would silently launch against a different distro than the one the
 * UI shows.
 */
export const WSL_DISTRO_SETTING_KEY = "tools.wslDistro";
export const DEFAULT_WSL_DISTRO = "Ubuntu";

export const toolTierValues = ["passive", "active"] as const;
export const toolCategoryValues = [
  "recon",
  "username",
  "email",
  "phone",
  "crawler",
  "network",
  "packet",
  "framework",
  "web",
  "exploitation",
  "cracking",
  "forensics",
  "reverse-engineering",
  "privilege",
  "cloud",
  "wireless",
  "lab",
  "mobile",
  "social"
] as const;
export const toolRunStatusValues = ["queued", "running", "succeeded", "failed", "blocked"] as const;

export type ToolTier = (typeof toolTierValues)[number];
export type ToolCategory = (typeof toolCategoryValues)[number];
export type ToolRunStatus = (typeof toolRunStatusValues)[number];
