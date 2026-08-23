/**
 * The agent deck is the "talk to your team" surface: each agent is a card you can
 * chat with, test, and re-provision, and clicking one opens a focused panel with
 * its chain of thought, saved memory, and the prompt it runs on. It sits on top of
 * the operations console (which stays as the accessible fallback), and every
 * mutation still goes through the same typed IPC the console uses — the cards only
 * present state, they never execute a run themselves.
 */
import { Maximize2, MessageSquare, Play, Plug, RefreshCw, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { AgentMemoryRecord, AgentRuntimeEvent } from "../../shared/schemas/agents-runtime";
import type { ProviderInfo } from "../../shared/schemas/providers";
import type { ReasoningEffort } from "../../shared/types/providers";
import type { SeedType } from "../../shared/types/search";
import type { AgentPresentation } from "../agents/agent-status";
import { useReacherClient } from "../hooks/use-reacher-client";
import { ChainOfThought, type ThoughtStep } from "./chain-of-thought";
import { ProviderLogo } from "./provider-logo";

interface AgentCardDeckProps {
  readonly presentations: readonly AgentPresentation[];
  readonly providers: readonly ProviderInfo[];
  readonly memory: readonly AgentMemoryRecord[];
  readonly events: readonly AgentRuntimeEvent[];
  readonly onRefresh: () => void;
}

export function AgentCardDeck(props: AgentCardDeckProps) {
  const { invoke } = useReacherClient();
  const [modalAgentId, setModalAgentId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);

  const modalPresentation = props.presentations.find((item) => item.agent.id === modalAgentId) ?? null;

  async function testApi(agent: AgentPresentation): Promise<void> {
    setBusyAgentId(agent.agent.id);
    setTestResults((current) => ({ ...current, [agent.agent.id]: "Testing…" }));
    const result = await invoke("providers:test", { provider: agent.agent.provider });
    setTestResults((current) => ({
      ...current,
      [agent.agent.id]: result.ok ? `${result.value.ok ? "ok" : "failed"}: ${result.value.message}` : result.error.message
    }));
    setBusyAgentId(null);
  }

  return (
    <section className="console-panel agent-deck-panel" aria-labelledby="agent-deck-title">
      <div className="section-title-row section-title-row-wide">
        <h2 className="section-title" id="agent-deck-title">Your agents</h2>
        <button className="icon-button" type="button" aria-label="Refresh agents" title="Refresh" onClick={props.onRefresh}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="agent-deck-grid">
        {props.presentations.map((agent) => (
          <article className="agent-deck-card" key={agent.agent.id}>
            <div className="agent-deck-top">
              <span className="agent-deck-avatar">
                <ProviderLogo provider={agent.agent.provider} size={22} />
              </span>
              <div className="agent-deck-id">
                <strong>{agent.agent.name}</strong>
                <span className="agent-callsign">{agent.persona.callsign}</span>
              </div>
              <span className={`status-dot ${dotClass(agent)}`} title={agent.state.status} aria-hidden="true" />
              <button className="icon-button agent-deck-expand" type="button" aria-label={`Open ${agent.persona.callsign} panel`} title="Expand" onClick={() => setModalAgentId(agent.agent.id)}>
                <Maximize2 size={15} aria-hidden="true" />
              </button>
            </div>
            <p className="agent-deck-role">{agent.persona.role}. <em>{agent.persona.tagline}</em></p>
            <div className="agent-deck-badges">
              <span className="agent-deck-badge">{agent.agent.provider} / {agent.agent.model}</span>
              <span className="agent-deck-badge">{agent.agent.reasoningEffort ?? "default effort"}</span>
              <span className="agent-deck-badge agent-deck-status">{agent.statusText}</span>
            </div>
            {testResults[agent.agent.id] ? <p className="agent-deck-test status-text">{testResults[agent.agent.id]}</p> : null}
            <div className="agent-deck-actions">
              <button className="action-button primary-action" type="button" onClick={() => setModalAgentId(agent.agent.id)}>
                <MessageSquare size={15} aria-hidden="true" />
                Chat
              </button>
              <button className="action-button" type="button" disabled={busyAgentId === agent.agent.id} onClick={() => void testApi(agent)}>
                <Plug size={15} aria-hidden="true" />
                Test API
              </button>
            </div>
          </article>
        ))}
        {props.presentations.length === 0 ? <p className="status-text">No agents configured yet.</p> : null}
      </div>

      {modalPresentation ? (
        <AgentModal
          key={modalPresentation.agent.id}
          presentation={modalPresentation}
          providers={props.providers}
          memory={props.memory}
          events={props.events}
          onClose={() => setModalAgentId(null)}
          onRefresh={props.onRefresh}
        />
      ) : null}
    </section>
  );
}

function AgentModal(props: {
  readonly presentation: AgentPresentation;
  readonly providers: readonly ProviderInfo[];
  readonly memory: readonly AgentMemoryRecord[];
  readonly events: readonly AgentRuntimeEvent[];
  readonly onClose: () => void;
  readonly onRefresh: () => void;
}) {
  const { invoke } = useReacherClient();
  const agent = props.presentation.agent;
  const provider = props.providers.find((item) => item.id === agent.provider) ?? null;
  const supportedEfforts = provider?.supportedEfforts ?? [];
  const [question, setQuestion] = useState("");
  const [chatStatus, setChatStatus] = useState("Ask a question to run this agent.");
  const [running, setRunning] = useState(false);

  const steps = useMemo(() => deriveSteps(props.events, agent.id), [props.events, agent.id]);
  const agentMemory = useMemo(() => {
    const own = props.memory.filter((item) => item.sourceAgent === agent.id);
    // Fall back to the shared store when this agent has not authored anything yet.
    return (own.length > 0 ? own : props.memory).slice(0, 10);
  }, [props.memory, agent.id]);

  async function setModel(model: string): Promise<void> {
    const result = await invoke("agents:setModel", { agentId: agent.id, provider: agent.provider, model });
    setChatStatus(result.ok ? `Model set to ${model}` : result.error.message);
    props.onRefresh();
  }

  async function setEffort(effort: ReasoningEffort | null): Promise<void> {
    const result = await invoke("agents:setEffort", { agentId: agent.id, reasoningEffort: effort });
    setChatStatus(result.ok ? `Effort: ${effort ?? "provider default"}` : result.error.message);
    props.onRefresh();
  }

  async function ask(): Promise<void> {
    if (!question.trim()) {
      setChatStatus("Type something for the agent to investigate.");
      return;
    }
    setRunning(true);
    setChatStatus(`${agent.name} is working…`);
    const result = await invoke("agent:run", { agentId: agent.id, seed: inferQuestionSeed(question) });
    setChatStatus(result.ok ? `${agent.name} finished — see the chain of thought below.` : result.error.message);
    setRunning(false);
    props.onRefresh();
  }

  return (
    <div className="agent-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${agent.name} panel`} onClick={props.onClose}>
      <div className="agent-modal" onClick={(event) => event.stopPropagation()}>
        <header className="agent-modal-header">
          <span className="agent-deck-avatar">
            <ProviderLogo provider={agent.provider} size={24} />
          </span>
          <div className="agent-modal-id">
            <strong>{agent.name}</strong>
            <span className="status-text">{props.presentation.persona.callsign} · {agent.provider} / {agent.model}</span>
          </div>
          <span className={`status-dot ${dotClass(props.presentation)}`} aria-hidden="true" />
          <button className="icon-button" type="button" aria-label="Close" title="Close" onClick={props.onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <p className="agent-modal-tagline">{props.presentation.persona.role}. <em>{props.presentation.persona.tagline}</em></p>

        <div className="agent-modal-controls">
          <label className="compact-field">
            Model
            <select className="field-control" value={agent.model} onChange={(event) => void setModel(event.currentTarget.value)}>
              {(provider?.availableModels ?? [agent.model]).map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
          <label className="compact-field">
            Effort
            <select
              className="field-control"
              aria-label="Reasoning effort"
              value={agent.reasoningEffort ?? ""}
              disabled={supportedEfforts.length === 0}
              onChange={(event) => void setEffort(event.currentTarget.value ? (event.currentTarget.value as ReasoningEffort) : null)}
            >
              <option value="">{supportedEfforts.length === 0 ? "not supported" : "provider default"}</option>
              {supportedEfforts.map((effort) => (
                <option key={effort} value={effort}>{effort}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="agent-modal-chat">
          <label className="compact-field">
            Ask {agent.name}
            <textarea
              className="agent-brief-input agent-modal-input"
              value={question}
              placeholder="e.g. Build an OSINT profile for jdoe and summarize useful pivots"
              onChange={(event) => setQuestion(event.currentTarget.value)}
            />
          </label>
          <div className="action-row">
            <button className="action-button primary-action" type="button" disabled={running || !question.trim()} onClick={() => void ask()}>
              {running ? <Play size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              Send
            </button>
            <span className="status-text">{chatStatus}</span>
          </div>
        </div>

        <ChainOfThought steps={steps} />

        <div className="agent-modal-columns">
          <section className="agent-modal-section" aria-label="Saved memory">
            <h3 className="agents-subtitle">Saved memory</h3>
            <div className="agent-memory-grid">
              {agentMemory.map((item) => (
                <div className="agent-memory-card" key={item.id}>
                  <span className="mono-cell">{item.key}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              {agentMemory.length === 0 ? <p className="status-text">No shared memory yet.</p> : null}
            </div>
          </section>
          <section className="agent-modal-section" aria-label="Prompt">
            <h3 className="agents-subtitle">Prompt it runs on</h3>
            <code className="agent-modal-prompt-path">{agent.promptPath}</code>
            <p className="status-text">{props.presentation.persona.role}. Approval: {agent.approvalMode}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function dotClass(presentation: AgentPresentation): string {
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

/** Reduce the streamed step events for one agent into a de-duplicated timeline. */
function deriveSteps(events: readonly AgentRuntimeEvent[], agentId: string): ThoughtStep[] {
  const bySequence = new Map<number, ThoughtStep>();
  // Events arrive newest-first; iterate reversed so later status wins per sequence.
  for (const event of [...events].reverse()) {
    if (event.type !== "agent:step" || event.step.agentId !== agentId) {
      continue;
    }
    const step = event.step;
    bySequence.set(step.sequence, {
      id: `${step.runId}-${step.sequence}`,
      title: step.title,
      status: step.status,
      summary: step.summary,
      sources: step.sources
    });
  }
  return [...bySequence.entries()].sort((a, b) => a[0] - b[0]).map(([, step]) => step);
}

function inferQuestionSeed(text: string): { readonly type: SeedType; readonly value: string } {
  const token = text.trim().split(/\s+/).find((word) => word.length > 2) ?? text.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) {
    return { type: "email", value: token };
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(token)) {
    return { type: "ip", value: token };
  }
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(token)) {
    return { type: "domain", value: token };
  }
  return /\s/.test(text.trim()) ? { type: "name", value: text.trim() } : { type: "username", value: token };
}
