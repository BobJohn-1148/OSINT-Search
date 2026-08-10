/**
 * Security audit is deliberately narrow in Phase 0 because it checks invariants
 * that already have code. If this script pretended to validate future vault or
 * WSL behavior, later phases would inherit false confidence.
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

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("PASS: Phase 0 security invariants hold");
