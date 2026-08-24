/**
 * This is the guard on the whole point of the feature: one Enter in the search
 * box has to produce the sources *and* the agent, without the board waiting on
 * the model. The three properties that would each silently break it are pinned
 * here — the search reply does not block on the agent, the agent receives this
 * run's observations to cite, and repeated searches reuse one open case instead
 * of minting a new one every time.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations/runner";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { CasesRepository } from "../../src/db/repositories/cases-repository";
import { SearchRepository } from "../../src/db/repositories/search-repository";
import { VaultRepository } from "../../src/db/repositories/vault-repository";
import { createSearchHandlers } from "../../src/main/ipc/handlers/search-handlers";
import { SodiumVaultCrypto } from "../../src/main/security/vault-crypto";
import { AgentRunInput } from "../../src/main/agents/agent-runtime-service";
import type { SourceConnector } from "../../src/main/search/source-connector";

const stubConnector: SourceConnector = {
  id: "rdap-stub",
  label: "RDAP stub",
  category: "domain",
  tier: "passive",
  keyRequired: false,
  supports: (seedType) => seedType === "domain",
  run: () =>
    Promise.resolve([
      { entity: "domain:example.com", type: "registrar", value: "Example Registrar Inc", source: "rdap-stub" }
    ])
};

async function harness(agentRun: (input: AgentRunInput) => Promise<unknown>) {
  const db = new Database(":memory:");
  runMigrations(db);
  const auditRepository = new AuditRepository(db);
  const searchRepository = new SearchRepository(db);
  const casesRepository = new CasesRepository(db);
  const crypto = await SodiumVaultCrypto.fromKey(new Uint8Array(32).fill(7));
  const vaultRepository = new VaultRepository(db, crypto, auditRepository);
  const handlers = createSearchHandlers(
    searchRepository,
    auditRepository,
    [stubConnector],
    () => [],
    vaultRepository,
    { run: agentRun },
    casesRepository
  );
  return { casesRepository, handlers };
}

it("hands the completed run's observations to the OSINT agent so it can cite real evidence", async () => {
  const calls: AgentRunInput[] = [];
  const { handlers } = await harness((input) => {
    calls.push(input);
    return Promise.resolve(undefined);
  });

  await handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-auto" });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ agentId: "osint-agent", seed: { type: "domain", value: "example.com" } });
  expect(calls[0].observations?.map((observation) => observation.value)).toEqual(["Example Registrar Inc"]);
});

it("returns the search result without waiting for the agent, so the board is not blocked by the model", async () => {
  let releaseAgent = (): void => undefined;
  const agentFinished = new Promise<void>((resolve) => {
    releaseAgent = resolve;
  });
  const { handlers } = await harness(() => agentFinished);

  const response = await handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-nonblocking" });

  // The reply arrived while the agent is still pending; only then release it.
  expect(response.run.observations).toHaveLength(1);
  releaseAgent();
  await agentFinished;
});

it("survives an agent that fails, because a dead model must not turn a good search into a failed one", async () => {
  const { handlers } = await harness(() => Promise.reject(new Error("Could not reach Ollama")));

  const response = await handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-agent-down" });

  expect(response.run.statuses).toEqual([
    expect.objectContaining({ sourceId: "rdap-stub", status: "returned" })
  ]);
});

it("reuses the one open case across searches instead of minting a case per Enter", async () => {
  const calls: AgentRunInput[] = [];
  const { casesRepository, handlers } = await harness((input) => {
    calls.push(input);
    return Promise.resolve(undefined);
  });

  await handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-one" });
  await handlers["search:run"]({ seed: { type: "domain", value: "other.com" }, runId: "run-two" });

  expect(casesRepository.list()).toHaveLength(1);
  expect(calls[0].caseId).toBe(calls[1].caseId);
});

it("does not mint two cases when two searches with no open case finish at the same time", async () => {
  const calls: AgentRunInput[] = [];
  const { casesRepository, handlers } = await harness((input) => {
    calls.push(input);
    return Promise.resolve(undefined);
  });

  // Both requests start before either finishes, so their completions land in
  // the same batch of pending promise continuations -- the shape a
  // check-then-act race would need. activeCaseId's list()/create() calls are
  // synchronous (better-sqlite3), so Node's single-threaded event loop cannot
  // interleave one call's list() with another's create(); this pins that
  // guarantee against a regression (e.g. an accidental await inserted into
  // activeCaseId) rather than re-deriving it from reasoning alone.
  await Promise.all([
    handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-concurrent-one" }),
    handlers["search:run"]({ seed: { type: "domain", value: "other.com" }, runId: "run-concurrent-two" })
  ]);

  expect(casesRepository.list()).toHaveLength(1);
  expect(calls).toHaveLength(2);
  expect(calls[0].caseId).toBe(calls[1].caseId);
});

it("routes findings into a case the investigator already opened rather than creating its own", async () => {
  const calls: AgentRunInput[] = [];
  const { casesRepository, handlers } = await harness((input) => {
    calls.push(input);
    return Promise.resolve(undefined);
  });
  const existing = casesRepository.create("Jack's active case", ["manual"]);

  await handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-existing" });

  expect(calls[0].caseId).toBe(existing.id);
  expect(casesRepository.list()).toHaveLength(1);
});

it("does not hand a cancelled search's partial results to the agent", async () => {
  const calls: AgentRunInput[] = [];
  const { handlers } = await harness((input) => {
    calls.push(input);
    return Promise.resolve(undefined);
  });

  const running = handlers["search:run"]({ seed: { type: "domain", value: "example.com" }, runId: "run-cancelled" });
  handlers["search:cancel"]({ runId: "run-cancelled" });
  await running;

  expect(calls).toHaveLength(0);
});
