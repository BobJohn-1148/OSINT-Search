/**
 * Orchestrator tests prove fan-out is live and failure-isolated because passive
 * OSINT sources are internet dependencies, not trusted local services. If one
 * failed connector could abort the run, correlation would be less reliable than
 * the sources it is meant to reconcile.
 */
import { runSearch } from "../../src/main/search/orchestrator";
import type { SourceConnector } from "../../src/main/search/source-connector";

function connector(id: string, delayMs = 0): SourceConnector {
  return {
    id,
    label: id,
    category: "domain",
    tier: "passive",
    keyRequired: false,
    supports: () => true,
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return [{ entity: "example.com", type: "domain", value: "example.com", source: id }];
    }
  };
}

it("a failing connector is isolated so the run still completes with other source observations", async () => {
  const failing: SourceConnector = {
    ...connector("broken"),
    run: () => {
      throw new Error("source unavailable");
    }
  };

  const run = await runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [connector("rdap"), failing]
  });

  expect(run.statuses).toEqual([
    { sourceId: "broken", label: "broken", status: "failed", observationCount: 0, error: "source unavailable" },
    { sourceId: "rdap", label: "rdap", status: "returned", observationCount: 1 }
  ]);
  expect(run.observations).toHaveLength(1);
});

it("streams a source-returned event per source as passive connectors finish", async () => {
  const sourceEvents: string[] = [];
  const observationEvents: string[] = [];

  await runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [connector("slow", 5), connector("fast", 0)],
    events: {
      sourceReturned: (status) => sourceEvents.push(status.sourceId),
      observations: (observations) => observationEvents.push(...observations.map((observation) => observation.source))
    }
  });

  expect(sourceEvents).toEqual(["fast", "slow"]);
  expect(observationEvents).toEqual(["fast", "slow"]);
});

it("bounds connector fan-out so passive sources do not all run at once", async () => {
  let active = 0;
  let peak = 0;
  const boundedConnector = (id: string): SourceConnector => ({
    ...connector(id),
    run: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return [{ entity: id, type: "domain", value: id, source: id }];
    }
  });

  await runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [boundedConnector("one"), boundedConnector("two"), boundedConnector("three")],
    maxConcurrentConnectors: 2
  });

  expect(peak).toBe(2);
});

it("batches observation events into capped chunks so high-volume sources do not flood renderer IPC", async () => {
  const batchSizes: number[] = [];
  const noisyConnector: SourceConnector = {
    ...connector("noisy"),
    run: () =>
      Promise.resolve(
        Array.from({ length: 51 }, (_, index) => ({
          entity: `entity-${index}`,
          type: "domain",
          value: `entity-${index}`,
          source: "noisy"
        }))
      )
  };

  await runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [noisyConnector],
    events: {
      sourceReturned: () => {},
      observations: (observations) => batchSizes.push(observations.length)
    }
  });

  expect(batchSizes).toEqual([50, 1]);
});

it("flushes observation batches on a timer so early source results stream before run completion", async () => {
  const batchSizes: number[] = [];
  const slowConnector: SourceConnector = {
    ...connector("slow"),
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return [{ entity: "slow.example", type: "domain", value: "slow.example", source: "slow" }];
    }
  };

  const runPromise = runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [connector("fast"), slowConnector],
    maxConcurrentConnectors: 2,
    events: {
      runStarted: () => {},
      sourceReturned: () => {},
      observations: (observations) => batchSizes.push(observations.length)
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(batchSizes).toEqual([1]);
  await runPromise;
  expect(batchSizes).toEqual([1, 1]);
});

it("cancels queued connector work through an abort signal so long searches are stoppable", async () => {
  const controller = new AbortController();
  let started = 0;
  const cancellableConnector = (id: string): SourceConnector => ({
    ...connector(id),
    run: () => {
      started += 1;
      controller.abort();
      return Promise.resolve([{ entity: id, type: "domain", value: id, source: id }]);
    }
  });

  await runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [cancellableConnector("one"), connector("two")],
    maxConcurrentConnectors: 1,
    signal: controller.signal
  });

  expect(started).toBe(1);
});

it("times out a connector that ignores abort signals so one source cannot hang the run", async () => {
  const stubbornConnector: SourceConnector = {
    ...connector("stubborn"),
    run: () => new Promise(() => {})
  };

  const run = await runSearch({
    seed: { type: "domain", value: "example.com" },
    connectors: [stubbornConnector],
    connectorTimeoutMs: 5
  });

  expect(run.statuses).toMatchObject([
    {
      sourceId: "stubborn",
      status: "failed",
      error: "stubborn timed out"
    }
  ]);
});
