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
import { DEFAULT_WSL_DISTRO, WSL_DISTRO_SETTING_KEY } from "../../shared/types/tools";
import { useReacherClient } from "../hooks/use-reacher-client";

const defaultSource: KeySource = "openai";
const cleanIdleSettingKey = "agents.cleanIdleStatuses";
const wslDistroSettingKey = WSL_DISTRO_SETTING_KEY;
const sharedMemoryScopeSettingKey = "agents.sharedMemoryScope";

export function SettingsView() {
  const { invoke } = useReacherClient();
  const [keys, setKeys] = useState<KeyMetadata[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [source, setSource] = useState<KeySource>(defaultSource);
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("Ready");
  const [cleanIdleStatuses, setCleanIdleStatuses] = useState(false);
  const [wslDistro, setWslDistro] = useState(DEFAULT_WSL_DISTRO);
  const [sharedMemoryScope, setSharedMemoryScope] = useState("default");
  const [loadingLabel, setLoadingLabel] = useState("Loading settings");
  // Connection light per source/provider id: "ok" green, "error" amber, else red
  // (required + no key) or grey (stored, untested).
  const [diagnostics, setDiagnostics] = useState<Record<string, "ok" | "error">>({});
  const keyedSources = useMemo(() => new Set(keys.map((key) => key.source)), [keys]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoadingLabel("Loading settings");
    const [keyResult, providerResult, agentResult, cleanResult, wslResult, memoryScopeResult] = await Promise.all([
      invoke("keys:list", {}),
      invoke("providers:list", {}),
      invoke("agents:list", {}),
      invoke("settings:get", { key: cleanIdleSettingKey }),
      invoke("settings:get", { key: wslDistroSettingKey }),
      invoke("settings:get", { key: sharedMemoryScopeSettingKey })
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
    if (cleanResult.ok) {
      setCleanIdleStatuses(cleanResult.value.value === "true");
    }
    if (wslResult.ok && wslResult.value.value) {
      setWslDistro(wslResult.value.value);
    }
    if (memoryScopeResult.ok && memoryScopeResult.value.value) {
      setSharedMemoryScope(memoryScopeResult.value.value);
    }

    const error = [keyResult, providerResult, agentResult, cleanResult, wslResult, memoryScopeResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Settings loaded");
    setLoadingLabel("");
  }, [invoke]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  async function addKey(): Promise<void> {
    setLoadingLabel(`Storing ${source} key`);
    const result = await invoke("keys:add", { source, secret });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }

    setSecret("");
    setStatus(`${source} key stored`);
    await refresh();
  }

  async function testKey(keySource: KeySource): Promise<void> {
    setLoadingLabel(`Testing ${keySource}`);
    const result = await invoke("keys:test", { source: keySource });
    setDiagnostics((current) => ({ ...current, [keySource]: result.ok && result.value.ok ? "ok" : "error" }));
    setStatus(result.ok ? result.value.message : result.error.message);
    await refresh();
  }

  async function revokeKey(keySource: KeySource): Promise<void> {
    setLoadingLabel(`Revoking ${keySource}`);
    const result = await invoke("keys:revoke", { source: keySource });
    setStatus(result.ok && result.value.revoked ? `${keySource} key revoked` : "No key was revoked");
    await refresh();
  }

  async function testProvider(provider: ProviderInfo): Promise<void> {
    setLoadingLabel(`Testing ${provider.label}`);
    const result = await invoke("providers:test", { provider: provider.id });
    setDiagnostics((current) => ({ ...current, [provider.id]: result.ok && result.value.ok ? "ok" : "error" }));
    setStatus(result.ok ? result.value.message : result.error.message);
    await refresh();
  }

  // Resolve the traffic-light state: an explicit test result wins; otherwise a
  // required-but-unstored key is red (not connected), a stored key is grey
  // (untested), and a keyless local provider is green (always reachable).
  function lightClass(id: string, connectable: boolean): string {
    const tested = id in diagnostics ? diagnostics[id] : undefined;
    if (tested === "ok") {
      return "status-dot-verified";
    }
    if (tested === "error") {
      return "status-dot-candidate";
    }
    if (!connectable) {
      return "status-dot-error";
    }
    return "status-dot-untested";
  }

  async function selectAgentModel(agent: AgentRecord, provider: ProviderInfo, model: string): Promise<void> {
    setLoadingLabel(`Updating ${agent.name}`);
    const result = await invoke("agents:setModel", {
      agentId: agent.id,
      provider: provider.id,
      model
    });
    setStatus(result.ok ? `${agent.name} set to ${provider.label} ${model}` : result.error.message);
    await refresh();
  }

  async function setCleanIdle(next: boolean): Promise<void> {
    setLoadingLabel("Saving agent display setting");
    setCleanIdleStatuses(next);
    const result = await invoke("settings:set", { key: cleanIdleSettingKey, value: String(next) });
    setStatus(result.ok ? "Settings saved" : result.error.message);
    setLoadingLabel("");
  }

  async function saveRuntimeSettings(): Promise<void> {
    setLoadingLabel("Saving runtime settings");
    const [wslResult, memoryScopeResult] = await Promise.all([
      invoke("settings:set", { key: wslDistroSettingKey, value: wslDistro.trim() || DEFAULT_WSL_DISTRO }),
      invoke("settings:set", { key: sharedMemoryScopeSettingKey, value: sharedMemoryScope.trim() || "default" })
    ]);
    const error = [wslResult, memoryScopeResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Runtime settings saved");
    setLoadingLabel("");
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
              <div className="table-row settings-diag-row" role="listitem" key={key.source}>
                <span className="mono-cell">
                  <span className={`status-dot ${lightClass(key.source, true)}`} aria-hidden="true" /> {key.source}
                </span>
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
                <div className="provider-name-row">
                  <span
                    className={`status-dot ${lightClass(provider.id, !provider.requiresKey || keyedSources.has(provider.keySource as KeySource))}`}
                    aria-hidden="true"
                  />
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
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={cleanIdleStatuses}
            onChange={(event) => void setCleanIdle(event.currentTarget.checked)}
          />
          Clean idle statuses
        </label>
        <div className="agent-grid">
          {agents.map((agent) => {
            const provider = providers.find((candidate) => candidate.id === agent.provider) ?? providers[0];
            return (
              <div className="agent-row" key={agent.id}>
                <div className="provider-name-row">
                  <span
                    className={`status-dot ${lightClass(provider.id, !provider.requiresKey || keyedSources.has(provider.keySource as KeySource))}`}
                    aria-hidden="true"
                    title={provider.requiresKey ? (keyedSources.has(provider.keySource as KeySource) ? "Key stored" : "Blocked: no key stored for this provider") : "Local provider, no key needed"}
                  />
                  <div>
                    <div className="provider-name">{agent.name}</div>
                    <div className="status-text">{agent.promptPath}</div>
                  </div>
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
      <section className="console-panel settings-section" aria-labelledby="runtime-title">
        <h2 className="section-title" id="runtime-title">
          Local runtime
        </h2>
        <div className="field-grid">
          <label className="field-label">
            WSL distro
            <input className="field-control" value={wslDistro} onChange={(event) => setWslDistro(event.target.value)} />
          </label>
          <label className="field-label">
            Shared memory scope
            <input
              className="field-control"
              value={sharedMemoryScope}
              onChange={(event) => setSharedMemoryScope(event.target.value)}
            />
          </label>
          <button className="action-button" type="button" onClick={() => void saveRuntimeSettings()}>
            <Save size={16} aria-hidden="true" />
            Save runtime
          </button>
        </div>
      </section>
      <span className="status-text" role="status">
        {status}
      </span>
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}
