/**
 * Runtime agent types are separate from provider selection because the 3D HQ
 * reads live work state while Settings edits durable model choices. If those
 * concerns shared one type, a renderer label update could look like a model edit.
 */
import type { SeedType } from "./search.js";

export const agentRunStatusValues = ["queued", "running", "succeeded", "failed"] as const;
export const agentLiveStatusValues = ["idle", "working", "offline", "error"] as const;
export const agentEventTypeValues = ["agent:state", "agent:step", "agent:finding"] as const;
export const agentPlaybookCadenceValues = ["hourly", "daily", "nightly", "weekly", "continuous"] as const;

export type AgentRunStatus = (typeof agentRunStatusValues)[number];
export type AgentLiveStatus = (typeof agentLiveStatusValues)[number];
export type AgentEventType = (typeof agentEventTypeValues)[number];
export type AgentPlaybookCadence = (typeof agentPlaybookCadenceValues)[number];

export interface AgentSeed {
  readonly type: SeedType;
  readonly value: string;
}
