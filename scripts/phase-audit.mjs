/**
 * Phase audit is a source-backed checklist so done means mechanisms and tests
 * exist together. If exit criteria lived only in prose, a green test suite could
 * still miss an entire Phase 0 requirement.
 */
import fs from "node:fs";
import path from "node:path";

const MAX_PHASE = 5;
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
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`PASS: Phase ${requestedPhase} exit criteria map to mechanisms and tests`);
