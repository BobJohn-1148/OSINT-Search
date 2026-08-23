/**
 * Tools is a catalog gallery over main-process launch policy. The renderer
 * selects catalog entries and targets, while WSL execution and run persistence
 * stay behind typed IPC.
 */
import { ClipboardCopy, ExternalLink, Loader2, Minus, Play, Plus, RefreshCw, Save, Search, Square, TerminalSquare, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { ToolCatalogRecord, ToolOutputEvent, ToolRunRecord } from "../../shared/schemas/tools";
import type { ToolCategory, ToolTier } from "../../shared/types/tools";
import { toolCategoryValues } from "../../shared/types/tools";
import { useReacherClient } from "../hooks/use-reacher-client";

const categoryOptions: readonly ("all" | ToolCategory)[] = ["all", ...toolCategoryValues];
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
  const [searchParams] = useSearchParams();
  const [tools, setTools] = useState<ToolCatalogRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [selectedToolId, setSelectedToolId] = useState("");
  const [target, setTarget] = useState("example.com");
  const [wslDistro, setWslDistro] = useState("Ubuntu");
  const [caseId, setCaseId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ToolCategory>("all");
  const [lastRun, setLastRun] = useState<ToolRunRecord | null>(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Loading catalog");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft);
  const [runningToolId, setRunningToolId] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockMinimized, setDockMinimized] = useState(false);

  const requestedToolId = searchParams.get("tool") ?? "";

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const [toolsResult, casesResult] = await Promise.all([
      invoke("tools:list", {}),
      invoke("cases:list", {})
    ]);
    if (toolsResult.ok) {
      setTools(toolsResult.value.tools);
      setSelectedToolId((current) => current || requestedToolId || toolsResult.value.tools[0]?.id || "");
    } else {
      setStatus(toolsResult.error.message);
    }
    if (casesResult.ok) {
      setCases(casesResult.value.cases);
      setCaseId((current) => current || casesResult.value.cases[0]?.id || "");
    }
    setStatus(toolsResult.ok && casesResult.ok ? "Catalog ready" : "Catalog loaded with warnings");
    setLoading(false);
  }, [invoke, requestedToolId]);

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

  const filteredTools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory = category === "all" || tool.category === category;
      const haystack = `${tool.name} ${displayToolDescription(tool.description)} ${tool.defaultArgs.join(" ")} ${tool.category}`.toLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [category, query, tools]);

  // Group the filtered catalog into MITRE-style category columns, ordered by the
  // canonical category list so the board reads the same every render.
  const toolColumns = useMemo(() => {
    const groups = new Map<ToolCategory, ToolCatalogRecord[]>();
    for (const tool of filteredTools) {
      const list = groups.get(tool.category) ?? [];
      list.push(tool);
      groups.set(tool.category, list);
    }
    return toolCategoryValues
      .map((cat) => ({ category: cat, tools: groups.get(cat) ?? [] }))
      .filter((group) => group.tools.length > 0);
  }, [filteredTools]);

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
    setStatus(`Running ${selectedTool.name}`);
    setRunningToolId(selectedTool.id);
    setDockOpen(true);
    setDockMinimized(false);
    if (selectedTool.tier === "active") {
      const expiresTs = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const approval = await invoke("auth:create", { target, tier: "active", expiresTs });
      if (!approval.ok) {
        setStatus(approval.error.message);
        setRunningToolId(null);
        return;
      }
    }
    const result = await invoke("tools:launch", {
      toolId: selectedTool.id,
      target,
      caseId: caseId || undefined,
      wslDistro
    });
    setRunningToolId(null);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setLastRun(result.value.run);
    setOutput(result.value.run.stdout || result.value.run.stderr);
    setStatus(`Run ${result.value.run.status}`);
  }

  async function copyInstall(command: string) {
    await navigator.clipboard.writeText(command);
    setStatus("Install command copied");
  }

  function selectTool(tool: ToolCatalogRecord) {
    setSelectedToolId(tool.id);
    setDraft(toDraft(tool));
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
    await refreshAll();
    setSelectedToolId(result.value.tool.id);
    setDraft(toDraft(result.value.tool));
    setStatus(draft.id ? "Catalog entry updated" : "Catalog entry added");
  }

  return (
    <section className="route-surface tools-surface">
      <header className="route-header route-header-wide">
        <h1 className="route-title">Tools</h1>
        <p className="route-summary">Browse, filter, launch, and maintain the local WSL OSINT tool catalog.</p>
      </header>

      <div className="tools-topbar console-panel">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools, commands, categories" />
        </label>
        <label className="compact-field compact-inline">
          Category
          <select className="field-control" value={category} onChange={(event) => setCategory(event.target.value as "all" | ToolCategory)}>
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-field compact-inline">
          WSL
          <input className="field-control" value={wslDistro} onChange={(event) => setWslDistro(event.target.value)} />
        </label>
        <button className="action-button" type="button" onClick={() => void detectTools()}>
          <RefreshCw size={16} aria-hidden="true" />
          Detect
        </button>
      </div>

      <div className="tools-gallery-layout">
        <section className="console-panel tools-gallery-panel" aria-labelledby="tool-gallery-title">
          <div className="section-title-row section-title-row-wide">
            <h2 className="section-title" id="tool-gallery-title">Tool catalog</h2>
            <span className="status-text">{filteredTools.length} tools · {toolColumns.length} categories</span>
          </div>
          <div className="tools-mitre-board" aria-label="Tool categories">
            {toolColumns.map((group) => (
              <div className="mitre-column" key={group.category}>
                <div className="mitre-column-head">
                  <span>{prettyCategory(group.category)}</span>
                  <span className="mitre-column-count">{group.tools.length}</span>
                </div>
                <div className="mitre-column-cards">
                  {group.tools.map((tool) => (
                    <button
                      className={selectedTool?.id === tool.id ? "mitre-tool is-selected" : "mitre-tool"}
                      type="button"
                      key={tool.id}
                      onClick={() => selectTool(tool)}
                      title={displayToolDescription(tool.description)}
                    >
                      <span className={`mitre-tool-dot mitre-tier-${tool.tier}`} aria-hidden="true" />
                      <span className="mitre-tool-body">
                        <strong>{tool.name}</strong>
                        <span>{tool.id}</span>
                      </span>
                      {runningToolId === tool.id ? <Loader2 className="mitre-tool-spinner" size={14} aria-hidden="true" /> : null}
                      {installed[tool.id] ? <span className="mitre-tool-installed" title="Detected on this WSL distro" aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!loading && toolColumns.length === 0 ? <p className="status-text">No tools match this filter.</p> : null}
          </div>
        </section>

        <aside className="tools-showcase-stack">
          <section className="console-panel tool-showcase-panel" aria-labelledby="tool-showcase-title">
            <div className="tool-showcase-heading">
              <div>
                <span className="tool-card-kicker">{selectedTool?.category ?? "catalog"} / {selectedTool?.tier ?? "passive"}</span>
                <h2 className="section-title" id="tool-showcase-title">{selectedTool?.name ?? "Select a tool"}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Copy install" title="Copy install" disabled={!selectedTool} onClick={() => selectedTool ? void copyInstall(selectedTool.installCommand) : undefined}>
                <ClipboardCopy size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="route-summary">{selectedTool ? displayToolDescription(selectedTool.description) : "Pick a catalog card to inspect launch and install details."}</p>
            <div className="tool-showcase-details">
              <span>{selectedTool && installed[selectedTool.id] ? "installed" : "not detected"}</span>
              <span>{selectedTool?.officialLink ? "official source linked" : "no link"}</span>
              <span>{selectedTool ? displayArgs(selectedTool) : "no argv prefix"}</span>
            </div>
            <div className="tools-command-grid">
              <label className="compact-field">
                Target
                <input className="field-control" value={target} onChange={(event) => setTarget(event.target.value)} />
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
            <div className="action-row">
              <button className="action-button primary-action" type="button" disabled={!selectedTool} onClick={() => void launchTool()}>
                <Play size={16} aria-hidden="true" />
                Launch tool
              </button>
              <button className="action-button" type="button" disabled={!selectedTool?.officialLink} onClick={() => selectedTool ? void copyInstall(selectedTool.officialLink) : undefined}>
                <ExternalLink size={16} aria-hidden="true" />
                Copy link
              </button>
            </div>
          </section>

          <section className="console-panel tools-edit-panel">
            <div className="tool-showcase-heading">
              <div>
                <span className="tool-card-kicker">Catalog showcase</span>
                <h2 className="section-title">{draft.id ? "Edit selected entry" : "Add catalog entry"}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="New catalog entry" title="New catalog entry" onClick={() => setDraft(emptyDraft)}>
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="catalog-showcase-grid">
              <CatalogField label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
              <CatalogField label="Description" value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} />
              <CatalogField label="Install" value={draft.installCommand} onChange={(value) => setDraft((current) => ({ ...current, installCommand: value }))} />
              <CatalogField label="Link" value={draft.officialLink} onChange={(value) => setDraft((current) => ({ ...current, officialLink: value }))} />
              <CatalogField label="Argv prefix" value={draft.defaultArgsText} onChange={(value) => setDraft((current) => ({ ...current, defaultArgsText: value }))} />
              <div className="tools-edit-row">
                <label className="compact-field">
                  Category
                  <select className="field-control" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as ToolCategory }))}>
                    {toolCategoryValues.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="compact-field">
                  Tier
                  <select className="field-control" value={draft.tier} onChange={(event) => setDraft((current) => ({ ...current, tier: event.target.value as ToolTier }))}>
                    {tierOptions.map((tier) => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <button className="action-button primary-action" type="button" onClick={() => void saveDraft()}>
              <Save size={16} aria-hidden="true" />
              {draft.id ? "Save catalog entry" : "Add catalog entry"}
            </button>
          </section>
        </aside>
      </div>

      {dockOpen ? (
        <div className={dockMinimized ? "tools-dock is-minimized" : "tools-dock"}>
          <div className="tools-dock-bar">
            <span className="tools-dock-title">
              {runningToolId ? <Loader2 className="mitre-tool-spinner" size={14} aria-hidden="true" /> : <TerminalSquare size={14} aria-hidden="true" />}
              Running tool output: {lastRun ? toolNameById(tools, lastRun.toolId) : selectedTool?.name ?? "tool"}
            </span>
            <span className="tools-dock-controls">
              <button className="tools-dock-btn" type="button" aria-label="Minimize output" title="Minimize" onClick={() => setDockMinimized(true)}>
                <Minus size={13} aria-hidden="true" />
              </button>
              <button className="tools-dock-btn" type="button" aria-label="Expand output" title="Expand" onClick={() => setDockMinimized(false)}>
                <Square size={12} aria-hidden="true" />
              </button>
              <button className="tools-dock-btn tools-dock-close" type="button" aria-label="Close output" title="Close" onClick={() => setDockOpen(false)}>
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          </div>
          {dockMinimized ? null : (
            <>
              <pre className="tools-output terminal-output tools-dock-output">{output || "$ Awaiting tool output…"}</pre>
              {lastRun ? <p className="tools-dock-meta status-text">run:{lastRun.id} · status:{lastRun.status} · target:{lastRun.target}</p> : null}
            </>
          )}
        </div>
      ) : null}

      {loading ? <div className="route-loading" role="status">Loading tool gallery</div> : null}
      <span className="status-text" role="status">{status}</span>
    </section>
  );
}

/** Human-friendly MITRE-style category label from the catalog category slug. */
function prettyCategory(category: string): string {
  const labels: Record<string, string> = {
    recon: "Reconnaissance",
    username: "Username",
    email: "Email",
    phone: "Phone",
    crawler: "Crawler",
    network: "Network",
    packet: "Packet",
    framework: "Framework",
    web: "Web",
    exploitation: "Execution",
    cracking: "Credential access",
    forensics: "Forensics",
    "reverse-engineering": "Reverse engineering",
    privilege: "Privilege escalation",
    cloud: "Cloud",
    wireless: "Wireless",
    lab: "Lab",
    mobile: "Mobile",
    social: "Social"
  };
  return labels[category] ?? category;
}

function toolNameById(tools: readonly ToolCatalogRecord[], toolId: string): string {
  return tools.find((tool) => tool.id === toolId)?.name ?? toolId;
}

function CatalogField(props: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <label className="compact-field">
      {props.label}
      <input className="field-control" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function toDraft(tool: ToolCatalogRecord): CatalogDraft {
  return {
    id: tool.id,
    name: tool.name,
    description: displayToolDescription(tool.description),
    installCommand: tool.installCommand,
    officialLink: tool.officialLink,
    category: tool.category,
    tier: tool.tier,
    defaultArgsText: tool.defaultArgs.join(" ")
  };
}

function displayArgs(tool: ToolCatalogRecord): string {
  return tool.defaultArgs.length > 0 ? tool.defaultArgs.join(" ") : "no argv prefix";
}

function displayToolDescription(description: string): string {
  return description
    .replace(/\bexplicitly authori[sz]ed\b/gi, "scoped")
    .replace(/\bauthori[sz]ed\b/gi, "scoped")
    .replace(/\bauthori[sz]ation\b/gi, "target review");
}
