/**
 * Agents is the 3D ops den from planning/AGENTS_WORLD.md sitting on top of an
 * operations console. Both are always mounted: the den is the character view and
 * the console owns every control, so a GPU failure or a screen reader loses the
 * scenery without losing a single agent action. The scene only ever visualizes
 * state — job execution stays in main, per STABILITY.md.
 */
import { Activity, Boxes, Bot, ClipboardList, MessageSquare, Play, RefreshCw, Send } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentCardDeck } from "./agent-cards";
import { AgentsHqScene } from "./agents-hq-scene";
import { computeAgentInsights, formatDuration, formatShare, type DistributionSlice } from "../agents/agent-insights";
import { hqCameraControlHints, type CameraFocusTarget } from "../agents/camera-controls";
import { readHqPalette, type HqPalette } from "../agents/theme-palette";
import { canInitializeWebGl } from "../agents/webgl";
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
import type { CaseRecord } from "../../shared/schemas/cases";
import type { ProviderInfo } from "../../shared/schemas/providers";
import type { SeedType } from "../../shared/types/search";
import type { ReasoningEffort } from "../../shared/types/providers";
import { mapAgentsToPresentation, type AgentPresentation, type AgentStatusLinePool } from "../agents/agent-status";
import { useReacherClient } from "../hooks/use-reacher-client";

const statusLines = rawStatusLines as AgentStatusLinePool;

export function AgentsView() {
  const { invoke } = useReacherClient();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [states, setStates] = useState<AgentLiveState[]>([]);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [memory, setMemory] = useState<AgentMemoryRecord[]>([]);
  const [playbooks, setPlaybooks] = useState<AgentPlaybook[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  // Keyed by agent id, not one flat string: each agent has its own specialty
  // (see agent-personas.ts), so the brief you left for Scout should not show
  // up as Ripper's task the moment you switch the selector.
  const [missionBriefs, setMissionBriefs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Connecting");
  const [idleTick, setIdleTick] = useState(0);
  const [events, setEvents] = useState<AgentRuntimeEvent[]>([]);
  const [architectQuestion, setArchitectQuestion] = useState("How is IPC wired?");
  const [architectRequest, setArchitectRequest] = useState("Add a focused feature with tests");
  const [architectProposal, setArchitectProposal] = useState<ArchitectProposal | null>(null);
  const [architectStatus, setArchitectStatus] = useState("Architect ready");
  const [loading, setLoading] = useState(true);
  // Probed once in a lazy initializer rather than an effect: the answer cannot
  // change for the life of the component, and reading it during an effect would
  // render the den, then immediately re-render it with a palette.
  const [hq] = useState<{ readonly ready: boolean; readonly palette: HqPalette | null }>(() => {
    const ready = canInitializeWebGl();
    return { ready, palette: ready ? readHqPalette() : null };
  });
  const [denVisible, setDenVisible] = useState(true);
  const [spacePan, setSpacePan] = useState(false);
  const [focused, setFocused] = useState<CameraFocusTarget | null>(null);
  const [tabVisible, setTabVisible] = useState(true);

  const fallbackAgent = agents.length > 0 ? agents[0] : null;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? fallbackAgent;
  const activeAgentId = selectedAgentId ?? selectedAgent?.id ?? null;

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [agentResult, stateResult, runsResult, memoryResult, playbooksResult, casesResult, providersResult] = await Promise.all([
      invoke("agents:list", {}),
      invoke("agent:states", {}),
      invoke("agent:runs", {}),
      invoke("agent:memory:list", { limit: 50 }),
      invoke("agent:playbooks", {}),
      invoke("cases:list", {}),
      invoke("providers:list", {})
    ]);

    if (agentResult.ok) {
      setAgents(agentResult.value.agents);
    }
    if (providersResult.ok) {
      setProviders(providersResult.value.providers);
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
    if (casesResult.ok) {
      setCases(casesResult.value.cases);
      setCaseId((current) => current || (casesResult.value.cases[0]?.id ?? ""));
    }

    const error = [agentResult, stateResult, runsResult, memoryResult, playbooksResult, casesResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Connected");
    setLoading(false);
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

  // STABILITY.md: the render loop must stop when the window is hidden so a
  // backgrounded app is not burning GPU on an office nobody is looking at.
  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
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
        cleanIdleStatuses: true,
        idleTick
      }),
    [agents, idleTick, states]
  );
  const workingCount = presentations.filter((agent) => agent.working).length;
  const idleCount = presentations.filter((agent) => agent.state.status === "idle").length;
  const selectedPersona = presentations.find((agent) => agent.agent.id === activeAgentId)?.persona ?? null;
  const missionBrief = activeAgentId ? missionBriefs[activeAgentId] ?? defaultMissionBrief(selectedPersona?.role) : "";
  const selectedProvider = providers.find((provider) => provider.id === selectedAgent?.provider) ?? null;
  const supportedEfforts = selectedProvider?.supportedEfforts ?? [];
  const insights = useMemo(
    () => computeAgentInsights({ agents, runs, memory, playbooks }),
    [agents, memory, playbooks, runs]
  );
  // Per-agent slices power the "open one agent" panel so clicking a character
  // shows that agent's own history and playbooks, not a global rail.
  const agentRuns = useMemo(() => runs.filter((run) => run.agentId === activeAgentId).slice(0, 6), [activeAgentId, runs]);
  const agentPlaybooks = useMemo(() => playbooks.filter((playbook) => playbook.agentId === activeAgentId), [activeAgentId, playbooks]);
  const selectedPresentation = presentations.find((agent) => agent.agent.id === activeAgentId) ?? null;

  async function setAgentEffort(effort: ReasoningEffort | null): Promise<void> {
    if (!selectedAgent) {
      return;
    }
    const result = await invoke("agents:setEffort", { agentId: selectedAgent.id, reasoningEffort: effort });
    setStatus(result.ok ? `${selectedAgent.name} effort: ${effort ?? "provider default"}` : result.error.message);
    await refresh();
  }

  async function runSelectedAgent(): Promise<void> {
    if (!selectedAgent || !missionBrief.trim()) {
      return;
    }
    setStatus(`Running ${selectedAgent.name}`);
    const result = await invoke("agent:run", {
      agentId: selectedAgent.id,
      seed: inferSeed(missionBrief),
      caseId: caseId || undefined
    });
    setStatus(result.ok ? `Agent run saved` : result.error.message);
    await refresh();
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

  return (
    <section className="route-surface agents-surface agents-surface-immersive" aria-label="AI agents headquarters">
      {hq.ready && denVisible && hq.palette ? (
        <section className="agents-hq-stage agents-hq-stage-full" aria-label="Agent headquarters">
          <AgentsHqScene
            agents={presentations}
            palette={hq.palette}
            visible={tabVisible}
            spacePan={spacePan}
            focused={focused}
            selectedAgentId={activeAgentId}
            onFocusedChange={setFocused}
            onAgentOpen={setSelectedAgentId}
          />
          <div className="agents-hq-statusbar">
            <div className="agents-hints">
              {hqCameraControlHints.map((hint) => (
                <span key={hint.id}>{hint.label}</span>
              ))}
            </div>
            <span className="agents-connection">
              {status.toLowerCase()} · {workingCount} working · {idleCount} idle
            </span>
            <button className="icon-button" type="button" aria-label="Hide the den" title="Hide the den" onClick={() => setDenVisible(false)}>
              <Boxes size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {hq.ready && !denVisible ? (
        <div className="action-row">
          <button className="action-button" type="button" onClick={() => setDenVisible(true)}>
            <Boxes size={16} aria-hidden="true" />
            Show the den
          </button>
        </div>
      ) : null}

      <AgentCardDeck presentations={presentations} providers={providers} memory={memory} events={events} onRefresh={() => void refresh()} />

      <div className="agents-command-center">
        <section className="console-panel agents-roster-panel" aria-labelledby="agent-roster-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="agent-roster-title">Roster</h2>
            <button className="icon-button" type="button" aria-label="Refresh agents" title="Refresh agents" onClick={() => void refresh()}>
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="agent-roster-list" role="list" aria-label="Agents">
            {presentations.map((agent) => (
              <button className={agent.agent.id === activeAgentId ? "agent-roster-card is-selected" : "agent-roster-card"} type="button" key={agent.agent.id} onClick={() => setSelectedAgentId(agent.agent.id)}>
                <Bot size={18} aria-hidden="true" />
                <span>
                  <strong>{agent.agent.name}</strong>
                  <em className="agent-callsign">{agent.persona.callsign}</em>
                  <small>{agent.statusText}</small>
                </span>
                <span className={agent.working ? "strength-pill" : "status-pill"}>{agent.state.status}</span>
              </button>
            ))}
            {!loading && presentations.length === 0 ? <p className="status-text">No agents configured yet.</p> : null}
          </div>
        </section>

        <section className="console-panel agent-workbench-panel agent-app-panel" aria-labelledby="agent-workbench-title">
          <div className="agent-app-header">
            <div className={selectedPresentation?.working ? "agent-app-avatar is-working" : "agent-app-avatar"} aria-hidden="true">
              <Bot size={26} />
              <span className={`status-dot ${agentDotClass(selectedPresentation)}`} />
            </div>
            <div className="agent-app-identity">
              <span className="tool-card-kicker">{selectedAgent?.provider ?? "provider"} / {selectedAgent?.model ?? "model"}</span>
              <h2 className="section-title" id="agent-workbench-title">{selectedAgent?.name ?? "Select an agent"}</h2>
              {selectedPersona ? (
                <p className="agent-persona-line">
                  <strong>{selectedPersona.callsign}</strong> — {selectedPersona.role}. <em>{selectedPersona.tagline}</em>
                </p>
              ) : null}
            </div>
            <button className="icon-button" type="button" aria-label="Open chat" title="Open chat">
              <MessageSquare size={16} aria-hidden="true" />
            </button>
          </div>
          {selectedPresentation ? (
            <p className="agent-app-statusline">
              <span className={`status-dot ${agentDotClass(selectedPresentation)}`} aria-hidden="true" />
              {selectedPresentation.state.status} · {selectedPresentation.statusText}
            </p>
          ) : null}
          <label className="compact-field">
            Mission brief
            <textarea
              className="agent-brief-input"
              value={missionBrief}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (activeAgentId) {
                  setMissionBriefs((current) => ({ ...current, [activeAgentId]: nextValue }));
                }
              }}
            />
          </label>
          {selectedAgent ? (
            supportedEfforts.length > 0 ? (
              <label className="compact-field agent-effort-field">
                Reasoning effort
                <select
                  className="field-control"
                  aria-label="Reasoning effort"
                  value={selectedAgent.reasoningEffort ?? ""}
                  onChange={(event) => void setAgentEffort(event.currentTarget.value ? (event.currentTarget.value as ReasoningEffort) : null)}
                >
                  <option value="">Provider default</option>
                  {supportedEfforts.map((effort) => (
                    <option key={effort} value={effort}>
                      {effort}
                    </option>
                  ))}
                </select>
                <small className="status-text">How hard {selectedProvider?.label ?? "the provider"} thinks before answering.</small>
              </label>
            ) : (
              <p className="status-text agent-effort-unsupported">{selectedProvider?.label ?? "This provider"} has no reasoning-effort control.</p>
            )
          ) : null}
          <div className="agent-run-row">
            <label className="compact-field">
              Case
              <select className="field-control" value={caseId} onChange={(event) => setCaseId(event.currentTarget.value)}>
                <option value="">Auto-create case</option>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="action-button primary-action" type="button" disabled={!selectedAgent || !missionBrief.trim()} onClick={() => void runSelectedAgent()}>
              <Play size={16} aria-hidden="true" />
              Run agent
            </button>
          </div>

          {selectedAgent?.id === "architect-agent" ? (
            <section className="architect-box" aria-label="Architect agent">
              <label className="compact-field">
                Question
                <input className="field-control" value={architectQuestion} onChange={(event) => setArchitectQuestion(event.currentTarget.value)} />
              </label>
              <button className="action-button" type="button" onClick={() => void askArchitect()}>
                <Send size={16} aria-hidden="true" />
                Ask architect
              </button>
              <label className="compact-field">
                Feature request
                <input className="field-control" value={architectRequest} onChange={(event) => setArchitectRequest(event.currentTarget.value)} />
              </label>
              <div className="action-row">
                <button className="action-button" type="button" onClick={() => void proposeArchitectPlan()}>Propose plan</button>
                <button className="action-button" type="button" disabled={!architectProposal} onClick={() => void applyArchitectPlan()}>Apply approved plan</button>
              </div>
              <p className="status-text">{architectStatus}</p>
            </section>
          ) : null}

          <div className="agent-app-activity">
            <div className="agent-app-activity-col">
              <h3 className="agents-subtitle">This agent's runs</h3>
              {agentRuns.length > 0 ? (
                agentRuns.map((run) => (
                  <div className="agents-event-row" key={run.id}>
                    <ClipboardList size={15} aria-hidden="true" />
                    <strong>{run.seed.value}</strong>
                    <span className="status-text">{run.status}</span>
                  </div>
                ))
              ) : (
                <p className="status-text">No runs for this agent yet.</p>
              )}
            </div>
            <div className="agent-app-activity-col">
              <h3 className="agents-subtitle">Its playbooks</h3>
              {agentPlaybooks.length > 0 ? (
                agentPlaybooks.map((playbook) => (
                  <div className="agents-event-row" key={playbook.id}>
                    <span>{playbook.title}</span>
                    <span className="status-text">{playbook.active ? `${playbook.cadence} active` : "paused"}</span>
                  </div>
                ))
              ) : (
                <p className="status-text">No playbooks scheduled for this agent.</p>
              )}
            </div>
          </div>
        </section>

        <section className="console-panel agents-live-panel" aria-labelledby="agents-live-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="agents-live-title">Live activity</h2>
            <span className="status-text">{status.toLowerCase()} / {workingCount} working / {idleCount} idle</span>
          </div>
          <div className="terminal-output terminal-lines" role="log">
            {events.map((event, index) => (
              <div className="terminal-record" key={`${event.type}-${index}`}>
                <strong>{event.type}</strong>
                <span>{event.type === "agent:step" ? event.step.title : event.type === "agent:finding" ? event.finding.title : event.state.status}</span>
              </div>
            ))}
            {events.length === 0 ? <div className="terminal-line">$ No agent events yet.</div> : null}
          </div>
        </section>

        <section className="console-panel agents-memory-panel" aria-labelledby="agents-memory-title">
          <h2 className="section-title" id="agents-memory-title">Shared memory</h2>
          <div className="agent-memory-grid">
            {memory.slice(0, 8).map((item) => (
              <div className="agent-memory-card" key={item.id}>
                <span className="mono-cell">{item.key}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
            {memory.length === 0 ? <p className="status-text">No shared memory yet.</p> : null}
          </div>
        </section>

        <section className="console-panel agents-insights-panel" aria-labelledby="agents-insights-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="agents-insights-title">Insights</h2>
            <Activity size={16} aria-hidden="true" />
          </div>
          <div className="insight-tile-grid">
            <InsightTile label="Total runs" value={String(insights.totalRuns)} />
            <InsightTile label="Success rate" value={formatShare(insights.successRate)} />
            <InsightTile label="Median run" value={formatDuration(insights.medianDurationMs)} />
            <InsightTile label="In flight" value={String(insights.inFlight)} />
            <InsightTile label="Failed" value={String(insights.failed)} />
            <InsightTile label="Memory entries" value={String(insights.memoryEntries)} />
            <InsightTile
              label="Avg confidence"
              value={insights.averageMemoryConfidence === null ? "—" : insights.averageMemoryConfidence.toFixed(1)}
            />
            <InsightTile label="Active playbooks" value={String(insights.activePlaybooks)} />
          </div>
          <div className="insight-detail-row">
            <span className="status-text">Busiest agent</span>
            <strong className="mono-cell">{insights.busiestAgent ?? "nobody yet"}</strong>
          </div>
          <InsightBars title="What they investigate" slices={insights.seedMix} emptyLabel="No runs to break down yet." />
          <InsightBars title="Provider mix" slices={insights.providerMix} emptyLabel="No provider history yet." />
        </section>

        <section className="console-panel agents-history-panel" aria-labelledby="agents-history-title">
          <h2 className="section-title" id="agents-history-title">History and playbooks</h2>
          <div className="agents-history-columns">
            <div className="table-list" aria-label="Agent run history">
              {runs.slice(0, 8).map((run) => (
                <div className="agents-event-row" key={run.id}>
                  <ClipboardList size={15} aria-hidden="true" />
                  <span>{agentName(agents, run.agentId)}</span>
                  <strong>{run.seed.value}</strong>
                  <span className="status-text">{run.status}</span>
                </div>
              ))}
              {runs.length === 0 ? <p className="status-text">No runs yet.</p> : null}
            </div>
            <div className="table-list" aria-label="Scheduled playbooks">
              {playbooks.slice(0, 8).map((playbook) => (
                <div className="agents-event-row" key={playbook.id}>
                  <span>{playbook.title}</span>
                  <strong>{agentName(agents, playbook.agentId)}</strong>
                  <span className="status-text">{playbook.active ? `${playbook.cadence} active` : "paused"}</span>
                </div>
              ))}
              {playbooks.length === 0 ? <p className="status-text">No playbooks yet.</p> : null}
            </div>
          </div>
        </section>
      </div>

      {loading ? <div className="route-loading" role="status">Loading agent console</div> : null}
    </section>
  );
}

function InsightTile({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="metric-tile insight-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function InsightBars({
  title,
  slices,
  emptyLabel
}: {
  readonly title: string;
  readonly slices: readonly DistributionSlice[];
  readonly emptyLabel: string;
}) {
  return (
    <div className="insight-bars">
      <h3 className="agents-subtitle">{title}</h3>
      {slices.length === 0 ? (
        <p className="status-text">{emptyLabel}</p>
      ) : (
        slices.slice(0, 5).map((slice) => (
          <div className="insight-bar-row" key={slice.label}>
            <span className="insight-bar-label">{slice.label}</span>
            <span className="insight-bar-track">
              <span className="insight-bar-fill" style={{ "--insight-share": `${slice.share * 100}%` } as CSSProperties} />
            </span>
            <span className="insight-bar-count">{slice.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Seeds the brief textarea from the agent's own persona role (agent-personas.ts)
 * instead of one fixed sentence for every agent, so Scout starts pointed at
 * recon and Ripper starts pointed at credentials rather than both opening on
 * an identical "build an OSINT profile" task that only ever suited the OSINT
 * agent itself.
 */
function defaultMissionBrief(role: string | undefined): string {
  if (!role) {
    return "";
  }
  if (role.includes("recon")) {
    return "Recon the seed's infrastructure and surface pivots worth chasing.";
  }
  if (role.includes("Credential")) {
    return "Check the seed for exposed credentials and summarize what's crackable.";
  }
  if (role.includes("malware")) {
    return "Statically triage the seed and report indicators without executing anything.";
  }
  if (role.includes("analysis")) {
    return "Analyze the seed's logs, packets, or artifacts and surface anomalies.";
  }
  if (role.includes("collection")) {
    return "Build a cited OSINT profile for the seed and summarize useful pivots.";
  }
  if (role.includes("plan")) {
    return "Review the current implementation and propose next steps.";
  }
  return "Investigate the seed and summarize findings.";
}

function inferSeed(text: string): { readonly type: SeedType; readonly value: string } {
  const rawTokens = text.match(/[A-Za-z0-9._%:+@/-]+/g) ?? [text.trim()];
  const candidates = rawTokens
    .flatMap((token) => [token, token.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0] ?? token])
    .map((token) => token.replace(/^[("']+|[)"'.:,;]+$/g, ""))
    .filter((token) => token.length > 2);
  const firstCandidate = candidates[0] ?? text.trim();
  const email = candidates.find((token) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token));
  if (email) {
    return { type: "email", value: email };
  }
  const ip = candidates.find((token) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(token));
  if (ip) {
    return { type: "ip", value: ip };
  }
  const mac = candidates.find((token) => /^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}$/.test(token));
  if (mac) {
    return { type: "mac", value: mac };
  }
  const phone = candidates.find((token) => /^\+?[0-9][0-9(). -]{6,}$/.test(token));
  if (phone) {
    return { type: "phone", value: phone };
  }
  const domain = candidates.find((token) => /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(token));
  if (domain) {
    return { type: "domain", value: domain };
  }
  return { type: "username", value: firstCandidate };
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

// Traffic-light dot for an agent's live state: green working, amber idle-online,
// red error, grey offline/unknown. Matches the den's motion tell in the console.
function agentDotClass(presentation: AgentPresentation | null): string {
  if (!presentation) {
    return "status-dot-untested";
  }
  switch (presentation.state.status) {
    case "working":
      return "status-dot-verified";
    case "error":
      return "status-dot-error";
    case "offline":
      return "status-dot-untested";
    default:
      return "status-dot-candidate";
  }
}
