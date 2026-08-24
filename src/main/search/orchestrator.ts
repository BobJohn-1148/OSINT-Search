/**
 * The orchestrator fans out connectors and catches failures per source because
 * search should return the strongest profile available, not fail because one
 * passive service is down. If source execution were sequential or fail-fast, the
 * UI would stop behaving like a live correlation workspace.
 */
import { randomUUID } from "node:crypto";
import type { ObservationInput, SearchRunResult, SearchSeed, Observation, SourceStatus } from "../../shared/types/search.js";
import { buildSearchRunResult } from "./correlation.js";
import { fetchJson } from "./http.js";
import type { SourceConnector } from "./source-connector.js";

export interface SearchEventSink {
  runStarted?(runId: string, startedTs: string): void;
  sourceReturned?(status: SourceStatus): void;
  observations?(observations: readonly Observation[]): void;
}

export async function runSearch(input: {
  readonly seed: SearchSeed;
  readonly connectors: readonly SourceConnector[];
  readonly events?: SearchEventSink;
  readonly runId?: string;
  readonly signal?: AbortSignal;
  readonly connectorTimeoutMs?: number;
  readonly maxConcurrentConnectors?: number;
  // Resolves a connector's stored API secret (audited) or null when none exists.
  // Injected so the orchestrator stays decoupled from the vault; omitted in tests.
  readonly resolveApiKey?: (connector: SourceConnector) => string | null;
}): Promise<SearchRunResult> {
  const runId = input.runId ?? randomUUID();
  const startedTs = new Date().toISOString();
  input.events?.runStarted?.(runId, startedTs);
  const supported = input.connectors.filter((connector) => connector.tier === "passive" && connector.supports(input.seed.type));
  const observations: Observation[] = [];
  const statuses: SourceStatus[] = [];
  const batcher = new ObservationBatcher((batch) => input.events?.observations?.(batch));

  await runBounded(
    supported,
    input.maxConcurrentConnectors ?? 5,
    async (connector) => {
      if (input.signal?.aborted) {
        return;
      }
      try {
        // Resolve the connector's key up front (and only for a connector that
        // both declares one and is running this seed), so an unused connector's
        // secret is never read or audited.
        const apiKey = connector.keySource ? input.resolveApiKey?.(connector) ?? null : null;
        const results = await runConnectorWithTimeout(
          connector,
          input.seed,
          input.signal,
          connector.timeoutMs ?? input.connectorTimeoutMs ?? 60_000,
          apiKey
        );
        const sourceObservations = results.map((result, index) => ({
          id: `${runId}:${connector.id}:${index}`,
          runId,
          entity: result.entity,
          type: result.type,
          value: result.value,
          source: connector.id,
          confidence: 1,
          raw: result.raw
        }));
        observations.push(...sourceObservations);
        batcher.pushMany(sourceObservations);
        const status = {
          sourceId: connector.id,
          label: connector.label,
          status: "returned" as const,
          observationCount: sourceObservations.length
        };
        statuses.push(status);
        input.events?.sourceReturned?.(status);
      } catch (error) {
        const status = {
          sourceId: connector.id,
          label: connector.label,
          status: "failed" as const,
          observationCount: 0,
          error: error instanceof Error ? error.message : "Source failed"
        };
        statuses.push(status);
        input.events?.sourceReturned?.(status);
      }
    },
    input.signal
  );
  batcher.close();

  return buildSearchRunResult({
    runId,
    seed: input.seed,
    startedTs,
    completedTs: new Date().toISOString(),
    statuses: statuses.sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    observations: observations.sort((a, b) => a.id.localeCompare(b.id))
  });
}

async function runBounded<T>(
  items: readonly T[],
  maxConcurrent: number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const queue = [...items];
  const workerCount = Math.max(1, Math.min(maxConcurrent, queue.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        if (signal?.aborted) {
          return;
        }
        const item = queue.shift();
        if (item !== undefined) {
          await worker(item);
        }
      }
    })
  );
}

async function runConnectorWithTimeout(
  connector: SourceConnector,
  seed: SearchSeed,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  apiKey: string | null
): Promise<readonly ObservationInput[]> {
  const controller = new AbortController();
  const abortFromParent = (): void => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) {
    controller.abort(parentSignal.reason);
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const runPromise = connector.run(seed, { fetchJson, signal: controller.signal, apiKey });
  runPromise.catch(() => {});
  const timeout = timeoutAfter(timeoutMs, `${connector.label} timed out`, controller);
  try {
    return await Promise.race([runPromise, timeout.promise]);
  } finally {
    timeout.cancel();
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

function timeoutAfter(
  timeoutMs: number,
  message: string,
  controller: AbortController
): { readonly promise: Promise<never>; readonly cancel: () => void } {
  let cancel = (): void => {};
  const promise = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort(new Error(message));
      reject(new Error(message));
    }, timeoutMs);
    cancel = () => clearTimeout(timer);
  });
  return { promise, cancel: () => cancel() };
}

class ObservationBatcher {
  private readonly pending: Observation[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  public constructor(private readonly flushBatch: (batch: readonly Observation[]) => void) {}

  public pushMany(observations: readonly Observation[]): void {
    this.pending.push(...observations);
    while (this.pending.length >= 50) {
      this.flushChunk(50);
    }
    if (this.pending.length > 0) {
      this.timer ??= setTimeout(() => this.flush(), 100);
    }
  }

  public close(): void {
    this.flush();
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public flush(): void {
    if (this.pending.length === 0) {
      return;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.flushChunk(this.pending.length);
  }

  private flushChunk(size: number): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.pending.splice(0, size);
    this.flushBatch(batch);
  }
}
