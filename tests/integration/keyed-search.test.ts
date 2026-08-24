/**
 * This proves the whole key path end to end without a network call: a key stored
 * in the encrypted vault is read through the audited gate by the search handler,
 * threaded into the connector's run context, and every read leaves an audit
 * trail. A key-based source reaching the connector without a "key.read" audit
 * event would break the vault invariant this guards.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { SearchRepository } from "../../src/db/repositories/search-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { VaultRepository } from "../../src/db/repositories/vault-repository";
import { createSearchHandlers } from "../../src/main/ipc/handlers/search-handlers";
import { SodiumVaultCrypto } from "../../src/main/security/vault-crypto";
import type { SourceConnector } from "../../src/main/search/source-connector";

// A connector that echoes whatever secret it was handed, so the test observes
// exactly what reached the run context without making a real API call.
const echoConnector: SourceConnector = {
  id: "abuse-echo",
  label: "Abuse echo",
  category: "network",
  tier: "passive",
  keyRequired: true,
  keySource: "abuseipdb",
  supports: (seedType) => seedType === "ip",
  run: (_seed, context) =>
    Promise.resolve([{ entity: "ip:8.8.8.8", type: "key-echo", value: context.apiKey ?? "no-key", source: "abuse-echo" }])
};

async function harness() {
  const db = new Database(":memory:");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const searchRepository = new SearchRepository(db);
  const crypto = await SodiumVaultCrypto.fromKey(new Uint8Array(32).fill(9));
  const vaultRepository = new VaultRepository(db, crypto, auditRepository);
  // The agent auto-run is recorded rather than executed: this test is about the
  // vault gate, and a real agent would need a live model to say anything.
  const agentRuns: unknown[] = [];
  const agentRunner = { run: (input: unknown) => { agentRuns.push(input); return Promise.resolve(undefined); } };
  const handlers = createSearchHandlers(
    searchRepository,
    auditRepository,
    [echoConnector],
    () => [],
    vaultRepository,
    agentRunner,
    new CasesRepository(db)
  );
  return { agentRuns, auditRepository, vaultRepository, handlers };
}

it("reads a stored key through the audited vault gate and hands it to the connector", async () => {
  const { vaultRepository, auditRepository, handlers } = await harness();
  vaultRepository.add("abuseipdb", "abuse-secret-xyz");

  const response = await handlers["search:run"]({ seed: { type: "ip", value: "8.8.8.8" }, runId: "run-keyed" });

  const echo = response.run.observations.find((observation) => observation.type === "key-echo");
  expect(echo?.value).toBe("abuse-secret-xyz");

  const keyReads = auditRepository.list(20).filter((event) => event.action === "key.read");
  expect(keyReads).toHaveLength(1);
  expect(keyReads[0]).toMatchObject({ objectId: "abuseipdb", sensitivity: "sensitive" });
  expect(keyReads[0].detail).toMatchObject({ purpose: "search.abuse-echo" });
});

it("runs the same connector with no key and no audited read when the vault is empty", async () => {
  const { auditRepository, handlers } = await harness();

  const response = await handlers["search:run"]({ seed: { type: "ip", value: "8.8.8.8" }, runId: "run-nokey" });

  const echo = response.run.observations.find((observation) => observation.type === "key-echo");
  expect(echo?.value).toBe("no-key");
  expect(auditRepository.list(20).filter((event) => event.action === "key.read")).toHaveLength(0);
});
