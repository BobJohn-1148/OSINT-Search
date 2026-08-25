/**
 * Agents view tests pin the interactive HQ contract without letting WebGL or
 * IPC become hidden dependencies. If these checks only used screenshots, status
 * filtering and failure fallback could regress while the route still rendered.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mapAgentsToPresentation } from "../../src/renderer/agents/agent-status";
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
    approvalMode: "manual",
    reasoningEffort: null
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
  if (channel === "providers:list") {
    return Promise.resolve({
      ok: true as const,
      value: {
        providers: [
          {
            id: "openai",
            label: "OpenAI",
            keySource: "openai",
            requiresKey: true,
            configured: true,
            defaultModel: "gpt-5.1",
            availableModels: ["gpt-5.1"],
            supportedEfforts: ["minimal", "low", "medium", "high"]
          }
        ]
      }
    });
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
  const lines = {
    idle: [
      { text: "safe line", nsfw: false },
      { text: "unsafe line", nsfw: true }
    ],
    offline: ["powered down"],
    error: ["error"]
  };
  const statusesAcrossRotation = (cleanIdleStatuses: boolean) =>
    Array.from({ length: 40 }, (_unused, idleTick) => {
      const [presentation] = mapAgentsToPresentation({
        agents: testAgents,
        states: [],
        lines,
        cleanIdleStatuses,
        idleTick
      });
      return presentation.statusText;
    });

  // Sweeping the whole rotation rather than one tick: personas prepend their own
  // quirks to the pool, so an exact-index assertion would pass for the wrong
  // reason. The contract that matters is that nsfw text never surfaces.
  expect(statusesAcrossRotation(true)).not.toContain("unsafe line");
  expect(statusesAcrossRotation(true)).toContain("safe line");
  expect(statusesAcrossRotation(false)).toContain("unsafe line");
});

it("each agent speaks in its own persona voice so the roster is not interchangeable", () => {
  const [osint] = mapAgentsToPresentation({
    agents: testAgents,
    states: [],
    lines: { idle: [], offline: ["powered down"], error: ["error"] },
    cleanIdleStatuses: true,
    idleTick: 0
  });
  const [architect] = mapAgentsToPresentation({
    agents: [{ ...testAgents[0], id: "architect-agent", name: "Architect agent" }],
    states: [],
    lines: { idle: [], offline: ["powered down"], error: ["error"] },
    cleanIdleStatuses: true,
    idleTick: 0
  });

  expect(osint.persona.callsign).toBe("The Gentleman");
  expect(architect.persona.callsign).toBe("The Foreman");
  expect(osint.persona.outfit.hatShape).toBe("top-hat");
  expect(architect.persona.outfit.hatShape).toBe("hard-hat");
  expect(osint.statusText).not.toBe(architect.statusText);
});

it("falls back to the operations console when WebGL is unavailable so agent controls survive a GPU failure", async () => {
  installBridge();

  render(<AgentsView />);

  expect(await screen.findByRole("button", { name: /OSINT agent/i })).toBeInTheDocument();
  expect(screen.getByLabelText("Mission brief")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open chat" })).toBeInTheDocument();
});

it("run button sends an inferred seed so users do not manage seed types", async () => {
  const user = userEvent.setup();
  const invoke = vi.fn<RendererInvokeMock>((channel) => {
    if (channel === "agent:run") {
      return Promise.resolve({ ok: true as const, value: { run: { id: "run-one" } } });
    }
    return defaultInvoke(channel);
  });
  installBridge(invoke);

  render(<AgentsView />);

  await user.clear(await screen.findByLabelText("Mission brief"));
  await user.type(screen.getByLabelText("Mission brief"), "Investigate example.com");
  await user.click(screen.getByRole("button", { name: "Run agent" }));

  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith(
      "agent:run",
      expect.objectContaining({
        agentId: "osint-agent",
        seed: { type: "domain", value: "example.com" }
      })
    );
  });
});

it("shows a reasoning-effort selector for effort-capable providers and stores the choice", async () => {
  const user = userEvent.setup();
  const invoke = vi.fn<RendererInvokeMock>((channel, request) => {
    if (channel === "agents:setEffort") {
      const effort = (request as { reasoningEffort: string | null }).reasoningEffort;
      return Promise.resolve({ ok: true as const, value: { agent: { ...testAgents[0], reasoningEffort: effort } } });
    }
    return defaultInvoke(channel);
  });
  installBridge(invoke);

  render(<AgentsView />);

  const effort = await screen.findByLabelText("Reasoning effort");
  // OpenAI exposes the full ladder, so every rung is offered plus the default.
  expect(effort).toBeInTheDocument();
  await user.selectOptions(effort, "high");

  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith("agents:setEffort", { agentId: "osint-agent", reasoningEffort: "high" });
  });
});

it("hides the effort selector for a provider that has no effort control", async () => {
  const localAgent = { ...testAgents[0], provider: "ollama" as const, model: "llama3.3", reasoningEffort: null };
  const invoke = vi.fn<RendererInvokeMock>((channel) => {
    if (channel === "agents:list") {
      return Promise.resolve({ ok: true as const, value: { agents: [localAgent] } });
    }
    if (channel === "providers:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          providers: [
            {
              id: "ollama",
              label: "Ollama",
              keySource: null,
              requiresKey: false,
              configured: true,
              defaultModel: "llama3.3",
              availableModels: ["llama3.3"],
              supportedEfforts: []
            }
          ]
        }
      });
    }
    return defaultInvoke(channel);
  });
  installBridge(invoke);

  render(<AgentsView />);

  expect(await screen.findByText(/no reasoning-effort control/i)).toBeInTheDocument();
  expect(screen.queryByLabelText("Reasoning effort")).not.toBeInTheDocument();
});

it("opens a per-agent panel from the card deck with chat and a chain of thought", async () => {
  const user = userEvent.setup();
  installBridge();

  render(<AgentsView />);

  // Each agent card exposes a Chat action that opens its focused panel.
  await user.click(await screen.findByRole("button", { name: "Chat" }));

  expect(await screen.findByLabelText(/Ask OSINT agent/i)).toBeInTheDocument();
  expect(screen.getByText("Chain of thought")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
});

it("tests an agent's provider from its card so a key can be verified in place", async () => {
  const user = userEvent.setup();
  const invoke = vi.fn<RendererInvokeMock>((channel) => {
    if (channel === "providers:test") {
      return Promise.resolve({ ok: true as const, value: { provider: "openai", ok: true, message: "reachable", model: "gpt-5.1" } });
    }
    return defaultInvoke(channel);
  });
  installBridge(invoke);

  render(<AgentsView />);

  await user.click(await screen.findByRole("button", { name: "Test API" }));

  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith("providers:test", { provider: "openai" });
  });
  expect(await screen.findByText(/ok: reachable/i)).toBeInTheDocument();
});

it("gives each agent its own default mission brief instead of one shared sentence for every agent", async () => {
  const user = userEvent.setup();
  const twoAgents: AgentRecord[] = [
    { ...testAgents[0], id: "scout-agent", name: "Scout agent" },
    { ...testAgents[0], id: "ripper-agent", name: "Ripper agent" }
  ];
  const invoke = vi.fn<RendererInvokeMock>((channel) => {
    if (channel === "agents:list") {
      return Promise.resolve({ ok: true as const, value: { agents: twoAgents } });
    }
    return defaultInvoke(channel);
  });
  installBridge(invoke);

  render(<AgentsView />);

  await user.click(await screen.findByRole("button", { name: /Scout agent/i }));
  const scoutBrief = (await screen.findByLabelText<HTMLTextAreaElement>("Mission brief")).value;

  await user.click(screen.getByRole("button", { name: /Ripper agent/i }));
  const ripperBrief = screen.getByLabelText<HTMLTextAreaElement>("Mission brief").value;

  expect(scoutBrief).not.toBe(ripperBrief);
  expect(scoutBrief).not.toBe("Build an OSINT profile for jdoe and summarize useful pivots.");

  // Switching back to Scout must not have lost anything it had -- each
  // agent's brief is independent state, not a single shared field.
  await user.click(screen.getByRole("button", { name: /Scout agent/i }));
  expect(screen.getByLabelText<HTMLTextAreaElement>("Mission brief").value).toBe(scoutBrief);
});
