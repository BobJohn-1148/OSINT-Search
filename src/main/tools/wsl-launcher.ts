/**
 * The WSL launcher accepts argv arrays instead of shell strings because targets
 * are user-entered investigation data. If those values were interpolated into a
 * command line, an OSINT seed could become unintended shell execution.
 */
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { ToolOutputEvent } from "../../shared/schemas/tools.js";

const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;
const BACKPRESSURE_HIGH_WATER_BYTES = 512 * 1024;
const DEFAULT_PROCESS_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_CONCURRENT_PROCESSES = 4;

export interface WslInvocation {
  readonly command: "wsl.exe";
  readonly args: readonly string[];
  readonly options: SpawnOptionsWithoutStdio & { readonly shell: false };
}

export interface WslRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type ToolOutputListener = (event: ToolOutputEvent) => void;
export type SpawnToolProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio & { readonly shell: false }
) => ChildProcessWithoutNullStreams;
export type KillProcessTree = (pid: number) => void;

export interface WslLauncherOptions {
  readonly maxConcurrentProcesses?: number;
  readonly processTimeoutMs?: number;
  readonly killProcessTree?: KillProcessTree;
}

interface QueuedWslRun {
  readonly runId: string;
  start(): void;
}

export function buildWslInvocation(wslDistro: string, argv: readonly string[]): WslInvocation {
  if (argv.length === 0) {
    throw new Error("A WSL launch requires at least one argv entry");
  }
  return {
    command: "wsl.exe",
    args: ["-d", wslDistro, "--", ...argv],
    options: { shell: false }
  };
}

export class WslToolLauncher {
  private readonly maxConcurrentProcesses: number;
  private readonly processTimeoutMs: number;
  private readonly killProcessTree: KillProcessTree;
  private activeProcesses = 0;
  private readonly processQueue: QueuedWslRun[] = [];
  private readonly runningChildren = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly runningCancels = new Map<string, () => void>();
  private readonly queuedCancels = new Map<string, () => void>();

  public constructor(
    private readonly spawnProcess: SpawnToolProcess = spawn,
    options: WslLauncherOptions = {}
  ) {
    this.maxConcurrentProcesses = options.maxConcurrentProcesses ?? DEFAULT_MAX_CONCURRENT_PROCESSES;
    this.processTimeoutMs = options.processTimeoutMs ?? DEFAULT_PROCESS_TIMEOUT_MS;
    this.killProcessTree = options.killProcessTree ?? killWindowsProcessTree;
  }

  public run(input: {
    readonly runId: string;
    readonly wslDistro: string;
    readonly argv: readonly string[];
    readonly onOutput?: ToolOutputListener;
    readonly signal?: AbortSignal;
    // Per-call override for a source-backed process that legitimately runs
    // longer than the constructor's default (e.g. Sherlock sweeping hundreds
    // of sites). Without this, every WslToolLauncher call shared one fixed
    // timeout regardless of what the caller declared it needed, so a
    // connector's own longer timeoutMs never actually reached the process.
    readonly timeoutMs?: number;
  }): Promise<WslRunResult> {
    const invocation = buildWslInvocation(input.wslDistro, input.argv);
    return this.enqueue(input.runId, input.signal, () =>
      this.runInvocation(input.runId, invocation, input.timeoutMs ?? this.processTimeoutMs, input.onOutput, input.signal)
    );
  }

  public cancel(runId: string): boolean {
    const cancelRun = this.runningCancels.get(runId);
    if (cancelRun) {
      cancelRun();
      return true;
    }
    const cancelQueuedRun = this.queuedCancels.get(runId);
    if (cancelQueuedRun) {
      cancelQueuedRun();
      return true;
    }
    return false;
  }

  public async detect(input: {
    readonly wslDistro: string;
    readonly executables: readonly { readonly toolId: string; readonly executable: string }[];
  }): Promise<readonly { readonly toolId: string; readonly installed: boolean }[]> {
    const detected: { readonly toolId: string; readonly installed: boolean }[] = [];
    for (const tool of input.executables) {
      const result = await this.run({
        runId: `detect:${tool.toolId}`,
        wslDistro: input.wslDistro,
        argv: ["which", tool.executable]
      });
      detected.push({ toolId: tool.toolId, installed: result.exitCode === 0 });
    }
    return detected;
  }

  private enqueue(runId: string, signal: AbortSignal | undefined, work: () => Promise<WslRunResult>): Promise<WslRunResult> {
    return new Promise((resolve) => {
      let canceled = false;
      const cancelQueued = (): void => {
        canceled = true;
        this.queuedCancels.delete(runId);
        this.removeQueuedRun(runId);
        resolve({ stdout: "", stderr: "Process canceled before launch.", exitCode: 1 });
      };
      if (signal?.aborted) {
        cancelQueued();
        return;
      }
      const start = (): void => {
        this.queuedCancels.delete(runId);
        if (canceled || signal?.aborted) {
          resolve({ stdout: "", stderr: "Process canceled before launch.", exitCode: 1 });
          this.drainQueue();
          return;
        }
        this.activeProcesses += 1;
        void work()
          .then(resolve)
          .finally(() => {
            this.activeProcesses -= 1;
            this.drainQueue();
          });
      };
      this.processQueue.push({ runId, start });
      this.queuedCancels.set(runId, cancelQueued);
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    while (this.activeProcesses < this.maxConcurrentProcesses && this.processQueue.length > 0) {
      const next = this.processQueue.shift();
      next?.start();
    }
  }

  private removeQueuedRun(runId: string): void {
    const index = this.processQueue.findIndex((queuedRun) => queuedRun.runId === runId);
    if (index >= 0) {
      this.processQueue.splice(index, 1);
    }
  }

  private runInvocation(
    runId: string,
    invocation: WslInvocation,
    timeoutMs: number,
    onOutput?: ToolOutputListener,
    signal?: AbortSignal
  ): Promise<WslRunResult> {
    return new Promise((resolve) => {
      let settled = false;
      let stdout = "";
      let stderr = "";
      const child = this.spawnProcess(invocation.command, invocation.args, invocation.options);
      this.runningChildren.set(runId, child);
      child.stdout.pause();
      child.stderr.pause();
      const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
      let abort = (): void => undefined;
      const settle = (exitCode: number, finalStdout: string, finalStderr: string, killTree: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutRef.current) {
          windowlessClearTimeout(timeoutRef.current);
        }
        signal?.removeEventListener("abort", abort);
        this.runningChildren.delete(runId);
        this.runningCancels.delete(runId);
        if (killTree) {
          this.terminateProcessTree(child);
        }
        resolve({ stdout: finalStdout, stderr: finalStderr, exitCode });
      };
      abort = (): void => {
        settle(1, stdout, appendCapped(stderr, "Process canceled."), true);
      };
      timeoutRef.current = windowlessSetTimeout(() => {
        settle(1, stdout, appendCapped(stderr, "Process timed out and was canceled."), true);
      }, timeoutMs);
      signal?.addEventListener("abort", abort, { once: true });
      this.runningCancels.set(runId, abort);

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stdout = appendCapped(stdout, text);
        applyBackpressure(child.stdout, stdout);
        onOutput?.({ runId, stream: "stdout", chunk: text });
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderr = appendCapped(stderr, text);
        applyBackpressure(child.stderr, stderr);
        onOutput?.({ runId, stream: "stderr", chunk: text });
      });
      child.on("error", (error) => {
        settle(1, stdout, appendCapped(stderr, error.message), false);
      });
      child.on("close", (code) => {
        settle(code ?? 1, stdout, stderr, false);
      });
      child.stdout.resume();
      child.stderr.resume();
    });
  }

  private terminateProcessTree(child: ChildProcessWithoutNullStreams): void {
    if (child.pid) {
      this.killProcessTree(child.pid);
    }
    child.kill();
  }
}

function appendCapped(existing: string, chunk: string, maxBytes = MAX_CAPTURE_BYTES): string {
  const combined = existing + chunk;
  if (Buffer.byteLength(combined, "utf8") <= maxBytes) {
    return combined;
  }
  let capped = Buffer.from(combined, "utf8").subarray(-maxBytes).toString("utf8");
  while (Buffer.byteLength(capped, "utf8") > maxBytes) {
    capped = capped.slice(1);
  }
  return capped;
}

function applyBackpressure(stream: Readable, captured: string): void {
  if (Buffer.byteLength(captured, "utf8") < BACKPRESSURE_HIGH_WATER_BYTES) {
    return;
  }
  stream.pause();
  queueMicrotask(() => stream.resume());
}

export function killWindowsProcessTree(pid: number): void {
  const killer = spawn("taskkill.exe", ["/pid", String(pid), "/t", "/f"], { shell: false, stdio: "ignore" });
  killer.on("error", () => undefined);
}

function windowlessSetTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
  return setTimeout(callback, delayMs);
}

function windowlessClearTimeout(timeout: ReturnType<typeof setTimeout>): void {
  clearTimeout(timeout);
}
