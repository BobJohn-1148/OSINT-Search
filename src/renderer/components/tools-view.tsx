/**
 * The Tools view is a control surface over main-process launch policy, not a
 * terminal emulator. If it assembled commands locally, active authorization and
 * fixed argv launches would depend on renderer trust instead of audited IPC.
 */
import { Plus, RefreshCw, Save, ShieldCheck, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { AuthorizationRecord, ToolCatalogRecord, ToolOutputEvent, ToolRunRecord } from "../../shared/schemas/tools";
import type { ToolCategory, ToolTier } from "../../shared/types/tools";
import { useReacherClient } from "../hooks/use-reacher-client";

const categoryOptions: readonly ToolCategory[] = ["recon", "username", "email", "phone", "crawler", "network", "packet", "framework"];
const tierOptions: readonly ToolTier[] = ["passive", "active"];

interface CatalogDraft {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly installCommand: string;
  readonly officialLink: string;
  readonly category: ToolCategory;
  readonly tier: ToolTier;
  readonly defaultArgsText: string;
}

const emptyDraft: CatalogDraft = {
  id: "",
  name: "",
  description: "",
  installCommand: "",
  officialLink: "",
  category: "recon",
  tier: "passive",
  defaultArgsText: ""
};

export function ToolsView() {
  const { invoke } = useReacherClient();
  const [tools, setTools] = useState<ToolCatalogRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthorizationRecord[]>([]);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [selectedToolId, setSelectedToolId] = useState("");
  const [target, setTarget] = useState("example.com");
  const [wslDistro, setWslDistro] = useState("Ubuntu");
  const [caseId, setCaseId] = useState("");
  const [lastRun, setLastRun] = useState<ToolRunRecord | null>(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Catalog ready");
  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft);

  const refreshAll = useCallback(async () => {
    const [toolsResult, casesResult, authResult] = await Promise.all([
      invoke("tools:list", {}),
      invoke("cases:list", {}),
      invoke("auth:list", {})
    ]);
    if (toolsResult.ok) {
      setTools(toolsResult.value.tools);
    }
    if (casesResult.ok) {
      setCases(casesResult.value.cases);
      const firstCaseId = casesResult.value.cases.length > 0 ? casesResult.value.cases[0].id : "";
      setCaseId((current) => current || firstCaseId);
    }
    if (authResult.ok) {
      setAuthorizations(authResult.value.authorizations);
    }
  }, [invoke]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void refreshAll();
    }, 0);
    const unsubscribe = window.reacher.onToolEvent("tools:output", (event: ToolOutputEvent) => {
      setOutput((current) => `${current}${event.chunk}`);
    });
    return () => {
      window.clearTimeout(loadTimer);
      unsubscribe();
    };
  }, [refreshAll]);

  const selectedTool = useMemo(() => {
    if (selectedToolId) {
      return tools.find((tool) => tool.id === selectedToolId) ?? null;
    }
    return tools.length > 0 ? tools[0] : null;
  }, [selectedToolId, tools]);

  async function detectTools() {
    setStatus("Detecting installed tools");
    const result = await invoke("tools:detect", { wslDistro });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setInstalled(Object.fromEntries(result.value.installed.map((item) => [item.toolId, item.installed])));
    setStatus("Detection complete");
  }

  async function launchTool() {
    if (!selectedTool) {
      return;
    }
    setOutput("");
    setStatus("Running tool");
    const result = await invoke("tools:launch", {
      toolId: selectedTool.id,
      target,
      caseId: caseId || undefined,
      wslDistro
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setLastRun(result.value.run);
    setOutput(result.value.run.stdout || result.value.run.stderr);
    setStatus(result.value.run.status === "blocked" ? "Launch blocked" : `Run ${result.value.run.status}`);
  }

  async function authorizeTarget() {
    const expiresTs = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const result = await invoke("auth:create", { target, tier: "active", expiresTs });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setAuthorizations((current) => [result.value.authorization, ...current]);
    setStatus("Authorization created");
  }

  async function copyInstall(command: string) {
    await navigator.clipboard.writeText(command);
    setStatus("Install command copied");
  }

  function editTool(tool: ToolCatalogRecord) {
    setDraft({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      installCommand: tool.installCommand,
      officialLink: tool.officialLink,
      category: tool.category,
      tier: tool.tier,
      defaultArgsText: tool.defaultArgs.join(" ")
    });
  }

  async function saveDraft() {
    const payload = {
      name: draft.name,
      description: draft.description,
      installCommand: draft.installCommand,
      officialLink: draft.officialLink,
      category: draft.category,
      tier: draft.tier,
      defaultArgs: draft.defaultArgsText.split(/\s+/).filter(Boolean)
    };
    const result = draft.id
      ? await invoke("catalog:update", { id: draft.id, ...payload })
      : await invoke("catalog:add", payload);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setDraft(emptyDraft);
    await refreshAll();
    setSelectedToolId(result.value.tool.id);
    setStatus(draft.id ? "Catalog entry updated" : "Catalog entry added");
  }

  return (
    <section className="route-surface">
      <header className="route-header">
        <h1 className="route-title">Tools</h1>
        <p className="route-summary">Launch WSL tools through fixed argv, capture output, and gate active targets.</p>
      </header>

      <div className="tools-layout">
        <section className="console-panel tools-command-panel">
          <div className="section-title-row">
            <h2 className="section-title">Launch</h2>
            <button className="icon-button" type="button" aria-label="Detect tools" onClick={() => void detectTools()}>
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="tools-command-grid">
            <label className="compact-field">
              Tool
              <select
                className="field-control"
                value={selectedTool ? selectedTool.id : ""}
                onChange={(event) => setSelectedToolId(event.target.value)}
              >
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              Target
              <input className="field-control" value={target} onChange={(event) => setTarget(event.target.value)} />
            </label>
            <label className="compact-field">
              WSL distro
              <input className="field-control" value={wslDistro} onChange={(event) => setWslDistro(event.target.value)} />
            </label>
            <label className="compact-field">
              Case
              <select className="field-control" value={caseId} onChange={(event) => setCaseId(event.target.value)}>
                <option value="">No case</option>
                {cases.map((caseRecord) => (
                  <option key={caseRecord.id} value={caseRecord.id}>
                    {caseRecord.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedTool ? (
            <div className="tools-selected-row">
              <div>
                <strong>{selectedTool.name}</strong>
                <p className="route-summary">{selectedTool.description}</p>
                <p className="status-text">
                  {selectedTool.tier} / {selectedTool.category} / {installed[selectedTool.id] ? "installed" : "not detected"}
                </p>
              </div>
              <button className="action-button" type="button" onClick={() => void launchTool()}>
                <TerminalSquare size={18} />
                Launch tool
              </button>
            </div>
          ) : null}
          <div className="action-row">
            <button className="action-button" type="button" onClick={() => void authorizeTarget()}>
              <ShieldCheck size={18} />
              Authorize target
            </button>
            <span className="status-text">{status}</span>
          </div>
        </section>

        <section className="console-panel tools-output-panel">
          <h2 className="section-title">Output</h2>
          <pre className="tools-output">{output || "No tool output captured yet."}</pre>
          {lastRun ? (
            <p className="status-text">
              run:{lastRun.id} status:{lastRun.status} target:{lastRun.target}
            </p>
          ) : null}
        </section>

        <section className="console-panel tools-catalog-panel">
          <h2 className="section-title">Catalog</h2>
          <div className="table-list">
            {tools.map((tool) => (
              <div key={tool.id} className="tool-list-row">
                <button className="tool-list-button" type="button" onClick={() => editTool(tool)}>
                  <strong>{tool.name}</strong>
                  <span>{tool.tier}</span>
                  <span className="status-text">{tool.defaultArgs.join(" ")}</span>
                  <span className="status-text">install:{tool.installCommand}</span>
                </button>
                <button className="action-button" type="button" onClick={() => void copyInstall(tool.installCommand)}>
                  Copy install
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="console-panel tools-edit-panel">
          <h2 className="section-title">{draft.id ? "Edit catalog entry" : "Add catalog entry"}</h2>
          <CatalogField label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <CatalogField
            label="Description"
            value={draft.description}
            onChange={(value) => setDraft((current) => ({ ...current, description: value }))}
          />
          <CatalogField
            label="Install"
            value={draft.installCommand}
            onChange={(value) => setDraft((current) => ({ ...current, installCommand: value }))}
          />
          <CatalogField
            label="Link"
            value={draft.officialLink}
            onChange={(value) => setDraft((current) => ({ ...current, officialLink: value }))}
          />
          <CatalogField
            label="Argv prefix"
            value={draft.defaultArgsText}
            onChange={(value) => setDraft((current) => ({ ...current, defaultArgsText: value }))}
          />
          <div className="tools-edit-row">
            <label className="compact-field">
              Category
              <select
                className="field-control"
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as ToolCategory }))}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              Tier
              <select
                className="field-control"
                value={draft.tier}
                onChange={(event) => setDraft((current) => ({ ...current, tier: event.target.value as ToolTier }))}
              >
                {tierOptions.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="action-button" type="button" onClick={() => void saveDraft()}>
            {draft.id ? <Save size={18} /> : <Plus size={18} />}
            {draft.id ? "Save catalog entry" : "Add catalog entry"}
          </button>
        </section>

        <section className="console-panel tools-auth-panel">
          <h2 className="section-title">Authorizations</h2>
          <div className="table-list">
            {authorizations.map((authorization) => (
              <div key={authorization.id} className="tool-auth-row">
                <strong>{authorization.target}</strong>
                <span>{authorization.tier}</span>
                <span className="status-text">expires:{authorization.expiresTs}</span>
              </div>
            ))}
            {authorizations.length === 0 ? <p className="status-text">No active target authorizations saved.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function CatalogField(props: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <label className="compact-field">
      {props.label}
      <input className="field-control" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
