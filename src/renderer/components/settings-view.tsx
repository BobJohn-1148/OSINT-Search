/**
 * Settings owns Phase 1 key and provider controls because credential state must
 * be visible without exposing secrets. If key management lived in separate route
 * stubs, Jack could store a key but not see which provider or agent depends on it.
 */
import { Activity, CheckCircle2, PlugZap, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentRecord } from "../../shared/schemas/agents";
import type { ApiDiagnosticResult } from "../../shared/schemas/api-diagnostics";
import type { KeyMetadata } from "../../shared/schemas/keys";
import type { ProviderInfo } from "../../shared/schemas/providers";
import { keySourceValues, type KeySource } from "../../shared/types/sources";
import { useReacherClient } from "../hooks/use-reacher-client";

const defaultSource: KeySource = "openai";
const cleanIdleSettingKey = "agents.cleanIdleStatuses";
const wslDistroSettingKey = "tools.wslDistro";
const sharedMemoryScopeSettingKey = "agents.sharedMemoryScope";

export function SettingsView() {
  const { invoke } = useReacherClient();
  const [keys, setKeys] = useState<KeyMetadata[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [source, setSource] = useState<KeySource>(defaultSource);
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("Ready");
  const [apiDiagnostics, setApiDiagnostics] = useState<ApiDiagnosticResult[]>([]);
  const [runningApis, setRunningApis] = useState<ReadonlySet<KeySource>>(new Set());
  const [cleanIdleStatuses, setCleanIdleStatuses] = useState(false);
  const [wslDistro, setWslDistro] = useState("Ubuntu");
  const [sharedMemoryScope, setSharedMemoryScope] = useState("default");
  const keyedSources = useMemo(() => new Set(keys.map((key) => key.source)), [keys]);
  const diagnosticStats = useMemo(() => summarizeDiagnostics(apiDiagnostics), [apiDiagnostics]);

  const refresh = useCallback(async (): Promise<void> => {
    const [keyResult, providerResult, agentResult, diagnosticsResult, cleanResult, wslResult, memoryScopeResult] = await Promise.all([
      invoke("keys:list", {}),
      invoke("providers:list", {}),
      invoke("agents:list", {}),
      invoke("apiDiagnostics:list", {}),
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
    if (diagnosticsResult.ok) {
      setApiDiagnostics(diagnosticsResult.value.apis);
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

    const error = [keyResult, providerResult, agentResult, diagnosticsResult, cleanResult, wslResult, memoryScopeResult].find((result) => !result.ok);
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

  async function testApi(sourceToTest: KeySource): Promise<void> {
    setRunningApis((current) => new Set(current).add(sourceToTest));
    const result = await invoke("apiDiagnostics:test", { sources: [sourceToTest] });
    setRunningApis((current) => withoutSource(current, sourceToTest));
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    mergeDiagnostics(result.value.results);
    setStatus(result.value.results[0]?.message ?? `${sourceToTest} diagnostic complete`);
    await refreshKeyMetadataOnly();
  }

  async function testAllApis(): Promise<void> {
    setRunningApis(new Set(keySourceValues));
    const result = await invoke("apiDiagnostics:test", {});
    setRunningApis(new Set());
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    mergeDiagnostics(result.value.results);
    const passed = result.value.results.filter((entry) => entry.status === "pass").length;
    setStatus(`API diagnostics complete: ${passed}/${result.value.results.length} passed`);
    await refreshKeyMetadataOnly();
  }

  async function refreshKeyMetadataOnly(): Promise<void> {
    const result = await invoke("keys:list", {});
    if (result.ok) {
      setKeys(result.value.keys);
    }
  }

  function mergeDiagnostics(results: readonly ApiDiagnosticResult[]): void {
    setApiDiagnostics((current) => {
      const bySource = new Map(current.map((entry) => [entry.source, entry]));
      for (const result of results) {
        bySource.set(result.source, result);
      }
      return [...bySource.values()].sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
    });
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

  async function setCleanIdle(next: boolean): Promise<void> {
    setCleanIdleStatuses(next);
    const result = await invoke("settings:set", { key: cleanIdleSettingKey, value: String(next) });
    setStatus(result.ok ? "Settings saved" : result.error.message);
  }

  async function saveRuntimeSettings(): Promise<void> {
    const [wslResult, memoryScopeResult] = await Promise.all([
      invoke("settings:set", { key: wslDistroSettingKey, value: wslDistro.trim() || "Ubuntu" }),
      invoke("settings:set", { key: sharedMemoryScopeSettingKey, value: sharedMemoryScope.trim() || "default" })
    ]);
    const error = [wslResult, memoryScopeResult].find((result) => !result.ok);
    setStatus(error?.ok === false ? error.error.message : "Runtime settings saved");
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

      <section className="console-panel settings-section" aria-labelledby="api-diagnostics-title">
        <div className="section-title-row">
          <div>
            <h2 className="section-title" id="api-diagnostics-title">
              API diagnostics
            </h2>
            <p className="status-text">
              {diagnosticStats.pass} passing / {diagnosticStats.fail} failing / {diagnosticStats.missing} missing keys
            </p>
          </div>
          <button className="action-button" type="button" onClick={() => void testAllApis()}>
            <Activity size={16} aria-hidden="true" />
            Test all APIs
          </button>
        </div>
        <div className="api-diagnostics-grid" role="list" aria-label="API diagnostics">
          {apiDiagnostics.map((api) => (
            <div className="api-diagnostic-row" role="listitem" key={api.source}>
              <div>
                <div className="provider-name">{api.label}</div>
                <div className="status-text">{api.category} / {api.probe} probe</div>
              </div>
              <span className={`api-status-badge api-status-${api.status}`}>{api.status}</span>
              <div className="api-diagnostic-message">
                <span>{api.message}</span>
                <small>{api.latencyMs === null ? "not run" : `${api.latencyMs} ms`}</small>
              </div>
              <button
                className="action-button"
                type="button"
                disabled={runningApis.has(api.source)}
                onClick={() => void testApi(api.source)}
              >
                <PlugZap size={16} aria-hidden="true" />
                {runningApis.has(api.source) ? "Testing" : "Test"}
              </button>
            </div>
          ))}
        </div>
      </section>

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
    </section>
  );
}

function summarizeDiagnostics(results: readonly ApiDiagnosticResult[]): { readonly pass: number; readonly fail: number; readonly missing: number } {
  return {
    pass: results.filter((entry) => entry.status === "pass").length,
    fail: results.filter((entry) => entry.status === "fail").length,
    missing: results.filter((entry) => entry.status === "not-configured").length
  };
}

function withoutSource(sources: ReadonlySet<KeySource>, source: KeySource): ReadonlySet<KeySource> {
  const next = new Set(sources);
  next.delete(source);
  return next;
}
