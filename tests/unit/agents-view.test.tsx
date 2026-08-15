/**
 * Agents view tests pin the interactive HQ contract without letting WebGL or
 * IPC become hidden dependencies. If these checks only used screenshots, status
 * filtering and failure fallback could regress while the route still rendered.
 */
import { render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { mapAgentsToPresentation } from "../../src/renderer/agents/agent-status";
import { focusAgentCamera, hqCameraControlHints } from "../../src/renderer/agents/camera-controls";
import { AgentsView } from "../../src/renderer/components/agents-view";
import type { AgentRecord } from "../../src/shared/schemas/agents";
import type { AgentLiveState } from "../../src/shared/schemas/agents-runtime";
import type { Result } from "../../src/shared/result";

type RendererInvokeMock = (channel: string, request?: unknown) => Promise<Result<unknown>>;

const testAgents: AgentRecord[] = [
  {
    id: "osint-agent",
    name: "OSINT agent",
    provider: "openai",
    model: "gpt-5.1",
    promptPath: "planning/agent-prompts/osint-agent.md",
    approvalMode: "manual"
  }
];

function installBridge(invoke: RendererInvokeMock = defaultInvoke): void {
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: {
      channels: [],
      invoke,
      onSearchEvent: vi.fn().mockReturnValue(() => {}),
      onAgentEvent: vi.fn().mockReturnValue(() => {})
    }
  });
}

function defaultInvoke(channel: string): Promise<Result<unknown>> {
  if (channel === "agents:list") {
    return Promise.resolve({ ok: true as const, value: { agents: testAgents } });
  }
  if (channel === "agent:states") {
    return Promise.resolve({ ok: true as const, value: { states: [] } });
  }
  if (channel === "agent:runs") {
    return Promise.resolve({ ok: true as const, value: { runs: [] } });
  }
  if (channel === "agent:memory:list") {
    return Promise.resolve({ ok: true as const, value: { memory: [] } });
  }
  if (channel === "agent:playbooks") {
    return Promise.resolve({ ok: true as const, value: { playbooks: [] } });
  }
  if (channel === "cases:list") {
    return Promise.resolve({ ok: true as const, value: { cases: [] } });
  }
  if (channel === "settings:get") {
    return Promise.resolve({ ok: true as const, value: { key: "agents.cleanIdleStatuses", value: "false" } });
  }
  return Promise.resolve({ ok: true as const, value: {} });
}

it("status maps from agent state so labels show live work", () => {
  const states: AgentLiveState[] = [
    {
      agentId: "osint-agent",
      status: "working",
      task: "running Sherlock on jdoe",
      lastRunId: "run-one",
      updatedTs: "2026-08-11T12:00:00.000Z"
    }
  ];

  const [presentation] = mapAgentsToPresentation({
    agents: testAgents,
    states,
    lines: { idle: [{ text: "idle", nsfw: false }], offline: ["powered down"], error: ["error"] },
    cleanIdleStatuses: false,
    idleTick: 0
  });

  expect(presentation.statusText).toBe("running Sherlock on jdoe");
  expect(presentation.working).toBe(true);
});

it("idle filter respects the clean toggle so unsafe idle lines stay hidden", () => {
  const [presentation] = mapAgentsToPresentation({
    agents: testAgents,
    states: [],
    lines: {
      idle: [
        { text: "safe line", nsfw: false },
        { text: "unsafe line", nsfw: true }
      ],
      offline: ["powered down"],
      error: ["error"]
    },
    cleanIdleStatuses: true,
    idleTick: 1
  });

  expect(presentation.statusText).toBe("safe line");
});

it("camera controls are wired so HQ navigation matches the status bar", () => {
  const sceneSource = fs.readFileSync(path.join(process.cwd(), "src", "renderer", "components", "agents-hq-scene.tsx"), "utf8");

  expect(hqCameraControlHints.map((hint) => hint.label)).toEqual([
    "drag = orbit",
    "scroll = zoom",
    "space+drag = pan",
    "double-click a character = focus"
  ]);
  expect(sceneSource).toContain("spacePan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE");
  expect(sceneSource).toContain("enablePan={props.spacePan}");
  expect(sceneSource).toContain("onDoubleClick");
});

it("double-click focuses a character so users can inspect one agent", () => {
  const [presentation] = mapAgentsToPresentation({
    agents: testAgents,
    states: [],
    lines: { idle: [{ text: "idle", nsfw: false }], offline: ["powered down"], error: ["error"] },
    cleanIdleStatuses: false,
    idleTick: 0
  });

  expect(focusAgentCamera(presentation, 0)).toEqual({
    agentId: "osint-agent",
    position: [0.5, 3.1, 2.5999999999999996],
    target: [-2.1, 0.7, -0.8]
  });
});

it("list-view fallback renders when WebGL is unavailable", async () => {
  installBridge();

  render(<AgentsView webGlReadyOverride={false} />);

  expect(await screen.findByLabelText("Agents list fallback")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /OSINT agent/i })).toBeInTheDocument();
});

it("scene-init failure does not crash the agents feature", async () => {
  installBridge();
  const BrokenScene = () => {
    throw new Error("scene failed");
  };

  render(<AgentsView webGlReadyOverride SceneComponent={BrokenScene} />);

  await waitFor(() => {
    expect(screen.getByLabelText("Agents list fallback")).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: "Open chat" })).toBeInTheDocument();
});
