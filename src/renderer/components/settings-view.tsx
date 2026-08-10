/**
 * Settings owns Phase 1 key and provider controls because credential state must
 * be visible without exposing secrets. If key management lived in separate route
 * stubs, Jack could store a key but not see which provider or agent depends on it.
 */
import { CheckCircle2, PlugZap, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentRecord } from "../../shared/schemas/agents";
import type { KeyMetadata } from "../../shared/schemas/keys";
import type { ProviderInfo } from "../../shared/schemas/providers";
import { keySourceValues, type KeySource } from "../../shared/types/sources";
import { useReacherClient } from "../hooks/use-reacher-client";

const defaultSource: KeySource = "openai";

export function SettingsView() {
  const { invoke } = useReacherClient();
  const [keys, setKeys] = useState<KeyMetadata[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [source, setSource] = useState<KeySource>(defaultSource);
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("Ready");
  const keyedSources = useMemo(() => new Set(keys.map((key) => key.source)), [keys]);

  const refresh = useCallback(async (): Promise<void> => {
    const [keyResult, providerResult, agentResult] = await Promise.all([
      invoke("keys:list", {}),
      invoke("providers:list", {}),
      invoke("agents:list", {})
    ]);

    if (keyResult.ok) {
      setKeys(keyResult.value.keys);
    }
    if (providerResult.ok) {
      setProviders(providerResult.value.providers);
    }
    if (agentResult.ok) {
      setAgents(agentResult.value.agents);
    }

    const error = [keyResult, providerResult, agentResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Settings loaded");
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function addKey(): Promise<void> {
    const result = await invoke("keys:add", { source, secret });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }

    setSecret("");
    setStatus(`${source} key stored`);
    await refresh();
  }

  async function testKey(keySource: KeySource): Promise<void> {
    const result = await invoke("keys:test", { source: keySource });
    setStatus(result.ok ? result.value.message : result.error.message);
    await refresh();
  }

  async function revokeKey(keySource: KeySource): Promise<void> {
    const result = await invoke("keys:revoke", { source: keySource });
    setStatus(result.ok && result.value.revoked ? `${keySource} key revoked` : "No key was revoked");
    await refresh();
  }

  async function testProvider(provider: ProviderInfo): Promise<void> {
    const result = await invoke("providers:test", { provider: provider.id });
    setStatus(result.ok ? result.value.message : result.error.message);
    await refresh();
  }

  async function selectAgentModel(agent: AgentRecord, provider: ProviderInfo, model: string): Promise<void> {
    const result = await invoke("agents:setModel", {
      agentId: agent.id,
      provider: provider.id,
      model
    });
    setStatus(result.ok ? `${agent.name} set to ${provider.label} ${model}` : result.error.message);
    await refresh();
  }

  return (
    <section className="route-surface" aria-labelledby="settings-title">
      <header className="route-header">
        <h1 className="route-title" id="settings-title">
          Settings
        </h1>
        <p className="route-summary">Manage local API keys, provider checks, and per-agent model selection.</p>
      </header>

      <div className="settings-grid">
        <section className="console-panel settings-section" aria-labelledby="api-keys-title">
          <div className="section-title-row">
            <h2 className="section-title" id="api-keys-title">
              API keys
            </h2>
            <button className="icon-button" type="button" aria-label="Refresh settings" title="Refresh settings" onClick={() => void refresh()}>
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="field-grid">
            <label className="field-label">
              Source
              <select className="field-control" value={source} onChange={(event) => setSource(event.target.value as KeySource)}>
                {keySourceValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Secret
              <input
                className="field-control"
                value={secret}
                type="password"
                autoComplete="off"
                onChange={(event) => setSecret(event.target.value)}
              />
            </label>
            <button className="action-button" type="button" disabled={!secret} onClick={() => void addKey()}>
              <Save size={16} aria-hidden="true" />
              Store key
            </button>
          </div>
          <div className="table-list" role="list" aria-label="Stored API keys">
            {keys.map((key) => (
              <div className="table-row" role="listitem" key={key.source}>
                <span className="mono-cell">{key.source}</span>
                <span>{key.lastUsedTs ? "Used" : "Stored"}</span>
                <button className="icon-button" type="button" aria-label={`Test ${key.source}`} title={`Test ${key.source}`} onClick={() => void testKey(key.source)}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                </button>
                <button className="icon-button" type="button" aria-label={`Revoke ${key.source}`} title={`Revoke ${key.source}`} onClick={() => void revokeKey(key.source)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="console-panel settings-section" aria-labelledby="providers-title">
          <h2 className="section-title" id="providers-title">
            Providers
          </h2>
          <div className="table-list" role="list" aria-label="Providers">
            {providers.map((provider) => (
              <div className="provider-row" role="listitem" key={provider.id}>
                <div>
                  <div className="provider-name">{provider.label}</div>
                  <div className="status-text">
                    {provider.requiresKey
                      ? keyedSources.has(provider.keySource as KeySource)
                        ? "Key stored"
                        : "Key required"
                      : "Local provider"}
                  </div>
                </div>
                <button className="action-button" type="button" onClick={() => void testProvider(provider)}>
                  <PlugZap size={16} aria-hidden="true" />
                  Test
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="console-panel settings-section" aria-labelledby="agents-title">
        <h2 className="section-title" id="agents-title">
          Agents
        </h2>
        <div className="agent-grid">
          {agents.map((agent) => {
            const provider = providers.find((candidate) => candidate.id === agent.provider) ?? providers[0];
            return (
              <div className="agent-row" key={agent.id}>
                <div>
                  <div className="provider-name">{agent.name}</div>
                  <div className="status-text">{agent.promptPath}</div>
                </div>
                <label className="compact-field">
                  Provider
                  <select
                    className="field-control"
                    value={agent.provider}
                    onChange={(event) => {
                      const nextProvider = providers.find((candidate) => candidate.id === event.target.value);
                      if (nextProvider) {
                        void selectAgentModel(agent, nextProvider, nextProvider.defaultModel);
                      }
                    }}
                  >
                    {providers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="compact-field">
                  Model
                  <select
                    className="field-control"
                    value={agent.model}
                    onChange={(event) => void selectAgentModel(agent, provider, event.target.value)}
                  >
                    {provider.availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      </section>
      <span className="status-text" role="status">
        {status}
      </span>
    </section>
  );
}
