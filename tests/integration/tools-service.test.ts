/**
 * Tool service tests use real SQLite and a fake WSL process so launch policy is
 * exercised without depending on a developer machine's WSL state. If these used
 * mocked repositories, blocked active scans and case evidence writes could drift
 * from the shipped schema.
 */
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import Database from "better-sqlite3";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { ToolsRepository } from "../../src/db/repositories/tools-repository";
import { runMigrations } from "../../src/db/migrations/runner";
import { ToolsService } from "../../src/main/tools/tools-service";
import { WslToolLauncher } from "../../src/main/tools/wsl-launcher";
import type { ToolOutputEvent } from "../../src/shared/schemas/tools";

function openMemoryDatabase() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function createService(db = openMemoryDatabase(), output = "found alice\n") {
  const spawnCalls: { readonly command: string; readonly args: readonly string[]; readonly options: SpawnOptionsWithoutStdio }[] = [];
  const spawnProcess = (command: string, args: readonly string[], options: SpawnOptionsWithoutStdio) => {
    spawnCalls.push({ command, args, options });
    const child = new EventEmitter() as ChildProcessWithoutNullStreams;
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    Object.assign(child, { stdout, stderr });
    queueMicrotask(() => {
      stdout.emit("data", Buffer.from(output));
      child.emit("close", 0);
    });
    return child;
  };
  const emitted: ToolOutputEvent[] = [];
  const toolsRepository = new ToolsRepository(db);
  const casesRepository = new CasesRepository(db);
  const service = new ToolsService(
    toolsRepository,
    casesRepository,
    new AuditRepository(db),
    new WslToolLauncher(spawnProcess),
    (event) => emitted.push(event)
  );
  return { db, service, toolsRepository, casesRepository, spawnCalls, emitted };
}

it("an active tool is blocked without a matching authorization so scans require owner approval", async () => {
  const { service, spawnCalls } = createService();

  const run = await service.launch({
    toolId: "nmap",
    target: "scan.example.com",
    wslDistro: "Ubuntu"
  });

  expect(run.status).toBe("blocked");
  expect(run.stderr).toMatch(/no exact unexpired authorization/i);
  expect(spawnCalls).toEqual([]);
});

it("wrong-target and expired active authorizations are blocked so approval must exactly match the target", async () => {
  const { service, spawnCalls } = createService();
  service.createAuthorization({
    target: "other.example.com",
    tier: "active",
    expiresTs: new Date(Date.now() + 60_000).toISOString()
  });
  service.createAuthorization({
    target: "scan.example.com",
    tier: "active",
    expiresTs: new Date(Date.now() - 60_000).toISOString()
  });

  const run = await service.launch({
    toolId: "nmap",
    target: "scan.example.com",
    wslDistro: "Ubuntu"
  });

  expect(run.status).toBe("blocked");
  expect(spawnCalls).toEqual([]);
});

it("an exact unexpired active authorization permits a WSL launch for that target", async () => {
  const { service, spawnCalls } = createService();
  service.createAuthorization({
    target: "scan.example.com",
    tier: "active",
    expiresTs: new Date(Date.now() + 60_000).toISOString()
  });

  const run = await service.launch({
    toolId: "nmap",
    target: "scan.example.com",
    wslDistro: "Ubuntu"
  });

  expect(run.status).toBe("succeeded");
  expect(spawnCalls).toHaveLength(1);
  expect(spawnCalls[0].args).toEqual(["-d", "Ubuntu", "--", "nmap", "scan.example.com"]);
});

it("captures WSL tool output to a run so tool results can be saved to a case", async () => {
  const { service, casesRepository, emitted } = createService();
  const caseRecord = casesRepository.create("Tool capture", ["tools"]);

  const run = await service.launch({
    toolId: "sherlock",
    target: "alice",
    caseId: caseRecord.id,
    wslDistro: "Ubuntu"
  });

  expect(run.status).toBe("succeeded");
  expect(run.stdout).toContain("found alice");
  expect(emitted).toEqual([{ runId: run.id, stream: "stdout", chunk: "found alice\n" }]);
  const [caseItem] = casesRepository.timeline(caseRecord.id);
  expect(caseItem).toEqual(expect.objectContaining({ itemType: "tool_run", refId: run.id, title: "Sherlock on alice" }));
  expect(caseItem.text).toContain("found alice");
});

it("catalog add and edit persists so local WSL tools stay configurable", () => {
  const { service, toolsRepository } = createService();
  const added = service.addCatalog({
    name: "Local helper",
    description: "Local passive helper.",
    installCommand: "pipx install helper",
    officialLink: "https://example.test/helper",
    category: "recon",
    tier: "passive",
    defaultArgs: ["helper"]
  });

  const updated = service.updateCatalog({
    ...added,
    description: "Updated local passive helper.",
    defaultArgs: ["helper", "--json"]
  });

  expect(toolsRepository.getCatalog(added.id)).toEqual(updated);
  expect(updated.defaultArgs).toEqual(["helper", "--json"]);
});

it("seeds 3uTools as a passive mobile Windows companion entry", () => {
  const { toolsRepository } = createService();

  expect(toolsRepository.getCatalog("3utools")).toEqual(
    expect.objectContaining({
      id: "3utools",
      name: "3uTools",
      category: "mobile",
      tier: "passive",
      officialLink: "https://www.3u.com/",
      defaultArgs: ["3uTools.exe"]
    })
  );
});

it("seeds iPhone acquisition and backup-analysis tools as passive mobile entries", () => {
  const { toolsRepository } = createService();

  expect(toolsRepository.getCatalog("pymobiledevice3")).toEqual(
    expect.objectContaining({
      category: "mobile",
      tier: "passive",
      defaultArgs: ["pymobiledevice3"]
    })
  );
  expect(toolsRepository.getCatalog("mvt-ios")).toEqual(
    expect.objectContaining({
      category: "mobile",
      tier: "passive",
      defaultArgs: ["mvt-ios", "check-backup"]
    })
  );
  expect(toolsRepository.getCatalog("ileapp")).toEqual(
    expect.objectContaining({
      category: "mobile",
      tier: "passive"
    })
  );
  expect(toolsRepository.getCatalog("idevicebackup2")).toEqual(
    expect.objectContaining({
      category: "mobile",
      tier: "passive",
      defaultArgs: ["idevicebackup2", "backup"]
    })
  );
});

it("seeds RevShells as a reference-only lab catalog entry", () => {
  const { toolsRepository } = createService();

  expect(toolsRepository.getCatalog("revshells")).toEqual(
    expect.objectContaining({
      name: "RevShells",
      category: "lab",
      tier: "passive",
      officialLink: "https://www.revshells.com/",
      defaultArgs: ["echo", "Open https://www.revshells.com/ for authorized lab or CTF use only."]
    })
  );
});

it("detect checks installed tools with fixed WSL which commands", async () => {
  const { service, spawnCalls } = createService();

  await service.detect("Ubuntu");

  const [firstCall] = spawnCalls;
  expect(firstCall.command).toBe("wsl.exe");
  expect(firstCall.args.slice(0, 4)).toEqual(["-d", "Ubuntu", "--", "which"]);
  expect(firstCall.options.shell).toBe(false);
});
