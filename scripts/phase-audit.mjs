/**
 * Phase audit is a source-backed checklist so done means mechanisms and tests
 * exist together. If exit criteria lived only in prose, a green test suite could
 * still miss an entire Phase 0 requirement.
 */
import fs from "node:fs";
import path from "node:path";

const MAX_PHASE = 1;
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
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`PASS: Phase ${requestedPhase} exit criteria map to mechanisms and tests`);
