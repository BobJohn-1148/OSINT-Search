/**
 * Sherlock is the first search source that launches a process rather than making
 * an HTTP call, so these tests guard the two things that only matter for that
 * shape: the seed stays argv data instead of becoming shell input, and a profile
 * URL split across two stdout chunks is still captured. A parser that silently
 * drops the last hit would look like an unused handle rather than a bug.
 */
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createSherlockConnector, sherlockArgv } from "../../src/main/search/connectors/sherlock-connector";
import { buildWslInvocation, WslToolLauncher } from "../../src/main/tools/wsl-launcher";
import { fetchJson } from "../../src/main/search/http";

/**
 * The launcher's own type says stdout is a read-only stream, which is true for a
 * real child but useless for a double that has to script output. The fake keeps
 * the writable PassThrough type and is narrowed at the spawn boundary only.
 */
interface FakeChildProcess extends EventEmitter {
  pid: number;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: () => boolean;
}

function createFakeChild(): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
  Object.assign(child, {
    pid: 4242,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true)
  });
  return child;
}

/** Runs the connector against a scripted stdout script and returns its output. */
function runSherlock(username: string, write: (child: FakeChildProcess) => void) {
  const launcher = new WslToolLauncher(
    () => {
      const child = createFakeChild();
      // The launcher pauses the streams until it has attached its listeners, so
      // the scripted output has to wait a tick or it is written into the void.
      setTimeout(() => write(child), 0);
      return child as unknown as ChildProcessWithoutNullStreams;
    },
    { processTimeoutMs: 5_000 }
  );
  const connector = createSherlockConnector(launcher, () => "Ubuntu");
  return connector.run({ type: "username", value: username }, { fetchJson });
}

it("keeps the username as its own argv element so a seed with shell metacharacters stays inert data", () => {
  const argv = sherlockArgv("alice; rm -rf /", "/tmp/reacher-sherlock/1");

  expect(argv).toEqual([
    "sherlock",
    "alice; rm -rf /",
    "--print-found",
    "--timeout",
    "20",
    "--csv",
    "--folderoutput",
    "/tmp/reacher-sherlock/1"
  ]);
  const invocation = buildWslInvocation("Ubuntu", argv);
  expect(invocation.args[4]).toBe("alice; rm -rf /");
  expect(invocation.options.shell).toBe(false);
});

it("declares a timeout long enough for a full sweep, because the 60s HTTP default would abort every run", () => {
  const connector = createSherlockConnector(
    new WslToolLauncher(() => createFakeChild() as unknown as ChildProcessWithoutNullStreams),
    () => "Ubuntu"
  );

  expect(connector.timeoutMs).toBeGreaterThan(60_000);
  expect(connector.supports("username")).toBe(true);
  expect(connector.supports("domain")).toBe(false);
});

it("parses found lines into profile observations and ignores everything else sherlock prints", async () => {
  const observations = await runSherlock("jdoe", (child) => {
    child.stdout.write("[*] Checking username jdoe on:\n");
    child.stdout.write("[+] GitHub: https://github.com/jdoe\n");
    child.stdout.write("[-] Twitter: Not Found!\n");
    child.stdout.write("[+] Reddit: https://reddit.com/user/jdoe\n");
    child.emit("close", 0);
  });

  expect(observations).toEqual([
    {
      entity: "username:jdoe",
      type: "profile",
      value: "https://github.com/jdoe",
      source: "sherlock",
      raw: { site: "GitHub", lookupUrl: "https://github.com/jdoe" }
    },
    {
      entity: "username:jdoe",
      type: "profile",
      value: "https://reddit.com/user/jdoe",
      source: "sherlock",
      raw: { site: "Reddit", lookupUrl: "https://reddit.com/user/jdoe" }
    }
  ]);
});

it("captures a hit whose line arrives split across two stdout chunks", async () => {
  const observations = await runSherlock("jdoe", (child) => {
    child.stdout.write("[+] GitHub: https://git");
    child.stdout.write("hub.com/jdoe\n[+] Keybase: https://keybase.io/jdoe");
    child.emit("close", 0);
  });

  expect(observations.map((observation) => observation.value)).toEqual([
    "https://github.com/jdoe",
    "https://keybase.io/jdoe"
  ]);
});

it("keeps results from a non-zero exit, because sherlock exits non-zero on partial site failures", async () => {
  const observations = await runSherlock("jdoe", (child) => {
    child.stdout.write("[+] GitHub: https://github.com/jdoe\n");
    child.emit("close", 1);
  });

  expect(observations).toHaveLength(1);
});

it("surfaces wsl.exe's own UTF-16 diagnostics, which decode to invisible NULs and would otherwise show a blank failure", async () => {
  // Exactly what wsl.exe emits on a machine with no distro installed: UTF-16LE
  // bytes that the launcher decodes as UTF-8. Before the strip this reached the
  // source list as an empty error, which reads as "Sherlock broke" rather than
  // "you have no WSL".
  const utf16Diagnostics = Buffer.from("The Windows Subsystem for Linux is not installed.", "utf16le").toString("utf8");

  await expect(
    runSherlock("jdoe", (child) => {
      // Both lines, because wsl.exe puts its diagnosis first and a docs link
      // last -- the last-line fallback would surface only the link.
      child.stderr.write(utf16Diagnostics);
      child.stderr.write(Buffer.from("For more information please visit https://aka.ms/wslinstall", "utf16le").toString("utf8"));
      child.emit("close", 1);
    })
  ).rejects.toThrow(/WSL is not installed, so Sherlock cannot run/);
});

it("reports an actionable install hint when sherlock is missing from the configured distro", async () => {
  await expect(
    runSherlock("jdoe", (child) => {
      child.stderr.write("bash: sherlock: command not found\n");
      child.emit("close", 127);
    })
  ).rejects.toThrow(/pipx install sherlock-project/);
});
