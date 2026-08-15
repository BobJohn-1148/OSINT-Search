/**
 * Monitoring tests use real SQLite so watch dedupe, alerts, case evidence, and
 * correlation observations prove the same durability path the scheduler uses.
 * If these used mocked repositories, scheduled checks could pass while saving
 * nothing Jack can review later.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { MonitoringRepository } from "../../src/db/repositories/monitoring-repository";
import { SearchRepository } from "../../src/db/repositories/search-repository";
import type { VaultRepository } from "../../src/db/repositories/vault-repository";
import type { CredentialSource } from "../../src/main/monitoring/credential-sources";
import { MonitoringService } from "../../src/main/monitoring/monitoring-service";

function createHarness(sources: readonly CredentialSource[]) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const casesRepository = new CasesRepository(db);
  const monitoringRepository = new MonitoringRepository(db);
  const searchRepository = new SearchRepository(db);
  const readSecretMock = vi.fn();
  const vaultRepository = {
    has: vi.fn().mockReturnValue(false),
    readSecret: readSecretMock
  } as unknown as VaultRepository;
  const service = new MonitoringService(
    monitoringRepository,
    casesRepository,
    searchRepository,
    auditRepository,
    vaultRepository,
    sources,
    vi.fn(),
    () => new Date("2026-08-10T12:00:00.000Z")
  );
  return {
    auditRepository,
    casesRepository,
    db,
    monitoringRepository,
    readSecretMock,
    searchRepository,
    service,
    vaultRepository
  };
}

it("records and alerts on a new exposure so a checked watch target saves breach evidence to a case", async () => {
  const harness = createHarness([freeSource("xposedornot", "Acme breach")]);
  const caseRecord = harness.casesRepository.create("Credential case", []);
  const watch = harness.service.addWatch({
    type: "email",
    value: "security@example.com",
    caseId: caseRecord.id,
    checkIntervalMinutes: 60
  });

  const result = await harness.service.checkNow({ watchId: watch.id });

  expect(result.newExposures.map((exposure) => exposure.title)).toEqual(["Acme breach"]);
  expect(result.alerts[0]?.message).toBe("security@example.com exposed in Acme breach");
  expect(result.savedItems).toBe(1);
  expect(harness.casesRepository.timeline(caseRecord.id)[0]).toEqual(
    expect.objectContaining({
      itemType: "observation",
      title: "security@example.com exposed in Acme breach"
    })
  );
  expect(harness.db.prepare("SELECT source, value FROM observations").all()).toEqual([
    { source: "xposedornot", value: "Acme breach" }
  ]);
});

it("scheduled recheck fires and dedupes already-seen exposures so repeated watches do not spam alerts", async () => {
  const harness = createHarness([freeSource("xposedornot", "Acme breach")]);
  const watch = harness.service.addWatch({
    type: "email",
    value: "security@example.com",
    checkIntervalMinutes: 1
  });

  const first = await harness.service.runDueRechecks(new Date("2026-08-10T12:00:00.000Z"));
  const second = await harness.service.runDueRechecks(new Date("2026-08-10T12:02:00.000Z"));

  expect(first[0]?.newExposures).toHaveLength(1);
  expect(second[0]?.watch.id).toBe(watch.id);
  expect(second[0]?.newExposures).toHaveLength(0);
  expect(harness.monitoringRepository.listAlerts()).toHaveLength(1);
  expect(harness.monitoringRepository.listExposures(watch.id)).toHaveLength(1);
});

it("paid source with no key is skipped without error so optional breach providers degrade gracefully", async () => {
  const harness = createHarness([paidSource("hibp")]);
  const watch = harness.service.addWatch({
    type: "email",
    value: "security@example.com",
    checkIntervalMinutes: 60
  });

  const result = await harness.service.checkNow({ watchId: watch.id });

  expect(result.skippedSources).toEqual(["hibp"]);
  expect(result.exposures).toEqual([]);
  expect(harness.readSecretMock).not.toHaveBeenCalled();
});

it("removing a watch preserves exposure alerts so monitoring history remains append-only", async () => {
  const harness = createHarness([freeSource("xposedornot", "Acme breach")]);
  const watch = harness.service.addWatch({
    type: "email",
    value: "security@example.com",
    checkIntervalMinutes: 60
  });
  await harness.service.checkNow({ watchId: watch.id });

  expect(harness.service.removeWatch(watch.id)).toBe(true);

  expect(harness.service.listWatches().watches).toEqual([]);
  expect(harness.monitoringRepository.listExposures(watch.id)).toHaveLength(1);
  expect(harness.monitoringRepository.listAlerts()).toHaveLength(1);
  expect(() => harness.db.prepare("DELETE FROM monitoring_alerts").run()).toThrow(/monitoring_alerts is append-only/);
  expect(() => harness.db.prepare("DELETE FROM exposures").run()).toThrow(/exposures is append-only/);
});

function freeSource(id: string, title: string): CredentialSource {
  return {
    id,
    label: id,
    requiresKey: false,
    supports: (type) => type === "email",
    check: () =>
      Promise.resolve([
        {
          source: id,
          title,
          detail: `${title} exposed the watched account.`,
          fingerprint: `${id}:${title.toLowerCase()}`
        }
      ])
  };
}

function paidSource(id: string): CredentialSource {
  return {
    id,
    label: id,
    keySource: "hibp",
    requiresKey: true,
    supports: (type) => type === "email",
    check: () => Promise.resolve([])
  };
}
