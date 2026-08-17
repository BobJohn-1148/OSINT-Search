import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ObservationInput, SearchSeed } from "../../shared/types/search.js";

export interface ScrapeGraphWorkerInput {
  readonly seed: SearchSeed;
}

export interface ScrapeGraphWorkerObservation {
  readonly entity?: string;
  readonly type?: string;
  readonly value?: string;
  readonly evidence?: string;
  readonly confidence?: number;
  readonly source_url?: string;
}

export interface ScrapeGraphWorkerOutput {
  readonly observations?: readonly ScrapeGraphWorkerObservation[];
  readonly source_url?: string;
  readonly summary?: string;
}

export async function runScrapeGraphWorker(
  input: ScrapeGraphWorkerInput,
  signal?: AbortSignal
): Promise<ScrapeGraphWorkerOutput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured for ScrapeGraph");
  }

  const workerPath = resolveWorkerPath();
  const { command, argsPrefix } = resolvePythonCommand();
  const child = spawn(command, [...argsPrefix, workerPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SCRAPEGRAPHAI_TELEMETRY_ENABLED: process.env.SCRAPEGRAPHAI_TELEMETRY_ENABLED ?? "false"
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

  const abortChild = (): void => {
    child.kill();
  };
  if (signal?.aborted) {
    abortChild();
  } else {
    signal?.addEventListener("abort", abortChild, { once: true });
  }

  child.stdin.end(`${JSON.stringify(input)}\n`);

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  }).finally(() => signal?.removeEventListener("abort", abortChild));

  const output = Buffer.concat(stdout).toString("utf8").trim();
  if (exitCode !== 0) {
    const detail = sanitizeWorkerError(Buffer.concat(stderr).toString("utf8"));
    throw new Error(detail || `ScrapeGraph worker exited with code ${exitCode ?? "unknown"}`);
  }

  return parseWorkerOutput(output);
}

export function normalizeScrapeGraphObservations(
  seed: SearchSeed,
  output: ScrapeGraphWorkerOutput,
  sourceId: string
): ObservationInput[] {
  const sourceUrl = output.source_url;
  const observations = (output.observations ?? [])
    .map((entry) => normalizeWorkerObservation(seed, entry, sourceId, sourceUrl))
    .filter((entry): entry is ObservationInput => entry !== null);

  if (observations.length === 0 && output.summary) {
    observations.push({
      entity: seed.value,
      type: "scrapegraph-summary",
      value: output.summary,
      source: sourceId,
      raw: { sourceUrl }
    });
  }

  return dedupeObservations(observations).slice(0, 25);
}

function normalizeWorkerObservation(
  seed: SearchSeed,
  entry: ScrapeGraphWorkerObservation,
  sourceId: string,
  sourceUrl: string | undefined
): ObservationInput | null {
  const value = cleanText(entry.value);
  if (value === null) {
    return null;
  }

  return {
    entity: cleanText(entry.entity) ?? seed.value,
    type: cleanText(entry.type) ?? "scrapegraph-fact",
    value,
    source: sourceId,
    raw: {
      evidence: cleanText(entry.evidence),
      confidence: entry.confidence,
      sourceUrl: cleanText(entry.source_url) ?? sourceUrl
    }
  };
}

function resolveWorkerPath(): string {
  if (process.env.SCRAPEGRAPH_WORKER_PATH) {
    return process.env.SCRAPEGRAPH_WORKER_PATH;
  }

  const workspacePath = path.resolve(process.cwd(), "scripts", "scrapegraph-osint.py");
  if (existsSync(workspacePath)) {
    return workspacePath;
  }

  const resourcesPath = (process as NodeJS.Process & { readonly resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    return path.join(resourcesPath, "scripts", "scrapegraph-osint.py");
  }

  return workspacePath;
}

function resolvePythonCommand(): { readonly command: string; readonly argsPrefix: readonly string[] } {
  const configured = process.env.SCRAPEGRAPH_PYTHON;
  if (configured) {
    return { command: configured, argsPrefix: [] };
  }

  const localVenvPython =
    process.platform === "win32"
      ? path.resolve(process.cwd(), ".venv", "Scripts", "python.exe")
      : path.resolve(process.cwd(), ".venv", "bin", "python");
  if (existsSync(localVenvPython)) {
    return { command: localVenvPython, argsPrefix: [] };
  }

  if (process.platform === "win32") {
    return { command: "py", argsPrefix: ["-3"] };
  }
  return { command: "python3", argsPrefix: [] };
}

function parseWorkerOutput(output: string): ScrapeGraphWorkerOutput {
  if (!output) {
    throw new Error("ScrapeGraph worker returned no output");
  }

  const parsed = JSON.parse(output) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("ScrapeGraph worker returned an invalid response");
  }

  return {
    observations: parseObservationArray(parsed.observations),
    source_url: stringFromUnknown(parsed.source_url),
    summary: stringFromUnknown(parsed.summary)
  };
}

function parseObservationArray(value: unknown): ScrapeGraphWorkerObservation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((entry) => ({
    entity: stringFromUnknown(entry.entity),
    type: stringFromUnknown(entry.type),
    value: stringFromUnknown(entry.value),
    evidence: stringFromUnknown(entry.evidence),
    confidence: numberFromUnknown(entry.confidence),
    source_url: stringFromUnknown(entry.source_url)
  }));
}

function sanitizeWorkerError(errorOutput: string): string {
  if (/insufficient_quota|current quota|billing quota|run out of credits|no balance left/i.test(errorOutput)) {
    return "OpenAI quota is exhausted for ScrapeGraph. Add API credits or raise the project usage limit.";
  }

  const lastLine = errorOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
  if (!lastLine) {
    return "";
  }
  return lastLine.replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]");
}

function cleanText(value: unknown): string | null {
  const text = stringFromUnknown(value)?.trim();
  return text ? text.slice(0, 500) : null;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dedupeObservations(observations: readonly ObservationInput[]): ObservationInput[] {
  const seen = new Set<string>();
  return observations.filter((entry) => {
    const key = `${entry.entity}\u0000${entry.type}\u0000${entry.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
