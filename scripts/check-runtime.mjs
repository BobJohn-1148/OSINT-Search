/**
 * Reacher depends on four things that live outside this repo: an Ollama daemon
 * with a pulled model, a WSL distro with Sherlock in it, a Python with
 * scrapegraphai, and at least one key in the vault. When any of them is absent
 * the app degrades quietly by design -- a failed source is one red line in a list,
 * and an agent that cannot reach a model is one failed run. That is right for an
 * investigation in progress and useless for working out why nothing works, which
 * is what this doctor is for.
 *
 * Strictly read-only. It never installs, never writes, and never decrypts a
 * secret -- it counts rows in api_keys and stops there, because "is a key
 * present" is a setup question and "what is the key" is not.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OLLAMA_URL = "http://127.0.0.1:11434/api/tags";
// Kept in step with provider-adapters.ts; a mismatch here would report a healthy
// setup for a model no agent is actually pointed at.
const EXPECTED_MODEL = "llama3.1:8b";
const DEFAULT_DISTRO = "Ubuntu";
// Built rather than written as an escape: a literal NUL in the source trips
// no-control-regex and makes greps treat this file as binary.
const NUL = String.fromCharCode(0);

const results = [];

function report(name, ok, detail, fix) {
  results.push({ name, ok, detail, fix });
}

/**
 * wsl.exe answers in UTF-16LE, so a naive utf8 read produces NUL-interleaved text
 * that looks empty in a terminal. This is the same trap the Sherlock connector
 * hit; decoding here rather than guessing keeps the report readable.
 */
function runQuiet(command, args, { utf16 = false } = {}) {
  try {
    const stdout = execFileSync(command, args, {
      encoding: utf16 ? "buffer" : "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      windowsHide: true
    });
    return { ok: true, out: utf16 ? Buffer.from(stdout).toString("utf16le") : String(stdout) };
  } catch (error) {
    // Both streams, concatenated: a failing launcher writes its diagnosis to
    // stderr while stdout is an empty string, and `??` keeps that empty string --
    // which silently turned "scrapegraphai is missing" into "no Python found".
    const out = [error?.stdout, error?.stderr]
      .filter((stream) => stream !== undefined && stream !== null)
      .map((stream) => (utf16 ? Buffer.from(stream).toString("utf16le") : String(stream)))
      .join("");
    return { ok: false, out };
  }
}

async function checkOllama() {
  let payload;
  try {
    const response = await fetch(OLLAMA_URL, { signal: AbortSignal.timeout(5_000) });
    payload = await response.json();
  } catch {
    report("Ollama daemon", false, "not reachable on 127.0.0.1:11434", "winget install Ollama.Ollama  (then relaunch it)");
    report(`Ollama model ${EXPECTED_MODEL}`, false, "cannot check while the daemon is down", `ollama pull ${EXPECTED_MODEL}`);
    return;
  }

  const models = Array.isArray(payload?.models) ? payload.models.map((entry) => String(entry?.name ?? "")) : [];
  report("Ollama daemon", true, `running, ${models.length} model(s) pulled`);
  // Ollama reports "llama3.1:8b" but a bare "ollama pull llama3.1" lands as
  // "llama3.1:latest", so match the family rather than only the exact tag.
  const matched = models.find((name) => name === EXPECTED_MODEL || name.startsWith(`${EXPECTED_MODEL.split(":")[0]}:`));
  report(
    `Ollama model ${EXPECTED_MODEL}`,
    Boolean(matched),
    matched ? `found ${matched}` : `not pulled (have: ${models.join(", ") || "none"})`,
    `ollama pull ${EXPECTED_MODEL}`
  );
}

function checkWsl() {
  const list = runQuiet("wsl.exe", ["-l", "-q"], { utf16: true });
  const distros = list.out
    .split(/\r?\n/)
    .map((line) => line.split(NUL).join("").trim())
    .filter((line) => line.length > 0);

  if (!list.ok || distros.length === 0) {
    report("WSL", false, "no distro installed", "wsl --install -d Ubuntu   (needs admin, reboots partway)");
    report("Sherlock (in WSL)", false, "cannot check without a distro", "pipx install sherlock-project");
    return;
  }

  report("WSL", true, `distro(s): ${distros.join(", ")}`);
  const distro = distros.includes(DEFAULT_DISTRO) ? DEFAULT_DISTRO : distros[0];
  const which = runQuiet("wsl.exe", ["-d", distro, "--", "which", "sherlock"]);
  const found = which.ok && which.out.trim().length > 0;
  report(
    "Sherlock (in WSL)",
    found,
    found ? which.out.trim() : `not on PATH in ${distro}`,
    `wsl -d ${distro} -- pipx install sherlock-project`
  );
}

function checkPython() {
  const candidates = [
    ["py", ["-3", "-c", "import scrapegraphai"]],
    ["python3", ["-c", "import scrapegraphai"]]
  ];
  for (const [command, args] of candidates) {
    const probe = runQuiet(command, args);
    if (probe.ok) {
      report("Python + scrapegraphai", true, `importable via ${command}`);
      return;
    }
    // A launcher that exists but cannot import means Python is fine and the
    // package is not -- worth distinguishing, since the fix differs.
    if (/ModuleNotFoundError|No module named/i.test(probe.out)) {
      report(
        "Python + scrapegraphai",
        false,
        `${command} works but scrapegraphai is not installed`,
        `${command} ${args[0] === "-3" ? "-3 " : ""}-m pip install -r requirements-scrapegraph.txt`
      );
      return;
    }
  }
  report("Python + scrapegraphai", false, "no usable Python found", "install Python 3, then: py -3 -m pip install -r requirements-scrapegraph.txt");
}

function checkVault() {
  const dbPath = path.join(process.env.APPDATA ?? "", "reacher", "reacher.sqlite");
  if (!fs.existsSync(dbPath)) {
    report("API keys in vault", false, "no local database yet -- launch Reacher once", "npm start");
    return;
  }
  // Count only. Reading a ciphertext column here would put a secret in a script
  // that exists to be run and pasted into chat.
  const probe = runQuiet(process.execPath, [
    "-e",
    `const D=require("better-sqlite3");const d=new D(process.argv[1],{readonly:true});` +
      `console.log(d.prepare("SELECT source FROM api_keys ORDER BY source").all().map(r=>r.source).join(","));d.close();`,
    dbPath
  ]);
  if (!probe.ok) {
    report("API keys in vault", false, "could not read the local database", "launch Reacher once, then re-run");
    return;
  }
  const sources = probe.out.trim().split(",").filter(Boolean);
  report(
    "API keys in vault",
    sources.length > 0,
    sources.length > 0 ? sources.join(", ") : "none stored",
    "add keys in Reacher: Settings -> API keys (openai enables ScrapeGraph, anthropic enables ripper-agent)"
  );
}

await checkOllama();
checkWsl();
checkPython();
checkVault();

const width = Math.max(...results.map((entry) => entry.name.length));
console.log("\nReacher runtime dependencies\n");
for (const entry of results) {
  console.log(`  ${entry.ok ? "OK  " : "MISS"} ${entry.name.padEnd(width)}  ${entry.detail}`);
  if (!entry.ok && entry.fix) {
    console.log(`       ${" ".repeat(width)}  fix: ${entry.fix}`);
  }
}

const missing = results.filter((entry) => !entry.ok);
console.log(
  missing.length === 0
    ? "\nAll runtime dependencies present.\n"
    : `\n${missing.length} missing. Run scripts/setup-runtime.ps1 from an elevated PowerShell to install them.\n`
);
// Deliberately exit 0 even with gaps: this is a report, and a non-zero exit would
// make it unusable inside npm scripts that chain other checks.
