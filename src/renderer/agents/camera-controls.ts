/**
 * Camera controls are declarative so the status bar, scene wiring, and tests
 * describe the same Claw3D navigation contract. If hints were plain copy, a
 * future scene edit could silently break double-click focus or panning.
 */
import type { AgentPresentation } from "./agent-status";

export const hqCameraControlHints = [
  { id: "drag", label: "drag = orbit" },
  { id: "scroll", label: "scroll = zoom" },
  { id: "space-drag", label: "space+drag = pan" },
  { id: "double-click", label: "double-click a character = focus" }
] as const;

export interface CameraFocusTarget {
  readonly agentId: string;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export function focusAgentCamera(agent: AgentPresentation, index: number): CameraFocusTarget {
  const x = (index % 3) * 2.1 - 2.1;
  const z = Math.floor(index / 3) * 2.1 - 0.8;
  return {
    agentId: agent.agent.id,
    position: [x + 2.6, 3.1, z + 3.4],
    target: [x, 0.7, z]
  };
}
