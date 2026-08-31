/**
 * The HQ scene is a react-three-fiber canvas that will not mount in jsdom, so
 * its camera-navigation contract is pinned here instead. camera-controls.ts is
 * the declarative half of that contract: agents-hq-scene.tsx wires OrbitControls
 * rotate/dolly, the space-gated pan, and a per-character onDoubleClick that
 * calls focusAgentCamera -- and the status bar prints hqCameraControlHints. If
 * the hint list and the wiring drift apart, the bar starts over-promising.
 */
import { focusAgentCamera, hqCameraControlHints } from "../../src/renderer/agents/camera-controls";
import { mapAgentsToPresentation } from "../../src/renderer/agents/agent-status";
import type { AgentRecord } from "../../src/shared/schemas/agents";

const lines = { idle: [{ text: "idling", nsfw: false }], offline: ["powered down"], error: ["stack trace"] };

function agentRecord(id: string): AgentRecord {
  return {
    id,
    name: id,
    provider: "openai",
    model: "gpt-5.1",
    promptPath: `planning/agent-prompts/${id}.md`,
    approvalMode: "manual",
    reasoningEffort: null
  };
}

const presentations = mapAgentsToPresentation({
  agents: [agentRecord("scout-agent"), agentRecord("ripper-agent"), agentRecord("architect-agent"), agentRecord("byte-agent")],
  states: [],
  lines,
  cleanIdleStatuses: true,
  idleTick: 0
});

it("keeps the status bar in step with every camera control the scene wires", () => {
  // Exactly the four the scene implements: OrbitControls rotate (drag) and
  // dolly (scroll), the space-gated pan (space-drag), and the character
  // onDoubleClick -> focusAgentCamera (double-click). A hint with no wiring, or
  // a control with no hint, is the regression this guards.
  const ids = hqCameraControlHints.map((hint) => hint.id).sort();
  expect(ids).toEqual(["double-click", "drag", "scroll", "space-drag"]);
  for (const hint of hqCameraControlHints) {
    expect(hint.label).toContain("=");
  }
});

it("double-click focus frames the clicked character instead of returning one fixed camera pose", () => {
  const first = focusAgentCamera(presentations[0], 0);
  const fourth = focusAgentCamera(presentations[3], 3);

  expect(first.agentId).toBe("scout-agent");
  expect(fourth.agentId).toBe("byte-agent");

  // focusAgentCamera lays the target on that character's own desk (index maps
  // to a 3-wide grid, matching AgentCharacter's position in agents-hq-scene),
  // so two different desks cannot resolve to the same framing.
  expect(fourth.target[0]).toBeCloseTo(-2.1);
  expect(fourth.target[1]).toBeCloseTo(0.7);
  expect(fourth.target[2]).toBeCloseTo(1.3);
  expect(first.target).not.toEqual(fourth.target);
  expect(first.position).not.toEqual(fourth.position);

  // The camera sits back and above the desk it is looking at, never level with
  // or below it, or the character would be off-screen.
  expect(first.position[1]).toBeGreaterThan(first.target[1]);
});
