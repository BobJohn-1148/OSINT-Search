/**
 * Phase audit is a source-backed checklist so done means mechanisms and tests
 * exist together. If exit criteria lived only in prose, a green test suite could
 * still miss an implemented phase requirement.
 */
import fs from "node:fs";
import path from "node:path";

const MAX_PHASE = 15;
const requestedPhase = Number(process.argv[2]);
const repoRoot = process.cwd();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function walkFiles(dir, predicate = () => true) {
  const fullDir = path.join(repoRoot, dir);
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(fullDir, entry.name);
    const relative = path.relative(repoRoot, fullPath);
    if (entry.isDirectory()) {
      return walkFiles(relative, predicate);
    }
    return predicate(relative) ? [relative] : [];
  });
}

function assertIncludes(filePath, needle, label) {
  if (!read(filePath).includes(needle)) {
    fail(`${label} is missing in ${filePath}`);
  }
}

function assertAnyTestIncludes(needle, label) {
  const tests = walkFiles("tests", (filePath) => /\.test\.tsx?$/.test(filePath));
  const found = tests.some((filePath) => read(filePath).includes(needle));
  if (!found) {
    fail(`${label} test is missing: ${needle}`);
  }
}

if (!Number.isInteger(requestedPhase) || requestedPhase < 0 || requestedPhase > MAX_PHASE) {
  fail(`phase must be between 0 and ${MAX_PHASE}`);
} else if (requestedPhase === 0) {
  assertIncludes("src/renderer/navigation.ts", "navigationRoutes", "app boots and navigates all stub routes mechanism");
  assertAnyTestIncludes("renders every stub route", "app boots and navigates all stub routes");

  assertIncludes("src/main/ipc/handlers/system-handlers.ts", "auditRepository.record", "stub action writes an audit event mechanism");
  assertAnyTestIncludes("records an audit event on ping", "stub action writes an audit event");

  assertIncludes("src/renderer/theme.css", "--color-accent", "theme tokens resolve mechanism");
  assertAnyTestIncludes("no hex literals in renderer", "theme tokens resolve");

  assertIncludes("src/db/migrations/001-core.ts", "audit_events_no_update", "audit append-only update trigger");
  assertIncludes("src/db/migrations/001-core.ts", "audit_events_no_delete", "audit append-only delete trigger");
  assertAnyTestIncludes("an audit_events row cannot be updated or deleted", "audit append-only proven");

  assertIncludes("src/shared/ipc.ts", "zod", "IPC schema registry");
  assertIncludes("src/preload/preload.ts", "Object.keys(IPC)", "generated preload bridge");
  assertIncludes("src/db/migrations/index.ts", "migration001Core", "numbered migration index");
} else if (requestedPhase === 1) {
  assertIncludes("src/db/repositories/vault-repository.ts", "encryptString", "key store mechanism");
  assertIncludes("src/db/repositories/vault-repository.ts", "readSecret", "one read gate mechanism");
  assertAnyTestIncludes("round-trips a key encrypted", "key store/test/revoke works");
  assertAnyTestIncludes("revoke removes the key and future reads fail closed", "key revoke fails closed");

  assertIncludes("src/db/repositories/agents-repository.ts", "setModel", "per-agent model switch mechanism");
  assertIncludes("src/main/providers/provider-adapters.ts", "testConnection", "provider adapter mechanism");
  assertAnyTestIncludes("selects model per agent", "per-agent provider and model switch");
  assertAnyTestIncludes("provider adapter honours the per-agent model selection", "provider adapter model selection");

  assertIncludes("src/db/repositories/vault-repository.ts", "sensitivity: \"sensitive\"", "key reads audited mechanism");
  assertAnyTestIncludes("reading a key writes an audit event with sensitivity sensitive", "key reads audited");

  assertIncludes("src/db/migrations/002-vault.ts", "api_keys", "vault migration");
  assertIncludes("src/db/migrations/003-agents.ts", "osint-agent", "agent seed migration");
  assertIncludes("src/renderer/components/settings-view.tsx", "keys:add", "settings API key controls");
} else if (requestedPhase === 2) {
  assertIncludes("src/main/search/orchestrator.ts", "sourceReturned", "live source arrival mechanism");
  assertIncludes("src/main/ipc/handlers/search-handlers.ts", "search:source-returned", "IPC source arrival event");
  assertIncludes("src/main/search/orchestrator.ts", "ObservationBatcher", "batched observation event mechanism");
  assertIncludes("src/main/search/orchestrator.ts", "runBounded", "bounded fan-out mechanism");
  assertIncludes("src/main/search/orchestrator.ts", "connectorTimeoutMs", "per-connector timeout mechanism");
  assertIncludes("src/shared/ipc.ts", "search:cancel", "search cancellation channel");
  assertIncludes("src/db/repositories/search-repository.ts", "appendObservations", "incremental persistence mechanism");
  assertAnyTestIncludes("streams a source-returned event per source", "live source arrivals");
  assertAnyTestIncludes("bounds connector fan-out", "bounded connector fan-out");
  assertAnyTestIncludes("batches observation events into capped chunks", "batched observation events");
  assertAnyTestIncludes("flushes observation batches on a timer", "timed observation flushing");
  assertAnyTestIncludes("cancels queued connector work", "search cancellation");
  assertAnyTestIncludes("times out a connector that ignores abort signals", "hard connector timeout");
  assertAnyTestIncludes("writes observation batches before finalizing", "incremental persistence");

  assertIncludes("src/main/search/correlation.ts", "strengthBand", "corroboration scoring mechanism");
  assertAnyTestIncludes("promotes a 3-source entity to strong", "overlaps score by corroboration");

  assertIncludes("src/db/repositories/search-repository.ts", "saveRun", "search persistence mechanism");
  assertAnyTestIncludes("persists a search run with saveable nodes", "nodes save-able");

  assertIncludes("src/main/search/source-connector.ts", "SourceConnector", "connector interface documented");
  assertIncludes("src/main/search/connectors/index.ts", "searchConnectors", "passive connector registry");
  assertIncludes("src/renderer/components/search-view.tsx", "Search this further", "pivot UI mechanism");
} else if (requestedPhase === 3) {
  assertIncludes("src/db/repositories/cases-repository.ts", "addItem", "case save mechanism");
  assertIncludes("src/renderer/components/search-view.tsx", "case:addItem", "save from search mechanism");
  assertAnyTestIncludes("saves a search observation to a case", "create case and save from search");
  assertAnyTestIncludes("search route saves a selected tree node to a case", "search route save-to-case behavior");

  assertIncludes("src/db/repositories/cases-repository.ts", "ORDER BY source_ts ASC", "ordered timeline mechanism");
  assertAnyTestIncludes("timeline is ordered by time", "ordered timeline");
  assertAnyTestIncludes("cases route renders timeline items", "timeline renders");

  assertIncludes("src/db/repositories/cases-repository.ts", "summary", "summary mechanism");
  assertAnyTestIncludes("summary aggregates key entities by strength", "summary computes");

  assertIncludes("src/db/migrations/007-cases.ts", "fts5", "FTS mechanism");
  assertAnyTestIncludes("FTS finds a saved value by substring", "FTS works");
} else if (requestedPhase === 4) {
  assertIncludes("src/main/reports/report-service.ts", "ReportService", "report service mechanism");
  assertIncludes("src/main/reports/pdf-renderer.ts", "pdfkit", "PDF renderer mechanism");
  assertIncludes("src/main/reports/docx-renderer.ts", "docx", "Word renderer mechanism");
  assertAnyTestIncludes("renders a PDF and a DOCX from a case fixture", "PDF and DOCX output");

  assertIncludes("src/main/reports/report-model.ts", "citations", "citation model mechanism");
  assertAnyTestIncludes("the report includes each finding's cited source", "citations present");

  assertIncludes("src/main/reports/report-service.ts", "auditRepository.record", "report generation audit mechanism");
  assertAnyTestIncludes("generation writes an audit event", "generation audited");

  assertIncludes("src/db/migrations/008-reports.ts", "reports", "report row migration");
  assertIncludes("src/renderer/components/reports-view.tsx", "report:generate", "reports list surface mechanism");
  assertAnyTestIncludes("output is deterministic for a fixed fixture", "deterministic output");
  assertAnyTestIncludes("reports route generates a PDF from a selected case", "reports surface");
} else if (requestedPhase === 5) {
  assertIncludes("src/main/agents/agent-runtime-service.ts", "STEP_FORMAT.parse", "agent loop validates strict steps");
  assertIncludes("src/main/agents/agent-runtime-service.ts", "agentFindingSchema.parse", "cited finding gate mechanism");
  assertIncludes("src/main/agents/agent-runtime-service.ts", "casesRepository.addItem", "findings saved to case mechanism");
  assertIncludes("src/db/repositories/agent-runtime-repository.ts", "appendMemory", "shared memory write mechanism");
  assertIncludes("src/db/repositories/agent-runtime-repository.ts", "atomic", "agent success transaction mechanism");
  assertIncludes("src/main/agents/agent-event-batcher.ts", "maxItems", "batched agent event mechanism");
  assertIncludes("src/renderer/components/agents-view.tsx", "onAgentEvent", "batched event subscription mechanism");
  assertIncludes("src/renderer/components/agents-view.tsx", "Clean idle statuses", "clean idle setting mechanism");
  assertIncludes("src/renderer/components/agents-hq-scene.tsx", "spacePan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE", "space-drag pan wiring");
  assertIncludes("src/renderer/components/agents-hq-scene.tsx", "onDoubleClick", "double-click focus wiring");
  assertIncludes("src/renderer/components/agents-view.tsx", "Agents list fallback", "scene fallback mechanism");
  assertIncludes("src/renderer/components/search-view.tsx", "Send to agent", "send-to-agent search handoff mechanism");
  assertIncludes("src/db/migrations/009-agents-runtime.ts", "agent_playbooks", "playbooks persistence mechanism");
  assertAnyTestIncludes("STEP_FORMAT parses a step with null summary and next", "strict step format");
  assertAnyTestIncludes("memory written by agent A is readable by agent B on a different provider", "cross-provider shared memory");
  assertAnyTestIncludes("a finding without a source is rejected", "cited rule enforced");
  assertAnyTestIncludes("run history persists and reloads", "run history persists");
  assertAnyTestIncludes("streams steps and cited findings", "streams steps and cited findings");
  assertAnyTestIncludes("findings are saved to case and memory", "findings saved to case and memory");
  assertAnyTestIncludes("cleans up saved case evidence when a run fails after case save", "failed run cleans up partial evidence");
  assertAnyTestIncludes("status maps from agent state", "status maps from agent state");
  assertAnyTestIncludes("idle filter respects the clean toggle", "clean idle filter");
  assertAnyTestIncludes("camera controls are wired", "camera controls wired");
  assertAnyTestIncludes("double-click focuses a character", "double-click focus behavior");
  assertAnyTestIncludes("list-view fallback renders", "list fallback renders");
  assertAnyTestIncludes("scene-init failure does not crash", "scene failure fallback");
  assertAnyTestIncludes("search route sends a selected tree node to an agent", "send-to-agent search handoff");
} else if (requestedPhase === 6) {
  assertIncludes("src/main/agents/architect-agent-service.ts", "RepoReadTool", "architect repo-read mechanism");
  assertIncludes("src/main/agents/architect-chat-provider.ts", "ArchitectChatProvider", "architect provider abstraction");
  assertIncludes("src/main/agents/architect-chat-provider.ts", "ArchitectProviderResolver", "architect provider resolver");
  assertIncludes("src/main/agents/architect-agent-service.ts", "provider.ask", "architect ask provider call");
  assertIncludes("src/main/agents/architect-agent-service.ts", "provider.proposePlan", "architect plan provider call");
  assertIncludes("src/main/agents/architect-apply-executor.ts", "PlanArtifactApplyExecutor", "architect apply executor mechanism");
  assertIncludes("src/main/agents/architect-apply-executor.ts", "realpathSync.native", "architect apply canonical write boundary");
  assertIncludes("src/main/agents/architect-agent-service.ts", "applyExecutor.apply", "architect approved write mechanism");
  assertIncludes("src/main/agents/architect-agent-service.ts", "agent.architect.apply.approved", "architect pre-write audit mechanism");
  assertIncludes("src/main/agents/architect-agent-service.ts", "architectProposalSchema.parse", "architect plan schema mechanism");
  assertIncludes("src/main/agents/architect-agent-service.ts", "confirmApply", "main-owned confirm mechanism");
  assertIncludes("src/main/agents/architect-agent-service.ts", "auditRepository.record", "architect audit mechanism");
  assertIncludes("src/main/agents/architect-agent-service.ts", "appendMemory", "architect shared memory mechanism");
  assertIncludes("src/main/agents/repo-read-tool.ts", "realpathSync.native", "canonical repo-read boundary mechanism");
  assertIncludes("src/main/ipc/handlers/architect-agent-handlers.ts", "agent:architect:ask", "architect ask handler");
  assertIncludes("src/main/ipc/handlers/architect-agent-handlers.ts", "agent:architect:proposePlan", "architect plan handler");
  assertIncludes("src/main/ipc/handlers/architect-agent-handlers.ts", "agent:architect:apply", "architect apply handler");
  assertIncludes("src/shared/ipc.ts", "agent:architect:apply", "architect IPC channel");
  assertIncludes("src/renderer/components/agents-view.tsx", "Ask architect", "architect in-app controls");
  assertIncludes("src/db/migrations/010-architect-agent.ts", "model = 'codex'", "architect Codex default migration");
  assertAnyTestIncludes("answers a codebase question citing real files", "architect answers codebase question");
  assertAnyTestIncludes("drafts a plan citing real files", "architect drafts feature plan");
  assertAnyTestIncludes("no write happens without an explicit confirm", "architect writes gated by confirm");
  assertAnyTestIncludes("provider and model is switchable and architect actions are audited", "architect provider switch and audit");
  assertAnyTestIncludes("invokes the switched architect provider", "architect resolver follows settings provider");
  assertAnyTestIncludes("approved confirm writes a plan artifact", "architect approved apply writes");
  assertAnyTestIncludes("does not execute an approved write when the pre-write audit fails", "architect pre-write audit blocks mutation");
  assertAnyTestIncludes("audits ask propose and apply", "architect all actions audited");
  assertAnyTestIncludes("uses shared memory so architect plans persist across agents and providers", "architect shared memory");
  assertAnyTestIncludes("rejects symlink escapes outside the project", "architect repo-read symlink escape rejection");
  assertAnyTestIncludes("rejects apply symlink escapes outside the project", "architect apply symlink escape rejection");
  assertAnyTestIncludes("rejects apply ancestor symlink escapes before mkdir", "architect apply ancestor symlink escape rejection");
} else if (requestedPhase === 7) {
  assertIncludes("src/main/tools/wsl-launcher.ts", "buildWslInvocation", "fixed WSL argv launcher mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", "shell: false", "launcher disables shell mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", "maxConcurrentProcesses", "bounded WSL process queue mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", "processTimeoutMs", "WSL timeout mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", "cancel(runId", "WSL cancel mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", "killWindowsProcessTree", "process tree kill mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", ".pause()", "stream pause backpressure mechanism");
  assertIncludes("src/main/tools/wsl-launcher.ts", ".resume()", "stream resume backpressure mechanism");
  assertIncludes("src/main/tools/tools-service.ts", "tool.tier === \"active\"", "active tier gate mechanism");
  assertIncludes("src/main/tools/tools-service.ts", "requireAuthorization", "exact authorization lookup mechanism");
  assertIncludes("src/main/tools/tools-service.ts", "casesRepository.addItem", "tool output save-to-case mechanism");
  assertIncludes("src/db/repositories/tools-repository.ts", "finishRun", "captured output persistence mechanism");
  assertIncludes("src/db/repositories/tools-repository.ts", "addCatalog", "catalog add mechanism");
  assertIncludes("src/db/repositories/tools-repository.ts", "updateCatalog", "catalog edit mechanism");
  assertIncludes("src/main/ipc/handlers/tools-handlers.ts", "tools:launch", "tools launch IPC handler");
  assertIncludes("src/shared/ipc.ts", "tools:launch", "tools launch IPC channel");
  assertIncludes("src/preload/preload.ts", "tools:output", "tool output event bridge");
  assertIncludes("src/renderer/components/tools-view.tsx", "Launch tool", "tools route launch surface");
  assertIncludes("src/db/migrations/011-tools.ts", "tool_catalog", "tools migration catalog table");
  assertIncludes("src/db/migrations/011-tools.ts", "authorizations", "tools migration authorizations table");
  assertIncludes("src/db/migrations/011-tools.ts", "tool_runs", "tools migration runs table");
  assertAnyTestIncludes("launcher builds a fixed argv and never invokes a shell", "fixed argv and no shell");
  assertAnyTestIncludes("launcher queues WSL processes", "bounded WSL process queue");
  assertAnyTestIncludes("launcher cancels queued WSL processes before they spawn", "queued WSL cancel");
  assertAnyTestIncludes("launcher does not spawn when an abort signal is already canceled", "pre-aborted WSL launch");
  assertAnyTestIncludes("launcher times out and kills the process tree", "WSL timeout process-tree kill");
  assertAnyTestIncludes("launcher cancel kills the process tree", "WSL cancel process-tree kill");
  assertAnyTestIncludes("launcher caps multibyte output by bytes and pauses and resumes fast streams", "byte output cap and stream backpressure");
  assertAnyTestIncludes("an active tool is blocked without a matching authorization", "active gate blocks without auth");
  assertAnyTestIncludes("wrong-target and expired active authorizations are blocked", "active gate rejects wrong or expired auth");
  assertAnyTestIncludes("an exact unexpired active authorization permits", "active gate permits exact unexpired auth");
  assertAnyTestIncludes("captures WSL tool output to a run so tool results can be saved to a case", "captured output is attachable");
  assertAnyTestIncludes("catalog add and edit persists", "catalog add edit persists");
  assertAnyTestIncludes("detect checks installed tools with fixed WSL which commands", "installed detection fixed argv");
} else if (requestedPhase === 8) {
  assertIncludes("src/main/scans/scan-service.ts", "buildNmapArgv", "nmap argv builder mechanism");
  assertIncludes("src/main/scans/scan-service.ts", "validateCustomArgs", "custom argv target guard mechanism");
  assertIncludes("src/main/scans/scan-service.ts", "\"-oX\"", "nmap XML stdout mechanism");
  assertIncludes("src/main/scans/scan-service.ts", "findMatchingAuthorization", "exact target authorization mechanism");
  assertIncludes("src/main/scans/nmap-parser.ts", "parseNmapXml", "nmap XML parser mechanism");
  assertIncludes("src/main/scans/topology-layout.ts", "buildScanTopology", "deterministic topology mechanism");
  assertIncludes("src/db/repositories/scans-repository.ts", "finishRun", "scan host and port persistence mechanism");
  assertIncludes("src/main/reports/report-model.ts", "buildScanReportModel", "scan report model mechanism");
  assertIncludes("src/main/reports/report-model.ts", "Service list", "scan service list report mechanism");
  assertIncludes("src/main/reports/report-model.ts", "Address | Hostname | Status | Ports", "scan host table report mechanism");
  assertIncludes("src/renderer/theme.css", "--xy-node-background-color-default", "React Flow theme token override");
  assertIncludes("src/main/reports/report-service.ts", "generateScanReport", "scan report export mechanism");
  assertIncludes("src/main/ipc/handlers/scan-handlers.ts", "scan:run", "scan run IPC handler");
  assertIncludes("src/shared/ipc.ts", "scan:topology", "scan topology IPC channel");
  assertIncludes("src/preload/preload.ts", "scan:output", "scan output event bridge");
  assertIncludes("src/renderer/components/network-scan-view.tsx", "ReactFlow", "network scan topology renderer");
  assertIncludes("src/db/migrations/012-scans.ts", "scans", "scans migration table");
  assertIncludes("src/db/migrations/012-scans.ts", "hosts", "hosts migration table");
  assertIncludes("src/db/migrations/012-scans.ts", "ports", "ports migration table");
  assertAnyTestIncludes("parses nmap XML into hosts and ports", "parses nmap XML");
  assertAnyTestIncludes("lays out topology deterministically for identical input", "deterministic topology layout");
  assertAnyTestIncludes("network scan route renders topology nodes from scan results", "topology renders from scan result");
  assertAnyTestIncludes("refuses an unauthorized scan", "unauthorized scan refused");
  assertAnyTestIncludes("rejects custom nmap argv targets", "custom argv target guard");
  assertAnyTestIncludes("allows only approved target-neutral custom nmap flags", "custom argv safe allowlist");
  assertAnyTestIncludes("runs an authorized scan and captures parsed hosts", "authorized scan parses hosts");
  assertAnyTestIncludes("export includes the topology host table and service list", "scan export includes topology host table service list");
} else if (requestedPhase === 9) {
  assertIncludes("src/main/analyzers/analyzers-service.ts", "wevtutil.exe", "EVTX fixed Windows import mechanism");
  assertIncludes("src/main/analyzers/analyzers-service.ts", "shell: false", "EVTX shell disabled mechanism");
  assertIncludes("src/main/analyzers/analyzers-service.ts", "MAX_EVTX_CAPTURE_BYTES", "EVTX bounded output mechanism");
  assertIncludes("src/main/analyzers/analyzers-service.ts", "Process timed out and was canceled", "EVTX timeout mechanism");
  assertIncludes("src/main/analyzers/analyzers-service.ts", "killWindowsProcessTree", "EVTX process-tree kill mechanism");
  assertIncludes("src/main/analyzers/evtx-parser.ts", "parseEvtxXml", "EVTX parser mechanism");
  assertIncludes("src/main/analyzers/evtx-parser.ts", "filterEvtxEvents", "EVTX event id filter mechanism");
  assertIncludes("src/main/analyzers/pcap-parser.ts", "buildTsharkArgv", "PCAP tshark argv builder mechanism");
  assertIncludes("src/main/analyzers/pcap-parser.ts", "\"-r\"", "PCAP file import argv mechanism");
  assertIncludes("src/main/analyzers/pcap-parser.ts", "parseTsharkJson", "PCAP parser mechanism");
  assertIncludes("src/main/analyzers/dork-builder.ts", "replaceAll(\"{target}\"", "local dork template mechanism");
  assertIncludes("src/main/analyzers/oui-data.ts", "offlineOuiVendors", "bundled offline OUI mechanism");
  assertIncludes("src/main/analyzers/oui-data.generated.ts", "Generated IEEE OUI vendors", "full generated OUI bundle mechanism");
  assertIncludes("src/main/analyzers/mac-lookup.ts", "lookupMacVendor", "MAC vendor lookup mechanism");
  assertIncludes("src/main/analyzers/vulnerability-lookup.ts", "fetchNvdVulnerabilities", "NVD product version lookup mechanism");
  assertIncludes("src/main/analyzers/vulnerability-lookup.ts", "NVD response missing vulnerabilities", "NVD invalid response fail-closed mechanism");
  assertIncludes("src/db/migrations/013-analyzers.ts", "vuln_cache", "vulnerability cache migration mechanism");
  assertIncludes("src/db/repositories/analyzers-repository.ts", "readVulnCache", "CVE cache read mechanism");
  assertIncludes("src/db/repositories/analyzers-repository.ts", "writeVulnCache", "CVE cache write mechanism");
  assertIncludes("src/main/analyzers/analyzers-service.ts", "casesRepository.addItem", "analyzer save-to-case mechanism");
  assertIncludes("src/main/ipc/handlers/analyzers-handlers.ts", "analyzer:evtx:import", "analyzer IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "analyzer:vuln:lookup", "analyzer IPC channel mechanism");
  assertIncludes("src/renderer/components/analyzers-view.tsx", "Build dorks", "analyzers route surface mechanism");
  assertIncludes("src/db/migrations/013-analyzers.ts", "evtx_imports", "EVTX import persistence");
  assertIncludes("src/db/migrations/013-analyzers.ts", "pcap_imports", "PCAP import persistence");
  assertAnyTestIncludes("evtx parser reads a fixture and filters by event id", "EVTX parser fixture filters by event id");
  assertAnyTestIncludes("EVTX fixed process caps output and times out with a process-tree kill", "EVTX bounded process execution");
  assertAnyTestIncludes("pcap parser reads a fixture and never exposes a live capture argv", "PCAP parser fixture and no live capture argv");
  assertAnyTestIncludes("dork builder creates expected queries locally", "dork expected queries");
  assertAnyTestIncludes("MAC lookup resolves an offline vendor", "MAC offline resolves");
  assertAnyTestIncludes("product and version map to a CVE list from mocked NVD data", "product version maps to CVEs");
  assertAnyTestIncludes("analyzers import parse and save findings to a case", "each analyzer imports parses and saves");
  assertAnyTestIncludes("vulnerability lookup caches NVD responses", "vulnerability cache behavior");
  assertAnyTestIncludes("vulnerability lookup rejects invalid NVD responses without caching them", "NVD failure does not cache empty results");
  assertAnyTestIncludes("analyzers route builds dorks and saves findings through IPC", "analyzers route behavior");
} else if (requestedPhase === 10) {
  assertIncludes("src/db/migrations/014-monitoring.ts", "watchlist", "watchlist migration mechanism");
  assertIncludes("src/db/migrations/014-monitoring.ts", "exposures", "exposure persistence migration mechanism");
  assertIncludes("src/db/migrations/014-monitoring.ts", "monitoring_alerts", "monitoring alert migration mechanism");
  assertIncludes("src/db/migrations/014-monitoring.ts", "exposures_no_delete", "append-only exposure history mechanism");
  assertIncludes("src/db/migrations/014-monitoring.ts", "monitoring_alerts_no_delete", "append-only alert history mechanism");
  assertIncludes("src/db/repositories/monitoring-repository.ts", "removed_ts", "watch soft-remove mechanism");
  assertIncludes("src/db/repositories/monitoring-repository.ts", "recordExposure", "exposure dedupe repository mechanism");
  assertIncludes("src/db/repositories/monitoring-repository.ts", "dueWatches", "scheduled due-watch query mechanism");
  assertIncludes("src/main/monitoring/credential-sources.ts", "xposedornot", "XposedOrNot free spine mechanism");
  assertIncludes("src/main/monitoring/credential-sources.ts", "requiresKey: true", "paid source key-slot mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "vaultRepository.has", "paid source missing key skip mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "runDueRechecks", "scheduled recheck mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "setInterval", "main-process scheduler mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "createAlert", "exposure alert mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "casesRepository.addItem", "watch exposure save-to-case mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "searchRepository.saveRun", "monitoring feeds correlation model mechanism");
  assertIncludes("src/main/monitoring/monitoring-service.ts", "auditRepository.record", "monitoring audit mechanism");
  assertIncludes("src/main/ipc/handlers/monitoring-handlers.ts", "watch:checkNow", "monitoring IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "watch:exposures", "monitoring IPC channel mechanism");
  assertIncludes("src/renderer/components/dashboard-view.tsx", "Add watch", "dashboard watchlist surface mechanism");
  assertAnyTestIncludes("records and alerts on a new exposure", "add target check alert and save");
  assertAnyTestIncludes("scheduled recheck fires and dedupes already-seen exposures", "scheduled recheck fires and dedupes");
  assertAnyTestIncludes("paid source with no key is skipped without error", "paid source degrades gracefully");
  assertAnyTestIncludes("removing a watch preserves exposure alerts", "exposure alerts append-only history");
  assertAnyTestIncludes("dashboard adds a watch target and checks exposure alerts", "dashboard monitoring surface");
} else if (requestedPhase === 11) {
  assertIncludes("src/shared/types/search.ts", "\"image\"", "image seed type mechanism");
  assertIncludes("src/db/migrations/015-image-username.ts", "image_searches", "image search migration mechanism");
  assertIncludes("src/db/repositories/image-search-repository.ts", "ImageSearchRepository", "image search repository mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "browserImageSearch", "browser fallback seam mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "https://lens.google.com", "Google Lens browser fallback mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "https://yandex.com/images/search", "Yandex browser fallback mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "openweb-ninja", "optional OpenWeb Ninja key path");
  assertIncludes("src/main/image-username/image-username-service.ts", "bright-data", "optional Bright Data key path");
  assertIncludes("src/main/image-username/image-username-service.ts", "[\"maigret\", request.username, \"--json\", \"-\"]", "Maigret fixed argv mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "[\"blackbird\", \"-u\", request.username, \"--json\"]", "Blackbird fixed argv mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "agentRuntimeService.run", "OSINT agent username handoff mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "searchRepository.saveRun", "image username correlation persistence mechanism");
  assertIncludes("src/main/image-username/image-username-service.ts", "casesRepository.addItem", "image username save-to-case mechanism");
  assertIncludes("src/main/ipc/handlers/image-username-handlers.ts", "search:image", "image search IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "search:usernameSweep", "username sweep IPC channel mechanism");
  assertIncludes("src/shared/ipc.ts", "system:pickImage", "main-process image upload picker channel");
  assertIncludes("src/renderer/components/search-view.tsx", "Search image", "image search UI mechanism");
  assertIncludes("src/renderer/components/search-view.tsx", "Browse image", "image upload picker UI mechanism");
  assertIncludes("src/renderer/components/search-view.tsx", "Username sweep", "username sweep UI mechanism");
  assertAnyTestIncludes("adds image results as observations", "image results into tree and case");
  assertAnyTestIncludes("with no image API key the browser path is used without crashing", "browser fallback no key");
  assertAnyTestIncludes("Browse image", "image upload picker route behavior");
  assertAnyTestIncludes("username sweep corroborates the same account across sources", "username corroboration across sources");
  assertAnyTestIncludes("search route runs image and username depth", "image username route behavior");
} else if (requestedPhase === 12) {
  assertIncludes("src/main/dashboard/dashboard-service.ts", "summary()", "dashboard summary service mechanism");
  assertIncludes("src/db/repositories/dashboard-repository.ts", "recentSearches", "dashboard recent activity repository mechanism");
  assertIncludes("src/main/ipc/handlers/dashboard-handlers.ts", "dashboard:summary", "dashboard IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "dashboard:summary", "dashboard IPC channel mechanism");
  assertIncludes("src/renderer/components/dashboard-view.tsx", "Recent activity", "dashboard recent activity surface");
  assertIncludes("src/renderer/components/dashboard-view.tsx", "Quick search", "dashboard quick search surface");
  assertAnyTestIncludes("dashboard aggregates recent activity and active cases", "dashboard aggregates recent activity and active cases");

  assertIncludes("src/db/repositories/audit-repository.ts", "public query", "audit filtered query repository mechanism");
  assertIncludes("src/main/ipc/handlers/audit-handlers.ts", "audit:query", "audit query IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "audit:query", "audit query IPC channel mechanism");
  assertIncludes("src/renderer/components/audit-log-view.tsx", "Apply filters", "audit log filter surface mechanism");
  assertAnyTestIncludes("filters audit by type and date", "audit filters by type and date");

  assertIncludes("src/renderer/components/settings-view.tsx", "tools.wslDistro", "settings WSL distro mechanism");
  assertIncludes("src/renderer/components/settings-view.tsx", "agents.sharedMemoryScope", "settings shared memory scope mechanism");
  assertIncludes("package.json", "electron-builder", "electron-builder dependency and scripts");
  assertIncludes("package.json", "package:win", "Windows package script");
  assertIncludes("package.json", "reacher-icon.ico", "Reacher icon package mechanism");
  assertIncludes("scripts/package-smoke.mjs", "electron-builder", "packaging smoke script mechanism");
  assertAnyTestIncludes("packaging smoke test verifies electron-builder config", "packaging smoke test");
} else if (requestedPhase === 13) {
  assertIncludes("src/db/migrations/016-tools-mobile-social.ts", "nuclei", "ProjectDiscovery catalog mechanism");
  assertIncludes("src/db/migrations/016-tools-mobile-social.ts", "Metasploit Framework", "gated exploitation catalog mechanism");
  assertIncludes("src/db/migrations/016-tools-mobile-social.ts", "juice-shop-lab", "practice target lab mechanism");
  assertIncludes("src/db/migrations/016-tools-mobile-social.ts", "mobile_device_snapshots", "mobile snapshot schema mechanism");
  assertIncludes("src/shared/types/tools.ts", "\"wireless\"", "expanded tool category type mechanism");
  assertAnyTestIncludes("nuclei", "expanded catalog includes requested tools");
  assertAnyTestIncludes("juice-shop-lab", "practice lab catalog entry");

  assertIncludes("src/main/mobile/mobile-service.ts", "execFile", "main-owned mobile command mechanism");
  assertIncludes("src/main/mobile/mobile-service.ts", "shell: false", "mobile probes use shell false");
  assertIncludes("src/main/ipc/handlers/mobile-handlers.ts", "mobile:detect", "mobile IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "mobile:profiles", "mobile IPC channel mechanism");
  assertIncludes("src/renderer/components/mobile-view.tsx", "Detect mobile devices", "mobile route surface mechanism");
  assertAnyTestIncludes("detects Android and iOS devices through fixed local probes", "mobile fixed probe behavior");
  assertAnyTestIncludes("reports missing mobile tools without crashing", "mobile missing tools fallback");

  assertIncludes("src/main/social/social-network-catalog.generated.ts", "Generated from WebBreacher WhatsMyName", "offline social catalog mechanism");
  assertIncludes("src/main/social/social-analyzer-service.ts", "status: \"candidate\"", "candidate-only social analyzer mechanism");
  assertIncludes("src/main/ipc/handlers/social-handlers.ts", "social:analyze", "social IPC handler mechanism");
  assertIncludes("src/renderer/components/social-analyzer-view.tsx", "Social analyzer", "social analyzer route surface");
  assertAnyTestIncludes("more than three hundred networks without marking them verified", "social analyzer broad candidate test");
} else if (requestedPhase === 14) {
  assertIncludes("planning/METHODOLOGY_MAP.md", "OWASP", "methodology source spec");
  assertIncludes("src/main/methodology/methodology-service.ts", "Exploitation readiness", "safe exploitation-readiness phase mechanism");
  assertIncludes("src/main/methodology/methodology-service.ts", "exportCsv", "coverage CSV export mechanism");
  assertIncludes("src/main/ipc/handlers/methodology-handlers.ts", "methodology:list", "methodology IPC handler mechanism");
  assertIncludes("src/shared/ipc.ts", "methodology:export", "methodology IPC channel mechanism");
  assertIncludes("src/renderer/components/methodology-map-view.tsx", "methodology-connector", "connected methodology phase mechanism");
  assertIncludes("src/renderer/components/methodology-map-view.tsx", "Export coverage spreadsheet", "methodology route export surface");
  assertIncludes("src/renderer/navigation.ts", "methodology-map", "methodology navigation mechanism");
  assertAnyTestIncludes("lists six methodology phases with authorization-aware tools", "methodology six phases and authorization");
  assertAnyTestIncludes("exports coverage spreadsheet CSV", "methodology coverage export");
  assertAnyTestIncludes("renders six connected methodology phases and stays read-only", "methodology connected read-only route behavior");
} else if (requestedPhase === 15) {
  // Real agent execution. The old runtime read a prompt file only to count its
  // characters, so "an agent ran" has to mean a provider was called and what it
  // returned was checked, not that a template rendered.
  assertIncludes("src/main/providers/chat-providers.ts", "OllamaChatProvider", "real chat provider mechanism");
  assertIncludes("src/main/providers/chat-providers.ts", "UnavailableChatProvider", "unwired provider fails loudly mechanism");
  assertIncludes("src/main/agents/agent-runtime-service.ts", "provider.complete", "agent runtime calls a real model mechanism");
  assertIncludes("src/main/agents/agent-runtime-service.ts", "context.citations.has", "citation-integrity filter mechanism");
  assertIncludes("src/db/migrations/025-scout-byte-agent-defaults.ts", "scout-agent", "scout/byte free-provider and prompt migration mechanism");
  assertAnyTestIncludes("instead of a template, so two seeds cannot produce identical findings", "agent output comes from the provider");
  assertAnyTestIncludes("so a fabricated source cannot reach memory", "ungrounded citation rejected");
  assertAnyTestIncludes("instead of falling back to fake text", "unwired provider fails the run");
  assertAnyTestIncludes("retries malformed JSON exactly once", "malformed model JSON retry");

  // The two process-backed scripts join the passive fan-out as ordinary
  // connectors, so they inherit failure isolation and the abort signal.
  assertIncludes("src/main/search/connectors/sherlock-connector.ts", "createSherlockConnector", "sherlock search connector mechanism");
  assertIncludes("src/main/search/connectors/scrapegraph-connector.ts", "keySource: \"openai\"", "scrapegraph vault-gated key mechanism");
  assertIncludes("src/main/search/source-connector.ts", "timeoutMs", "per-connector timeout mechanism");
  assertIncludes("src/main/ipc/register.ts", "passiveSearchConnectors", "process-backed connectors registered mechanism");
  assertAnyTestIncludes("so a seed with shell metacharacters stays inert data", "sherlock argv injection safety");
  assertAnyTestIncludes("split across two stdout chunks", "sherlock chunked output parsing");
  assertAnyTestIncludes("before it reaches the results board", "scrapegraph key redaction");

  // One Enter runs the whole profile: main starts the agent after the search
  // and the board renders without waiting for the model.
  assertIncludes("src/main/ipc/handlers/search-handlers.ts", "startAgent", "search auto-runs the OSINT agent mechanism");
  assertIncludes("src/main/agents/agent-runtime-service.ts", "observation:", "search observations are citable mechanism");
  assertIncludes("src/renderer/components/search-view.tsx", "onAgentEvent", "search surface streams agent events mechanism");
  assertIncludes("src/renderer/components/search-view.tsx", "search-intake", "live intake panel mechanism");
  assertAnyTestIncludes("so it can cite real evidence", "agent receives the run observations");
  assertAnyTestIncludes("without waiting for the agent", "search reply is not blocked by the model");
  assertAnyTestIncludes("instead of minting a case per Enter", "auto-run reuses one open case");
  assertAnyTestIncludes("so one Enter produces the whole profile", "agent finding renders on the search board");

  // The five blockers that stopped any of the above from working on real
  // hardware. Each one was a silent failure, so each gets a pinned mechanism.
  assertIncludes("src/main/search/http.ts", "headers.has(\"accept\")", "caller-supplied accept header survives mechanism");
  assertIncludes("src/main/search/connectors/dns-doh-connector.ts", "application/dns-json", "DoH media type mechanism");
  assertAnyTestIncludes("the only media type its JSON API answers", "DoH accept header");

  assertIncludes("src/db/migrations/026-runnable-agent-models.ts", "llama3.1:8b", "runnable agent model migration mechanism");
  assertIncludes("src/main/providers/provider-adapters.ts", "llama3.1:8b", "selectable runnable model mechanism");
  assertAnyTestIncludes("keeps its 70B pick", "deliberate model choice preserved");

  assertIncludes("src/main/providers/chat-providers.ts", "AnthropicChatProvider", "real Anthropic provider mechanism");
  assertIncludes("src/main/providers/chat-providers.ts", "defaultChatProviders", "vault-injected provider key mechanism");
  assertIncludes("src/main/agents/agent-runtime-service.ts", "effort: agent.reasoningEffort", "reasoning effort forwarded mechanism");
  assertAnyTestIncludes("never from ambient environment", "Anthropic key comes from the vault");
  assertAnyTestIncludes("stops being decorative", "reasoning effort reaches the provider");

  assertIncludes("scripts/check-runtime.mjs", "Reacher runtime dependencies", "runtime doctor mechanism");
  assertIncludes("scripts/setup-runtime.ps1", "ollama pull", "runtime setup script mechanism");
  assertIncludes("package.json", "\"doctor\"", "doctor npm script mechanism");
  assertIncludes("scripts/package-smoke.mjs", "scrapegraph-osint.py", "worker script is packaged mechanism");

  // Four items deliberately deferred out of the original audit pass because
  // each was a real feature gap, not a one-line fix: mobile detection never
  // persisted or audited anything; PDF export dropped non-Latin characters;
  // the social analyzer's status was permanently stuck at "candidate" with no
  // way to actually verify a candidate; and DNS-over-HTTPS lost every record
  // type if any single one failed.
  assertIncludes("src/db/repositories/mobile-repository.ts", "recordSnapshot", "mobile snapshot persistence mechanism");
  assertIncludes("src/main/mobile/mobile-service.ts", "mobile.detect", "mobile detect audit mechanism");
  assertIncludes("src/shared/ipc.ts", "mobile:snapshots", "mobile snapshot history IPC mechanism");
  assertAnyTestIncludes("persists one snapshot per detected device", "mobile snapshot persistence test");
  assertAnyTestIncludes("records one audit event per detect pass", "mobile detect audit test");

  assertIncludes("src/main/reports/pdf-renderer.ts", "NON_LATIN1_PATTERN", "PDF Unicode fallback font mechanism");
  if (!fs.existsSync(path.join(repoRoot, "assets/fonts/NotoSans-Variable.ttf"))) {
    fail("embedded Noto Sans font asset is missing at assets/fonts/NotoSans-Variable.ttf");
  }
  assertAnyTestIncludes("keeps Cyrillic characters instead of dropping them", "PDF Cyrillic round-trip test");

  assertIncludes("src/main/social/social-analyzer-service.ts", "public async verify", "social real-verification mechanism");
  assertIncludes("src/main/social/social-network-catalog.generated.ts", "existsStatus", "real per-site detection rule mechanism");
  assertIncludes("src/shared/schemas/social.ts", "\"verified\", \"absent\", \"unknown\"", "real candidate status enum mechanism");
  assertIncludes("src/shared/ipc.ts", "social:verify", "social verification IPC mechanism");
  assertAnyTestIncludes("marks a candidate verified only when the response matches", "social verification real-rule test");
  assertAnyTestIncludes("never runs more than the configured number of probes at once", "social verification bounded concurrency test");

  assertIncludes("src/main/search/connectors/dns-doh-connector.ts", "Promise.allSettled", "DNS-DoH partial-failure resilience mechanism");
  assertAnyTestIncludes("keeps the other four record types' observations", "DNS-DoH partial failure test");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`PASS: Phase ${requestedPhase} exit criteria map to mechanisms and tests`);
