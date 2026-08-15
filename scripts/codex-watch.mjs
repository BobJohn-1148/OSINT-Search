/**
 * Codex-to-Claude handoff watcher.
 *
 * Jack runs Codex (VS Code extension) and Claude Code side by side on this
 * repo. When a Codex turn finishes and nothing follows it up, that context
 * would otherwise sit idle until Jack manually copies Codex's last message
 * into a Claude prompt. This script closes that gap: it tails Codex's own
 * session transcripts (~/.codex/sessions/**\/*.jsonl, one line per event —
 * this is Codex's native log, not something we invented) for a
 * `task_complete` event whose session `cwd` matches this repo, waits out a
 * grace window in case Codex immediately starts another turn, and if it
 * stays quiet, launches `claude -p` headless with Codex's last message as
 * the handoff brief so work continues without Jack in the loop.
 *
 * Rejected alternative: Codex's `config.toml` supports a `notify` program
 * invoked on turn completion, which would be push- rather than poll-based.
 * It is undocumented for the `codex_vscode` originator this install uses
 * (session_meta shows Jack is running the VS Code extension, not the CLI),
 * so wiring it would be relying on unverified behavior. Polling the
 * transcript files is slower but works identically regardless of which
 * Codex surface wrote them.
 *
 * SAFETY: the launched `claude -p` run uses `--permission-mode
 * bypassPermissions` — no confirmation prompts, no human review before
 * edits land on the current branch. That is what "auto-continue, headless"
 * means. Every run is still logged in full under .codex-watch/logs/ so
 * there is an audit trail, matching the project's append-only-audit-log
 * principle, but nothing blocks the run itself. Ctrl+C this script to stop
 * watching; it never touches the repo directly, only the child it spawns.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const REPO_ROOT = process.cwd();
const SESSIONS_DIR = path.join(os.homedir(), ".codex", "sessions");
const LOG_DIR = path.join(REPO_ROOT, ".codex-watch", "logs");

const POLL_INTERVAL_MS = 3000;
const IDLE_GRACE_MS = 12000; // wait this long after task_complete before assuming Codex is done, not just between turns

function normalize(p) {
  return path.resolve(p).toLowerCase().replace(/\\/g, "/");
}

const REPO_KEY = normalize(REPO_ROOT);

function listRolloutFiles() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(full);
    }
  };
  walk(SESSIONS_DIR);
  return out;
}

function readSessionCwd(filePath) {
  // session_meta is always the first line of a rollout file, so a small
  // read is enough — no need to parse the whole transcript just to filter.
  // We deliberately do NOT JSON.parse the line: session_meta embeds Codex's
  // full base_instructions system prompt (tens of KB) inline, so any bounded
  // read truncates mid-object and JSON.parse throws on the partial line.
  // The "cwd" field appears near the start of the payload regardless, so a
  // regex over a small prefix finds it without reading or parsing the rest.
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(8192);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    const text = buf.toString("utf8", 0, bytes);
    const match = text.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
    if (!match) return null;
    return JSON.parse(`"${match[1]}"`); // reuse JSON's own escape handling for the Windows backslashes
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function findActiveRolloutForRepo() {
  const candidates = listRolloutFiles()
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { f } of candidates) {
    const cwd = readSessionCwd(f);
    if (cwd && normalize(cwd) === REPO_KEY) return f;
  }
  return null;
}

/** Tracks byte offset already consumed per rollout file, so we tail rather than reread. */
const offsets = new Map();
let watchedFile = null;
let pendingIdleTimer = null;
let handoffInFlight = false;
const handledTurnIds = new Set();

function readNewLines(filePath) {
  const size = fs.statSync(filePath).size;
  const start = offsets.get(filePath) ?? 0;
  if (size <= start) {
    offsets.set(filePath, size); // file truncated/rotated under us; resync rather than error
    return [];
  }
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);
  offsets.set(filePath, size);
  return buf
    .toString("utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
}

function cancelPendingIdle(reason) {
  if (pendingIdleTimer) {
    clearTimeout(pendingIdleTimer);
    pendingIdleTimer = null;
    console.log(`[codex-watch] idle countdown cancelled: ${reason}`);
  }
}

function scheduleIdleCheck(taskCompletePayload) {
  cancelPendingIdle("newer task_complete superseded the pending one");
  pendingIdleTimer = setTimeout(() => {
    pendingIdleTimer = null;
    triggerHandoff(taskCompletePayload);
  }, IDLE_GRACE_MS);
  console.log(
    `[codex-watch] Codex turn ${taskCompletePayload.turn_id} finished; waiting ${IDLE_GRACE_MS / 1000}s to see if it keeps going`
  );
}

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function triggerHandoff(taskCompletePayload) {
  if (handoffInFlight) {
    console.log("[codex-watch] a handoff run is already in progress; skipping this trigger");
    return;
  }
  if (handledTurnIds.has(taskCompletePayload.turn_id)) return;
  handledTurnIds.add(taskCompletePayload.turn_id);

  const lastMessage = taskCompletePayload.last_agent_message || "(Codex's last turn had no message body.)";
  const prompt = [
    "Codex just went idle in this repo (no follow-up turn within the grace window).",
    "Pick up exactly where it left off. Codex's last message was:",
    "",
    "---",
    lastMessage,
    "---",
    "",
    "Before continuing: read CLAUDE.md, check `git status`/`git diff` for what Codex actually",
    "changed (its message may describe intent that isn't fully reflected on disk), and reconcile",
    "the two. Continue the work to completion — do not stop at a partial fix. Before considering",
    "it done, run the project's verification commands (npm run typecheck, npm run lint, npm test,",
    "npm run verify, npm run audit:security, node scripts/phase-audit.mjs 8) and report actual",
    "pass/fail output, not an assumption that it passed.",
  ].join("\n");

  ensureLogDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(LOG_DIR, `handoff-${stamp}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`# Codex handoff triggered ${new Date().toISOString()}\n# turn_id: ${taskCompletePayload.turn_id}\n\n--- PROMPT ---\n${prompt}\n\n--- CLAUDE OUTPUT ---\n`);

  console.log(`[codex-watch] launching headless claude -p, logging to ${logPath}`);
  handoffInFlight = true;

  const child = spawn("claude", ["-p", prompt, "--permission-mode", "bypassPermissions"], {
    cwd: REPO_ROOT,
    shell: true, // resolves claude.ps1/claude.cmd on Windows the same way a manual invocation would
  });

  child.stdout.on("data", (d) => logStream.write(d));
  child.stderr.on("data", (d) => logStream.write(d));
  child.on("close", (code) => {
    logStream.write(`\n\n# exited with code ${code}\n`);
    logStream.end();
    handoffInFlight = false;
    console.log(`[codex-watch] handoff run finished (exit ${code}). Full transcript: ${logPath}`);
  });
  child.on("error", (err) => {
    logStream.write(`\n\n# failed to launch: ${err.message}\n`);
    logStream.end();
    handoffInFlight = false;
    console.error(`[codex-watch] failed to launch claude: ${err.message}`);
  });
}

function processLines(lines) {
  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // partial line from a mid-write read; next poll will pick up the completed one
    }
    if (event.type !== "event_msg") continue;
    const payload = event.payload;
    if (payload.type === "task_started") {
      cancelPendingIdle("Codex started a new turn");
    } else if (payload.type === "task_complete") {
      scheduleIdleCheck(payload);
    }
  }
}

function poll() {
  const active = findActiveRolloutForRepo();
  if (!active) return;
  if (active !== watchedFile) {
    console.log(`[codex-watch] watching ${active}`);
    watchedFile = active;
    // Start from the current end of file: we only want to react to activity
    // from here forward, not replay a session's entire history on attach.
    offsets.set(active, fs.statSync(active).size);
  }
  const newLines = readNewLines(active);
  if (newLines.length > 0) processLines(newLines);
}

console.log(`[codex-watch] repo: ${REPO_ROOT}`);
console.log(`[codex-watch] watching for Codex sessions under: ${SESSIONS_DIR}`);
console.log(`[codex-watch] idle grace period: ${IDLE_GRACE_MS / 1000}s, poll interval: ${POLL_INTERVAL_MS / 1000}s`);
console.log("[codex-watch] press Ctrl+C to stop\n");

setInterval(poll, POLL_INTERVAL_MS);
poll();
