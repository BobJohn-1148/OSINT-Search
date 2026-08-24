/**
 * WSL launcher tests target command construction because that is where user
 * input either remains argv data or becomes a shell hazard. If this regresses,
 * service tests can still pass while launch safety is already broken.
 */
import { buildWslInvocation } from "../../src/main/tools/wsl-launcher";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { WslToolLauncher } from "../../src/main/tools/wsl-launcher";

it("launcher builds a fixed argv and never invokes a shell so WSL input is injection inert", () => {
  const invocation = buildWslInvocation("Ubuntu", ["sherlock", "alice; rm -rf /"]);

  expect(invocation.command).toBe("wsl.exe");
  expect(invocation.args).toEqual(["-d", "Ubuntu", "--", "sherlock", "alice; rm -rf /"]);
  expect(invocation.options.shell).toBe(false);
});

it("launcher queues WSL processes so only the configured number runs at once", async () => {
  const children: FakeChildProcess[] = [];
  const launcher = new WslToolLauncher(
    () => {
      const child = createFakeChild(100 + children.length);
      children.push(child);
      return child;
    },
    { maxConcurrentProcesses: 1, processTimeoutMs: 60_000 }
  );

  const first = launcher.run({ runId: "one", wslDistro: "Ubuntu", argv: ["sherlock", "alice"] });
  const second = launcher.run({ runId: "two", wslDistro: "Ubuntu", argv: ["maigret", "bob"] });

  await Promise.resolve();
  expect(children).toHaveLength(1);
  children[0].emit("close", 0);
  await first;
  await Promise.resolve();
  expect(children).toHaveLength(2);
  children[1].emit("close", 0);
  await second;
});

it("launcher cancels queued WSL processes before they spawn so cancel stops the queue", async () => {
  const children: FakeChildProcess[] = [];
  const launcher = new WslToolLauncher(
    () => {
      const child = createFakeChild(200 + children.length);
      children.push(child);
      return child;
    },
    { maxConcurrentProcesses: 1, processTimeoutMs: 60_000 }
  );

  const first = launcher.run({ runId: "one", wslDistro: "Ubuntu", argv: ["sherlock", "alice"] });
  const second = launcher.run({ runId: "two", wslDistro: "Ubuntu", argv: ["maigret", "bob"] });
  await Promise.resolve();
  expect(launcher.cancel("two")).toBe(true);
  const canceled = await second;
  children[0].emit("close", 0);
  await first;

  expect(canceled.stderr).toContain("canceled before launch");
  expect(children).toHaveLength(1);
});

it("launcher does not spawn when an abort signal is already canceled", async () => {
  const controller = new AbortController();
  controller.abort();
  const launcher = new WslToolLauncher(() => createFakeChild(321), { processTimeoutMs: 60_000 });

  const result = await launcher.run({
    runId: "already-aborted",
    wslDistro: "Ubuntu",
    argv: ["sherlock", "alice"],
    signal: controller.signal
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("canceled before launch");
});

it("launcher times out and kills the process tree so stuck WSL children do not survive", async () => {
  const killed: number[] = [];
  const launcher = new WslToolLauncher(
    () => createFakeChild(123),
    { processTimeoutMs: 1, killProcessTree: (pid) => killed.push(pid) }
  );

  const result = await launcher.run({ runId: "timeout", wslDistro: "Ubuntu", argv: ["sherlock", "alice"] });

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("timed out");
  expect(killed).toEqual([123]);
});

it("a per-call timeoutMs overrides the constructor default, so a connector's own longer timeout actually reaches the process", async () => {
  // Sherlock declared timeoutMs: 180_000 to the orchestrator but never passed
  // it to launcher.run(), so every WSL call still died at the launcher's
  // fixed 60s default regardless of what the caller asked for. This proves
  // the fix: a short constructor default does not fire early when the call
  // itself asks for a longer one.
  const killed: number[] = [];
  const children: FakeChildProcess[] = [];
  const launcher = new WslToolLauncher(
    () => {
      const child = createFakeChild(456);
      children.push(child);
      return child;
    },
    { processTimeoutMs: 1, killProcessTree: (pid) => killed.push(pid) }
  );

  const run = launcher.run({ runId: "long-call", wslDistro: "Ubuntu", argv: ["sherlock", "alice"], timeoutMs: 60_000 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(killed).toEqual([]);

  children[0].emit("close", 0);
  const result = await run;
  expect(result.exitCode).toBe(0);
  expect(killed).toEqual([]);
});

it("a per-call timeoutMs shorter than the constructor default fires on schedule", async () => {
  const killed: number[] = [];
  const launcher = new WslToolLauncher(
    () => createFakeChild(789),
    { processTimeoutMs: 60_000, killProcessTree: (pid) => killed.push(pid) }
  );

  const result = await launcher.run({ runId: "short-call", wslDistro: "Ubuntu", argv: ["sherlock", "alice"], timeoutMs: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("timed out");
  expect(killed).toEqual([789]);
});

it("launcher cancel kills the process tree and resolves the run", async () => {
  const killed: number[] = [];
  const child = createFakeChild(456);
  const launcher = new WslToolLauncher(
    () => child,
    { processTimeoutMs: 60_000, killProcessTree: (pid) => killed.push(pid) }
  );

  const run = launcher.run({ runId: "cancel-me", wslDistro: "Ubuntu", argv: ["sherlock", "alice"] });
  await Promise.resolve();
  expect(launcher.cancel("cancel-me")).toBe(true);
  const result = await run;

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("canceled");
  expect(killed).toEqual([456]);
});

it("launcher caps multibyte output by bytes and pauses and resumes fast streams", async () => {
  const child = createFakeChild(789);
  const pause = vi.spyOn(child.stdout, "pause");
  const resume = vi.spyOn(child.stdout, "resume");
  const launcher = new WslToolLauncher(() => child, { processTimeoutMs: 60_000 });
  const run = launcher.run({ runId: "big-output", wslDistro: "Ubuntu", argv: ["sherlock", "alice"] });
  await Promise.resolve();

  child.stdout.emit("data", Buffer.from("あ".repeat(2_000_000)));
  child.emit("close", 0);
  const result = await run;

  expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(5 * 1024 * 1024);
  expect(pause).toHaveBeenCalled();
  expect(resume).toHaveBeenCalled();
});

type FakeChildProcess = ChildProcessWithoutNullStreams & EventEmitter;

function createFakeChild(pid: number): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
  Object.assign(child, {
    pid,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true)
  });
  return child;
}
