/**
 * Mobile service tests use a fake command runner because the security property
 * is fixed argv and graceful missing-tool behavior, not whether this workstation
 * currently has a phone attached. Persistence and audit checks use a real
 * in-memory SQLite database, matching the pattern used for every other
 * repository-backed service test, so a snapshot or audit row that is never
 * written cannot slip past a mocked repository.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { MobileRepository } from "../../src/db/repositories/mobile-repository";
import { MobileService } from "../../src/main/mobile/mobile-service";
import type { MobileCommandRunner } from "../../src/main/mobile/mobile-service";

function createService(runner: MobileCommandRunner) {
  const db = new Database(":memory:");
  runMigrations(db);
  const mobileRepository = new MobileRepository(db);
  const auditRepository = new AuditRepository(db);
  const service = new MobileService(mobileRepository, auditRepository, runner);
  return { auditRepository, mobileRepository, service };
}

it("detects Android and iOS devices through fixed local probes so phone inventory stays main-owned", async () => {
  const calls: { readonly command: string; readonly args: readonly string[] }[] = [];
  const runner: MobileCommandRunner = (command, args) => {
    calls.push({ command, args });
    if (command === "adb") {
      return Promise.resolve({ stdout: "List of devices attached\r\nandroid-one device product:pixel model:Pixel_8\r\n", stderr: "" });
    }
    return Promise.resolve({ stdout: "ios-one\n", stderr: "" });
  };

  const { service } = createService(runner);
  const result = await service.detect();

  expect(calls).toEqual([
    { command: "adb", args: ["devices", "-l"] },
    { command: "idevice_id", args: ["-l"] }
  ]);
  expect(result.devices).toMatchObject([
    { id: "android-one", platform: "android", connected: true },
    { id: "ios-one", platform: "ios", connected: true }
  ]);
  expect(result.devices[0]?.dataTypes.map((dataType) => dataType.id)).toContain("android-packages");
  expect(result.unavailableTools).toEqual([]);
});

it("reports missing mobile tools without crashing so unplugged workstations still render the tab", async () => {
  const runner: MobileCommandRunner = () => Promise.reject(new Error("missing"));

  const { service } = createService(runner);
  await expect(service.detect()).resolves.toEqual({
    devices: [],
    unavailableTools: ["adb", "libimobiledevice"]
  });
});

it("persists one snapshot per detected device so device history survives a restart", async () => {
  const runner: MobileCommandRunner = (command) => {
    if (command === "adb") {
      return Promise.resolve({ stdout: "List of devices attached\r\nandroid-one device product:pixel model:Pixel_8\r\n", stderr: "" });
    }
    return Promise.resolve({ stdout: "ios-one\n", stderr: "" });
  };

  const { mobileRepository, service } = createService(runner);
  await service.detect();

  const snapshots = mobileRepository.listSnapshots(10);
  expect(snapshots).toHaveLength(2);
  expect(snapshots.map((snapshot) => snapshot.deviceId).sort()).toEqual(["android-one", "ios-one"]);
  expect(snapshots.find((snapshot) => snapshot.deviceId === "android-one")?.dataTypeIds).toContain("android-packages");

  const listed = service.snapshots(10);
  expect(listed.snapshots).toHaveLength(2);
});

it("records one audit event per detect pass that finds a device, so probing sensitive inventory is provable later", async () => {
  const runner: MobileCommandRunner = (command) => {
    if (command === "adb") {
      return Promise.resolve({ stdout: "List of devices attached\r\nandroid-one device product:pixel model:Pixel_8\r\n", stderr: "" });
    }
    return Promise.reject(new Error("missing"));
  };

  const { auditRepository, service } = createService(runner);
  await service.detect();

  const events = auditRepository.list(10);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ action: "mobile.detect", sensitivity: "high" });
  expect(events[0]?.detail).toMatchObject({ deviceCount: 1, platforms: ["android"], unavailableTools: ["libimobiledevice"] });
});

it("records no audit event when nothing is attached, so an empty probe does not pollute the audit log", async () => {
  const runner: MobileCommandRunner = () => Promise.reject(new Error("missing"));

  const { auditRepository, service } = createService(runner);
  await service.detect();

  expect(auditRepository.list(10)).toEqual([]);
});
