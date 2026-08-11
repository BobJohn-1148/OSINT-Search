/**
 * Security audit is source-scoped to implemented phases because each phase adds
 * new invariants the app can actually prove. If this script claimed coverage
 * without matching source checks, later phases would inherit false confidence.
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");
const rendererRoot = path.join(srcRoot, "renderer");

function walkFiles(dir, predicate = () => true) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath, predicate);
    }
    return predicate(fullPath) ? [fullPath] : [];
  });
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

const sourceFiles = walkFiles(srcRoot, (filePath) => /\.(ts|tsx|css)$/.test(filePath));
const rendererFiles = walkFiles(rendererRoot, (filePath) => /\.(ts|tsx|css)$/.test(filePath));
const rendererText = rendererFiles.map(read).join("\n");
const rendererNonThemeText = rendererFiles
  .filter((filePath) => path.basename(filePath) !== "theme.css")
  .map(read)
  .join("\n");
const sourceText = sourceFiles.map(read).join("\n");

if (/#[0-9a-fA-F]{3,8}\b/.test(rendererText)) {
  fail("renderer contains a raw hex color literal");
}

if (/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/i.test(rendererNonThemeText)) {
  fail("renderer contains raw color functions outside theme.css");
}

if (/shell\s*:\s*true/.test(sourceText)) {
  fail("source contains shell: true");
}

if (/wsl\.exe/i.test(sourceText) && !/shell\s*:\s*false/.test(sourceText)) {
  fail("wsl.exe appears without shell: false");
}

const migrationText = read(path.join(srcRoot, "db", "migrations", "001-core.ts"));
for (const required of ["STRICT", "audit_events_no_update", "audit_events_no_delete", "RAISE(ABORT"]) {
  if (!migrationText.includes(required)) {
    fail(`core migration is missing ${required}`);
  }
}

const ipcText = read(path.join(srcRoot, "shared", "ipc.ts"));
for (const required of ["capability", "sensitivity", "mutates", "summary"]) {
  if (!ipcText.includes(required)) {
    fail(`IPC registry is missing ${required}`);
  }
}

const vaultText = read(path.join(srcRoot, "db", "repositories", "vault-repository.ts"));
for (const required of ["encryptString", "decryptString", "auditRepository.record", "sensitivity: \"sensitive\""]) {
  if (!vaultText.includes(required)) {
    fail(`vault repository is missing ${required}`);
  }
}

const searchText = read(path.join(srcRoot, "main", "search", "orchestrator.ts"));
for (const required of ["runBounded", "maxConcurrentConnectors", "ObservationBatcher", "connector.tier === \"passive\"", "catch", "sourceReturned"]) {
  if (!searchText.includes(required)) {
    fail(`search orchestrator is missing ${required}`);
  }
}

const searchRepositoryText = read(path.join(srcRoot, "db", "repositories", "search-repository.ts"));
for (const required of ["startRun", "appendObservations", "finalizeRun"]) {
  if (!searchRepositoryText.includes(required)) {
    fail(`search repository is missing ${required}`);
  }
}

const agentRuntimeText = read(path.join(srcRoot, "main", "agents", "agent-runtime-service.ts"));
for (const required of ["STEP_FORMAT.parse", "agentFindingSchema.parse", "casesRepository.addItem", "appendMemory", "auditRepository.record"]) {
  if (!agentRuntimeText.includes(required)) {
    fail(`agent runtime service is missing ${required}`);
  }
}

const agentBatcherText = read(path.join(srcRoot, "main", "agents", "agent-event-batcher.ts"));
for (const required of ["maxItems", "flushMs", "flush()"]) {
  if (!agentBatcherText.includes(required)) {
    fail(`agent event batcher is missing ${required}`);
  }
}

const architectText = read(path.join(srcRoot, "main", "agents", "architect-agent-service.ts"));
for (const required of ["confirmApply", "RepoReadTool", "providerResolver.resolve", "provider.ask", "provider.proposePlan", "agent.architect.apply.approved", "applyExecutor.apply", "auditRepository.record", "appendMemory"]) {
  if (!architectText.includes(required)) {
    fail(`architect agent service is missing ${required}`);
  }
}

const architectProviderText = read(path.join(srcRoot, "main", "agents", "architect-chat-provider.ts"));
for (const required of ["ArchitectProviderResolver", "resolve(provider", "CodexArchitectProvider"]) {
  if (!architectProviderText.includes(required)) {
    fail(`architect chat provider is missing ${required}`);
  }
}

const architectExecutorText = read(path.join(srcRoot, "main", "agents", "architect-apply-executor.ts"));
for (const required of ["PlanArtifactApplyExecutor", "realpathSync.native", "writeFileSync", "planning"]) {
  if (!architectExecutorText.includes(required)) {
    fail(`architect apply executor is missing ${required}`);
  }
}

const repoReadText = read(path.join(srcRoot, "main", "agents", "repo-read-tool.ts"));
for (const required of ["realpathSync.native", "path.relative", "outside the Reacher repo", "assertExistingFile"]) {
  if (!repoReadText.includes(required)) {
    fail(`repo read tool is missing ${required}`);
  }
}

const toolsServiceText = read(path.join(srcRoot, "main", "tools", "tools-service.ts"));
for (const required of ["requireAuthorization", "tool.tier === \"active\"", "tool.launch.blocked", "casesRepository.addItem", "auditRepository.record"]) {
  if (!toolsServiceText.includes(required)) {
    fail(`tools service is missing ${required}`);
  }
}

const toolsLauncherText = read(path.join(srcRoot, "main", "tools", "wsl-launcher.ts"));
for (const required of ["wsl.exe", "\"-d\"", "\"--\"", "shell: false", "spawnProcess", "maxConcurrentProcesses", "processTimeoutMs", "cancel(runId", "queuedCancels", "signal?.aborted", "killWindowsProcessTree", "taskkill.exe", ".pause()", ".resume()"]) {
  if (!toolsLauncherText.includes(required)) {
    fail(`WSL launcher is missing ${required}`);
  }
}

const toolsRepositoryText = read(path.join(srcRoot, "db", "repositories", "tools-repository.ts"));
for (const required of ["findMatchingAuthorization", "createRun", "finishRun", "tool_catalog", "authorizations", "tool_runs"]) {
  if (!toolsRepositoryText.includes(required)) {
    fail(`tools repository is missing ${required}`);
  }
}

const preloadText = read(path.join(srcRoot, "preload", "preload.ts"));
if (!preloadText.includes("tools:output")) {
  fail("preload is missing the allowed tools:output event bridge");
}

const scanServiceText = read(path.join(srcRoot, "main", "scans", "scan-service.ts"));
for (const required of ["findMatchingAuthorization", "tier: \"active\"", "buildNmapArgv", "\"-oX\"", "\"-\"", "parseNmapXml", "auditRepository.record", "validateCustomArgs", "safeFlags", "approved target-neutral flags"]) {
  if (!scanServiceText.includes(required)) {
    fail(`scan service is missing ${required}`);
  }
}

const scanParserText = read(path.join(srcRoot, "main", "scans", "nmap-parser.ts"));
for (const required of ["XMLParser", "parseNmapXml", "ports", "hopDistance"]) {
  if (!scanParserText.includes(required)) {
    fail(`nmap parser is missing ${required}`);
  }
}

const scanLayoutText = read(path.join(srcRoot, "main", "scans", "topology-layout.ts"));
for (const required of ["buildScanTopology", "hashAddress", "Math.round"]) {
  if (!scanLayoutText.includes(required)) {
    fail(`scan topology layout is missing ${required}`);
  }
}

const reportModelText = read(path.join(srcRoot, "main", "reports", "report-model.ts"));
for (const required of ["buildScanReportModel", "Service list", "Address | Hostname | Status | Ports"]) {
  if (!reportModelText.includes(required)) {
    fail(`report model is missing ${required}`);
  }
}

const themeText = read(path.join(rendererRoot, "theme.css"));
for (const required of ["--xy-node-background-color-default", "--xy-edge-stroke-default", "--xy-background-color-default"]) {
  if (!themeText.includes(required)) {
    fail(`theme is missing React Flow token override ${required}`);
  }
}

if (!preloadText.includes("scan:output")) {
  fail("preload is missing the allowed scan:output event bridge");
}

if (/launchInWsl|child_process|execFile|spawn\(/.test(rendererText)) {
  fail("renderer appears to launch tools or child processes");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("PASS: Phase 8 security invariants hold");
