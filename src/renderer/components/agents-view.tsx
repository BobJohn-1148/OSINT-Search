/**
 * The Agents view owns interaction state while the 3D scene only receives
 * presentation props. If the canvas owned IPC, visibility, or job launch state,
 * a render loop could block local work and break the main-process agent boundary.
 */
import { AlertTriangle, MessageSquare, Play, RefreshCw } from "lucide-react";
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import rawStatusLines from "../../../planning/agent-status-lines.json";
import type { AgentRecord } from "../../shared/schemas/agents";
import type { ArchitectProposal } from "../../shared/schemas/architect-agent";
import type {
  AgentLiveState,
  AgentMemoryRecord,
  AgentPlaybook,
  AgentRunRecord,
  AgentRuntimeEvent
} from "../../shared/schemas/agents-runtime";
import { mapAgentsToPresentation, type AgentPresentation, type AgentStatusLinePool } from "../agents/agent-status";
import { focusAgentCamera, hqCameraControlHints, type CameraFocusTarget } from "../agents/camera-controls";
import { readHqPalette } from "../agents/theme-palette";
import { canInitializeWebGl } from "../agents/webgl";
import { useReacherClient } from "../hooks/use-reacher-client";
import { AgentsHqScene } from "./agents-hq-scene";

const statusLines = rawStatusLines as AgentStatusLinePool;
const cleanIdleSettingKey = "agents.cleanIdleStatuses";

interface SceneBoundaryProps {
  readonly children: ReactNode;
  readonly onError: () => void;
}

class SceneBoundary extends Component<SceneBoundaryProps, { readonly failed: boolean }> {
  public state = { failed: false };

  public static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  public componentDidCatch(): void {
    this.props.onError();
  }

  public render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function AgentsView(props: {
  readonly webGlReadyOverride?: boolean;
  readonly SceneComponent?: typeof AgentsHqScene;
} = {}) {
  const { invoke } = useReacherClient();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [states, setStates] = useState<AgentLiveState[]>([]);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [memory, setMemory] = useState<AgentMemoryRecord[]>([]);
  const [playbooks, setPlaybooks] = useState<AgentPlaybook[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"Inbox" | "History" | "Playbooks">("Inbox");
  const [cleanIdleStatuses, setCleanIdleStatuses] = useState(false);
  const [status, setStatus] = useState("Connecting");
  const [idleTick, setIdleTick] = useState(0);
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const [spacePan, setSpacePan] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [events, setEvents] = useState<AgentRuntimeEvent[]>([]);
  const [focused, setFocused] = useState<CameraFocusTarget | null>(null);
  const [architectQuestion, setArchitectQuestion] = useState("How is IPC wired?");
  const [architectRequest, setArchitectRequest] = useState("Add a focused feature with tests");
  const [architectProposal, setArchitectProposal] = useState<ArchitectProposal | null>(null);
  const [architectStatus, setArchitectStatus] = useState("Architect ready");
  const [missionBrief, setMissionBrief] = useState("Follow the mission brief, cite sources, and save only evidence-backed findings.");
  const [detectedWebGlReady] = useState(() => canInitializeWebGl());
  const SceneComponent = props.SceneComponent ?? AgentsHqScene;
  const webGlReady = props.webGlReadyOverride ?? detectedWebGlReady;
  const palette = useMemo(() => readHqPalette(), []);
  const fallbackAgent = agents.length > 0 ? agents[0] : null;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? fallbackAgent;
  const activeAgentId = selectedAgentId ?? selectedAgent?.id ?? null;

  const refresh = useCallback(async (): Promise<void> => {
    const [agentResult, stateResult, runsResult, memoryResult, playbooksResult, casesResult, cleanResult] = await Promise.all([
      invoke("agents:list", {}),
      invoke("agent:states", {}),
      invoke("agent:runs", {}),
      invoke("agent:memory:list", { limit: 50 }),
      invoke("agent:playbooks", {}),
      invoke("cases:list", {}),
      invoke("settings:get", { key: cleanIdleSettingKey })
    ]);

    if (agentResult.ok) {
      setAgents(agentResult.value.agents);
    }
    if (stateResult.ok) {
      setStates(stateResult.value.states);
    }
    if (runsResult.ok) {
      setRuns(runsResult.value.runs);
    }
    if (memoryResult.ok) {
      setMemory(memoryResult.value.memory);
    }
    if (playbooksResult.ok) {
      setPlaybooks(playbooksResult.value.playbooks);
    }
    if (cleanResult.ok) {
      setCleanIdleStatuses(cleanResult.value.value === "true");
    }

    const error = [agentResult, stateResult, runsResult, memoryResult, playbooksResult, casesResult, cleanResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Connected");
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setIdleTick((tick) => tick + 1), 11000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePan(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePan(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    return window.reacher.onAgentEvent("agent:events", (batch) => {
      setEvents((current) => [...batch.events, ...current].slice(0, 30));
      setStates((current) => applyStateEvents(current, batch.events));
    });
  }, []);

  const presentations = useMemo(
    () =>
      mapAgentsToPresentation({
        agents,
        states,
        lines: statusLines,
        cleanIdleStatuses,
        idleTick
      }),
    [agents, cleanIdleStatuses, idleTick, states]
  );
  const fallbackPresentation = presentations.length > 0 ? presentations[0] : null;
  const selectedPresentation = presentations.find((agent) => agent.agent.id === activeAgentId) ?? fallbackPresentation;
  const workingCount = presentations.filter((agent) => agent.working).length;
  const idleCount = presentations.filter((agent) => agent.state.status === "idle").length;
  const useListFallback = !webGlReady || sceneFailed;

  async function runSelectedAgent(): Promise<void> {
    const brief = missionBrief.trim();
    if (!selectedAgent || !brief) {
      return;
    }
    const seedValue = brief.length > 120 ? `${brief.slice(0, 117)}...` : brief;
    setStatus(`Running ${selectedAgent.name}`);
    const result = await invoke("agent:run", {
      agentId: selectedAgent.id,
      seed: { type: "business", value: seedValue },
      missionBrief: brief
    });
    setStatus(result.ok ? `Saved finding for ${selectedAgent.name}` : result.error.message);
    await refresh();
  }

  async function setCleanIdle(next: boolean): Promise<void> {
    setCleanIdleStatuses(next);
    const result = await invoke("settings:set", { key: cleanIdleSettingKey, value: String(next) });
    setStatus(result.ok ? "Settings saved" : result.error.message);
  }

  async function askArchitect(): Promise<void> {
    const result = await invoke("agent:architect:ask", {
      question: architectQuestion,
      files: ["src/shared/ipc.ts", "src/main/ipc/register.ts"]
    });
    setArchitectStatus(result.ok ? result.value.answer : result.error.message);
  }

  async function proposeArchitectPlan(): Promise<void> {
    const result = await invoke("agent:architect:proposePlan", {
      request: architectRequest,
      files: ["src/shared/ipc.ts", "src/main/ipc/register.ts", "src/renderer/components/agents-view.tsx"]
    });
    if (!result.ok) {
      setArchitectStatus(result.error.message);
      return;
    }
    setArchitectProposal(result.value.proposal);
    setArchitectStatus(result.value.proposal.summary);
  }

  async function applyArchitectPlan(): Promise<void> {
    if (!architectProposal) {
      return;
    }
    const result = await invoke("agent:architect:apply", { proposalId: architectProposal.id });
    setArchitectStatus(result.ok ? (result.value.applied ? `Plan applied to ${result.value.changedFiles.join(", ")}` : "Apply cancelled") : result.error.message);
    await refresh();
  }

  function openAgent(agentId: string): void {
    setSelectedAgentId(agentId);
    setSelectedTab("Inbox");
  }

  function focusAgent(agentId: string): void {
    const index = presentations.findIndex((agent) => agent.agent.id === agentId);
    if (index !== -1) {
      setFocused(focusAgentCamera(presentations[index], index));
    }
  }

  return (
    <section className="route-surface agents-surface" aria-labelledby="agents-title">
      <header className="route-header">
        <h1 className="route-title" id="agents-title">
          AI agents
        </h1>
        <p className="route-summary">Reacher HQ runs local agent jobs from main process state while the office stays interactive.</p>
      </header>

      <div className="agents-hq-layout">
        <section className="agents-hq-stage" aria-label="Reacher HQ">
          {useListFallback ? (
            <AgentFallbackList agents={presentations} onOpen={openAgent} onFocus={focusAgent} />
          ) : (
            <SceneBoundary onError={() => setSceneFailed(true)}>
              <SceneComponent
                agents={presentations}
                palette={palette}
                visible={visible}
                spacePan={spacePan}
                focused={focused}
                selectedAgentId={activeAgentId}
                runs={runs}
                memory={memory}
                onFocusedChange={setFocused}
                onAgentOpen={openAgent}
              />
            </SceneBoundary>
          )}
          <div className="agents-hq-statusbar">
            <div className="agents-hints" aria-label="Camera controls">
              {hqCameraControlHints.map((hint) => (
                <span key={hint.id}>{hint.label}</span>
              ))}
            </div>
            <span className="agents-connection">{status.toLowerCase()} · {workingCount} working · {idleCount} idle</span>
            <button className="icon-button" type="button" aria-label="Open chat" title="Open chat">
              <MessageSquare size={16} aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className="agents-hq-panel" aria-label="HQ panel">
          <div className="agents-panel-tabs" role="tablist" aria-label="HQ tabs">
            {(["Inbox", "History", "Playbooks"] as const).map((tab) => (
              <button
                className="agents-tab"
                type="button"
                role="tab"
                aria-selected={selectedTab === tab}
                key={tab}
                onClick={() => setSelectedTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {selectedTab === "Inbox" ? (
            <AgentHub
              selectedAgent={selectedAgent}
              selectedPresentation={selectedPresentation}
              events={events}
              memory={memory}
              runs={runs}
              cleanIdleStatuses={cleanIdleStatuses}
              missionBrief={missionBrief}
              onMissionBriefChange={setMissionBrief}
              onRun={() => void runSelectedAgent()}
              onCleanIdleChange={(next) => void setCleanIdle(next)}
              architectQuestion={architectQuestion}
              architectRequest={architectRequest}
              architectProposal={architectProposal}
              architectStatus={architectStatus}
              onArchitectQuestionChange={setArchitectQuestion}
              onArchitectRequestChange={setArchitectRequest}
              onArchitectAsk={() => void askArchitect()}
              onArchitectPropose={() => void proposeArchitectPlan()}
              onArchitectApply={() => void applyArchitectPlan()}
            />
          ) : selectedTab === "History" ? (
            <HistoryPanel runs={runs} agents={agents} onRefresh={() => void refresh()} />
          ) : (
            <PlaybooksPanel playbooks={playbooks} agents={agents} onRefresh={() => void refresh()} />
          )}
        </aside>
      </div>
    </section>
  );
}

function AgentFallbackList(props: {
  readonly agents: readonly AgentPresentation[];
  readonly onOpen: (agentId: string) => void;
  readonly onFocus: (agentId: string) => void;
}) {
  return (
    <div className="agents-fallback" role="list" aria-label="Agents list fallback">
      <div className="agents-fallback-banner">
        <AlertTriangle size={18} aria-hidden="true" />
        <span>3D scene unavailable; list view active.</span>
      </div>
      {props.agents.map((agent) => (
        <button
          key={agent.agent.id}
          className="agent-list-button"
          type="button"
          onClick={() => props.onOpen(agent.agent.id)}
          onDoubleClick={() => props.onFocus(agent.agent.id)}
        >
          <span>{agent.label}</span>
          <strong>{agent.statusText}</strong>
        </button>
      ))}
    </div>
  );
}

function AgentHub(props: {
  readonly selectedAgent: AgentRecord | null;
  readonly selectedPresentation: ReturnType<typeof mapAgentsToPresentation>[number] | null;
  readonly events: readonly AgentRuntimeEvent[];
  readonly memory: readonly AgentMemoryRecord[];
  readonly runs: readonly AgentRunRecord[];
  readonly cleanIdleStatuses: boolean;
  readonly missionBrief: string;
  readonly onMissionBriefChange: (value: string) => void;
  readonly onRun: () => void;
  readonly onCleanIdleChange: (value: boolean) => void;
  readonly architectQuestion: string;
  readonly architectRequest: string;
  readonly architectProposal: ArchitectProposal | null;
  readonly architectStatus: string;
  readonly onArchitectQuestionChange: (value: string) => void;
  readonly onArchitectRequestChange: (value: string) => void;
  readonly onArchitectAsk: () => void;
  readonly onArchitectPropose: () => void;
  readonly onArchitectApply: () => void;
}) {
  const selectedAgentId = props.selectedAgent?.id ?? "";
  const agentRuns = props.runs.filter((run) => run.agentId === selectedAgentId);
  const agentMemory = props.memory.filter((item) => item.sourceAgent === selectedAgentId);
  const sharedMemory = props.memory.filter((item) => item.scope === "global");
  const currentTask = props.selectedPresentation?.state.task ?? props.selectedPresentation?.statusText ?? "Waiting for work";
  const lastRun = agentRuns.at(0);
  const previousRun = agentRuns.at(1);
  const spend = estimateAgentSpend(agentRuns);

  return (
    <div className="agents-panel-body">
      <section className="agents-selected-agent" aria-label="Selected agent">
        <div className="agent-profile-card">
          <span className={`agent-status-light agent-status-${props.selectedPresentation?.state.status ?? "offline"}`} aria-hidden="true" />
          <h2 className="section-title">{props.selectedAgent?.name ?? "No agent"}</h2>
          <p className="status-text">{agentPersonality(selectedAgentId)}</p>
          <dl className="agent-profile-stats">
            <div>
              <dt>Current</dt>
              <dd>{currentTask}</dd>
            </div>
            <div>
              <dt>Recent run</dt>
              <dd>{lastRun ? `${lastRun.seed.type}:${lastRun.seed.value}` : "No runs yet"}</dd>
            </div>
            <div>
              <dt>Previous</dt>
              <dd>{previousRun ? `${previousRun.seed.type}:${previousRun.seed.value}` : "None"}</dd>
            </div>
            <div>
              <dt>Est. spend</dt>
              <dd>{spend}</dd>
            </div>
          </dl>
        </div>
        <label className="agents-toggle">
          <input
            type="checkbox"
            checked={props.cleanIdleStatuses}
            onChange={(event) => props.onCleanIdleChange(event.currentTarget.checked)}
          />
          Clean idle statuses
        </label>
      </section>

      <section className="agents-run-box" aria-label="Run view">
        <label className="compact-field agents-mission-field">
          Mission brief
          <textarea
            className="field-control mission-brief-input"
            value={props.missionBrief}
            onChange={(event) => props.onMissionBriefChange(event.currentTarget.value)}
          />
        </label>
        <button className="action-button" type="button" disabled={!props.selectedAgent || !props.missionBrief.trim()} onClick={props.onRun}>
          <Play size={16} aria-hidden="true" />
          Run mission
        </button>
      </section>

      {props.selectedAgent?.id === "architect-agent" ? (
        <section className="architect-box" aria-label="Architect agent">
          <label className="compact-field">
            Question
            <input
              className="field-control"
              value={props.architectQuestion}
              onChange={(event) => props.onArchitectQuestionChange(event.currentTarget.value)}
            />
          </label>
          <button className="action-button" type="button" onClick={props.onArchitectAsk}>
            Ask architect
          </button>
          <label className="compact-field">
            Feature request
            <input
              className="field-control"
              value={props.architectRequest}
              onChange={(event) => props.onArchitectRequestChange(event.currentTarget.value)}
            />
          </label>
          <button className="action-button" type="button" onClick={props.onArchitectPropose}>
            Propose plan
          </button>
          <button className="action-button" type="button" disabled={!props.architectProposal} onClick={props.onArchitectApply}>
            Apply approved plan
          </button>
          <p className="status-text">{props.architectStatus}</p>
        </section>
      ) : null}

      <section className="agents-event-list" aria-label="Inbox events">
        {props.events.length === 0 ? (
          <p className="status-text">No agent events yet.</p>
        ) : (
          props.events.map((event, index) => (
            <div className="agents-event-row" key={`${event.type}-${index}`}>
              <span className="mono-cell">{event.type}</span>
              <strong>{event.type === "agent:step" ? event.step.title : event.type === "agent:finding" ? event.finding.title : event.state.status}</strong>
            </div>
          ))
        )}
      </section>

      <section className="agents-event-list" aria-label="Shared memory">
        <h3 className="agents-subtitle">Saved memory for this agent</h3>
        {agentMemory.slice(0, 4).map((item) => (
          <div className="agents-event-row" key={item.id}>
            <span className="mono-cell">{item.key}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        {agentMemory.length === 0 ? <p className="status-text">No saved memory for this agent yet.</p> : null}
      </section>

      <section className="agents-event-list" aria-label="Shared memory">
        <h3 className="agents-subtitle">Shared memory</h3>
        {sharedMemory.slice(0, 4).map((item) => (
          <div className="agents-event-row" key={item.id}>
            <span className="mono-cell">{item.key}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        {sharedMemory.length === 0 ? <p className="status-text">No shared memory yet.</p> : null}
      </section>
    </div>
  );
}

function HistoryPanel(props: {
  readonly runs: readonly AgentRunRecord[];
  readonly agents: readonly AgentRecord[];
  readonly onRefresh: () => void;
}) {
  return (
    <div className="agents-panel-body">
      <PanelHeader title="History" onRefresh={props.onRefresh} />
      <div className="agents-event-list" role="list" aria-label="Agent run history">
        {props.runs.map((run) => (
          <div className="agents-event-row" role="listitem" key={run.id}>
            <span>{agentName(props.agents, run.agentId)}</span>
            <strong>{run.seed.type}:{run.seed.value}</strong>
            <span className="status-text">{run.status}</span>
          </div>
        ))}
        {props.runs.length === 0 ? <p className="status-text">No runs yet.</p> : null}
      </div>
    </div>
  );
}

function PlaybooksPanel(props: {
  readonly playbooks: readonly AgentPlaybook[];
  readonly agents: readonly AgentRecord[];
  readonly onRefresh: () => void;
}) {
  return (
    <div className="agents-panel-body">
      <PanelHeader title="Playbooks" onRefresh={props.onRefresh} />
      <div className="agents-event-list" role="list" aria-label="Scheduled playbooks">
        {props.playbooks.map((playbook) => (
          <div className="agents-event-row" role="listitem" key={playbook.id}>
            <span>{playbook.title}</span>
            <strong>{agentName(props.agents, playbook.agentId)}</strong>
            <span className="status-text">{playbook.active ? `${playbook.cadence} active` : "paused"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({ title, onRefresh }: { readonly title: string; readonly onRefresh: () => void }) {
  return (
    <div className="section-title-row">
      <h2 className="section-title">{title}</h2>
      <button className="icon-button" type="button" aria-label={`Refresh ${title.toLowerCase()}`} title={`Refresh ${title.toLowerCase()}`} onClick={onRefresh}>
        <RefreshCw size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function applyStateEvents(current: readonly AgentLiveState[], events: readonly AgentRuntimeEvent[]): AgentLiveState[] {
  const stateByAgent = new Map(current.map((state) => [state.agentId, state]));
  for (const event of events) {
    if (event.type === "agent:state") {
      stateByAgent.set(event.state.agentId, event.state);
    }
  }
  return [...stateByAgent.values()];
}

function agentName(agents: readonly AgentRecord[], agentId: string): string {
  return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
}

function estimateAgentSpend(runs: readonly AgentRunRecord[]): string {
  const estimate = runs.reduce((total, run) => total + (run.provider === "openai" ? 0.018 : run.provider === "xai" ? 0.014 : 0.004), 0);
  return `$${estimate.toFixed(3)}`;
}

function agentPersonality(agentId: string): string {
  if (agentId.includes("architect")) {
    return "Systems designer: calm, picky, and allergic to brittle plans.";
  }
  if (agentId.includes("scout")) {
    return "Forward scout: fast pivots, recon maps, and headset chatter.";
  }
  if (agentId.includes("byte")) {
    return "Data analyst: terminal gremlin, tidy notes, suspiciously good memory.";
  }
  if (agentId.includes("ripper")) {
    return "Ops mechanic: keeps scanners humming and tears apart messy signals.";
  }
  return "Lead OSINT operator: careful pivots, source discipline, and a tiny top hat.";
}
