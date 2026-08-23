/**
 * Agent status mapping is pure so the 3D labels, list fallback, and tests all
 * agree on the same text. If each surface chose idle and error lines alone,
 * Settings could filter one view while the canvas leaked a different pool.
 */
import type { AgentRecord } from "../../shared/schemas/agents";
import type { AgentLiveState } from "../../shared/schemas/agents-runtime";
import { resolveAgentPersona, type AgentPersona } from "./agent-personas";

export interface AgentStatusLine {
  readonly text: string;
  readonly nsfw: boolean;
}

export interface AgentStatusLinePool {
  readonly idle: readonly AgentStatusLine[];
  readonly offline: readonly string[];
  readonly error: readonly string[];
}

export interface AgentPresentation {
  readonly agent: AgentRecord;
  readonly state: AgentLiveState;
  readonly persona: AgentPersona;
  readonly label: string;
  readonly statusText: string;
  readonly working: boolean;
}

export function cleanIdleLines(lines: readonly AgentStatusLine[], clean: boolean): AgentStatusLine[] {
  return lines.filter((line) => !clean || !line.nsfw);
}

export function mapAgentsToPresentation(input: {
  readonly agents: readonly AgentRecord[];
  readonly states: readonly AgentLiveState[];
  readonly lines: AgentStatusLinePool;
  readonly cleanIdleStatuses: boolean;
  readonly idleTick: number;
}): AgentPresentation[] {
  const stateByAgent = new Map(input.states.map((state) => [state.agentId, state]));
  const sharedIdleLines = cleanIdleLines(input.lines.idle, input.cleanIdleStatuses);
  return input.agents.map((agent, index) => {
    const state = stateByAgent.get(agent.id) ?? {
      agentId: agent.id,
      status: "idle" as const,
      task: null,
      lastRunId: null,
      updatedTs: new Date(0).toISOString()
    };
    const persona = resolveAgentPersona(agent.id);
    // Persona quirks lead so an idle agent sounds like itself first and only
    // falls through to the shared joke pool once its own lines are exhausted.
    const idleLines = [...cleanIdleLines(persona.quirks, input.cleanIdleStatuses), ...sharedIdleLines];
    return {
      agent,
      state,
      persona,
      label: agent.name,
      statusText: resolveStatusText(state, input.lines, idleLines, input.idleTick + index),
      working: state.status === "working"
    };
  });
}

export function resolveStatusText(
  state: AgentLiveState,
  lines: AgentStatusLinePool,
  idleLines: readonly AgentStatusLine[],
  index: number
): string {
  if (state.status === "working") {
    return state.task ?? "working";
  }
  if (state.status === "offline") {
    return choose(lines.offline, index) ?? "powered down";
  }
  if (state.status === "error") {
    return state.task ?? choose(lines.error, index) ?? "spat out a stack trace";
  }
  return choose(idleLines.map((line) => line.text), index) ?? "idle";
}

function choose(lines: readonly string[], index: number): string | null {
  if (lines.length === 0) {
    return null;
  }
  return lines[Math.abs(index) % lines.length] ?? null;
}
