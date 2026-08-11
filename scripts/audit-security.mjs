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

const analyzerServiceText = read(path.join(srcRoot, "main", "analyzers", "analyzers-service.ts"));
for (const required of ["wevtutil.exe", "shell: false", "buildTsharkArgv", "parseEvtxXml", "parseTsharkJson", "fetchNvdVulnerabilities", "casesRepository.addItem", "auditRepository.record", "MAX_EVTX_CAPTURE_BYTES", "Process timed out and was canceled", "killWindowsProcessTree", ".pause()", ".resume()"]) {
  if (!analyzerServiceText.includes(required)) {
    fail(`analyzer service is missing ${required}`);
  }
}

const pcapParserText = read(path.join(srcRoot, "main", "analyzers", "pcap-parser.ts"));
for (const required of ["buildTsharkArgv", "\"tshark\"", "\"-r\"", "\"-T\"", "parseTsharkJson"]) {
  if (!pcapParserText.includes(required)) {
    fail(`PCAP parser is missing ${required}`);
  }
}

if (pcapParserText.includes("\"-i\"") || pcapParserText.includes("dumpcap")) {
  fail("PCAP analyzer exposes a live capture path");
}

const macLookupText = read(path.join(srcRoot, "main", "analyzers", "mac-lookup.ts"));
const ouiText = read(path.join(srcRoot, "main", "analyzers", "oui-data.ts"));
const generatedOuiText = read(path.join(srcRoot, "main", "analyzers", "oui-data.generated.ts"));
if (!macLookupText.includes("offlineOuiVendors") || !ouiText.includes("offlineOuiVendors") || !generatedOuiText.includes("Generated IEEE OUI vendors")) {
  fail("MAC analyzer is missing bundled offline OUI lookup");
}

if ((generatedOuiText.match(/": "/g) ?? []).length < 1000) {
  fail("bundled OUI lookup table is too small to represent the IEEE offline database");
}

const vulnLookupText = read(path.join(srcRoot, "main", "analyzers", "vulnerability-lookup.ts"));
if (!vulnLookupText.includes("NVD response missing vulnerabilities")) {
  fail("vulnerability parser does not fail closed on invalid NVD responses");
}

const vulnRepositoryText = read(path.join(srcRoot, "db", "repositories", "analyzers-repository.ts"));
for (const required of ["readVulnCache", "writeVulnCache", "vuln_cache"]) {
  if (!vulnRepositoryText.includes(required)) {
    fail(`analyzers repository is missing ${required}`);
  }
}

const analyzerMigrationText = read(path.join(srcRoot, "db", "migrations", "013-analyzers.ts"));
for (const required of ["evtx_imports", "pcap_imports", "vuln_cache", "STRICT"]) {
  if (!analyzerMigrationText.includes(required)) {
    fail(`analyzers migration is missing ${required}`);
  }
}

const monitoringServiceText = read(path.join(srcRoot, "main", "monitoring", "monitoring-service.ts"));
for (const required of ["vaultRepository.has", "vaultRepository.readSecret", "casesRepository.addItem", "searchRepository.saveRun", "createAlert", "runDueRechecks", "setInterval", "auditRepository.record"]) {
  if (!monitoringServiceText.includes(required)) {
    fail(`monitoring service is missing ${required}`);
  }
}

const credentialSourcesText = read(path.join(srcRoot, "main", "monitoring", "credential-sources.ts"));
for (const required of ["xposedornot", "requiresKey: true", "hibp", "leakcheck", "dehashed"]) {
  if (!credentialSourcesText.includes(required)) {
    fail(`credential sources are missing ${required}`);
  }
}

const monitoringMigrationText = read(path.join(srcRoot, "db", "migrations", "014-monitoring.ts"));
for (const required of ["watchlist", "exposures", "monitoring_alerts", "STRICT", "UNIQUE (watch_id, source, fingerprint)", "exposures_no_delete", "monitoring_alerts_no_delete", "ON DELETE RESTRICT"]) {
  if (!monitoringMigrationText.includes(required)) {
    fail(`monitoring migration is missing ${required}`);
  }
}

const imageUsernameText = read(path.join(srcRoot, "main", "image-username", "image-username-service.ts"));
for (const required of ["browserImageSearch", "https://lens.google.com", "https://yandex.com/images/search", "vaultRepository.has", "vaultRepository.readSecret", "openweb-ninja", "bright-data", "[\"maigret\", request.username, \"--json\", \"-\"]", "[\"blackbird\", \"-u\", request.username, \"--json\"]", "agentRuntimeService.run", "searchRepository.saveRun", "casesRepository.addItem", "auditRepository.record"]) {
  if (!imageUsernameText.includes(required)) {
    fail(`image username service is missing ${required}`);
  }
}

if (!ipcText.includes("system:pickImage")) {
  fail("IPC registry is missing main-process image picker channel");
}

const imageMigrationText = read(path.join(srcRoot, "db", "migrations", "015-image-username.ts"));
for (const required of ["image_searches", "STRICT"]) {
  if (!imageMigrationText.includes(required)) {
    fail(`image username migration is missing ${required}`);
  }
}

const dashboardServiceText = read(path.join(srcRoot, "main", "dashboard", "dashboard-service.ts"));
for (const required of ["summary()", "agentRuntimeService.states", "auditRepository.list"]) {
  if (!dashboardServiceText.includes(required)) {
    fail(`dashboard service is missing ${required}`);
  }
}

const dashboardRepositoryText = read(path.join(srcRoot, "db", "repositories", "dashboard-repository.ts"));
for (const required of ["activeCases", "recentSearches", "recentAgentRuns", "watchAlerts"]) {
  if (!dashboardRepositoryText.includes(required)) {
    fail(`dashboard repository is missing ${required}`);
  }
}

const auditRepositoryText = read(path.join(srcRoot, "db", "repositories", "audit-repository.ts"));
for (const required of ["public query", "object_id LIKE", "detail LIKE", "ts >=", "ts <="]) {
  if (!auditRepositoryText.includes(required)) {
    fail(`audit repository filtered query is missing ${required}`);
  }
}

for (const required of ["dashboard:summary", "audit:query", "mutates: false"]) {
  if (!ipcText.includes(required)) {
    fail(`IPC registry is missing Phase 12 read-only channel metadata ${required}`);
  }
}

const packageJsonText = read(path.join(repoRoot, "package.json"));
for (const required of ["electron-builder", "package:dir", "package:win", "reacher-icon.ico"]) {
  if (!packageJsonText.includes(required)) {
    fail(`packaging config is missing ${required}`);
  }
}

if (!fs.existsSync(path.join(repoRoot, "assets", "brand", "reacher-icon.ico"))) {
  fail("Reacher Windows icon is missing");
}

const expansionMigrationText = read(path.join(srcRoot, "db", "migrations", "016-tools-mobile-social.ts"));
for (const required of ["nuclei", "hashcat", "volatility3", "juice-shop-lab", "adb", "libimobiledevice", "\"active\""]) {
  if (!expansionMigrationText.includes(required)) {
    fail(`tools mobile social migration is missing ${required}`);
  }
}

const mobileServiceText = read(path.join(srcRoot, "main", "mobile", "mobile-service.ts"));
for (const required of ["execFile", "shell: false", "[\"devices\", \"-l\"]", "[\"-l\"]", "unavailableTools"]) {
  if (!mobileServiceText.includes(required)) {
    fail(`mobile service is missing ${required}`);
  }
}

const socialServiceText = read(path.join(srcRoot, "main", "social", "social-analyzer-service.ts"));
const socialCatalogText = read(path.join(srcRoot, "main", "social", "social-network-catalog.generated.ts"));
for (const required of ["status: \"candidate\"", "recommendedTools"]) {
  if (!socialServiceText.includes(required)) {
    fail(`social analyzer service is missing ${required}`);
  }
}
if ((socialCatalogText.match(/"name":/g) ?? []).length < 300) {
  fail("social analyzer catalog has fewer than 300 networks");
}

for (const disallowed of ["AmsiScanBuffer", "EtwEventWrite", "Cobalt Stager", "Sliver stager", "shellcode wrapper", "reverse shell generator"]) {
  if (sourceText.toLowerCase().includes(disallowed.toLowerCase())) {
    fail(`source contains disallowed payload or evasion generator term: ${disallowed}`);
  }
}

if (/launchInWsl|child_process|execFile|spawn\(/.test(rendererText)) {
  fail("renderer appears to launch tools or child processes");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("PASS: Phase 13 security invariants hold");
