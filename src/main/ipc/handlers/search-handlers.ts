/**
 * Search handlers bridge Electron IPC to the orchestrator while keeping source
 * events renderer-visible and persistence repository-owned. If the renderer ran
 * connectors directly, passive lookups could bypass audit and database contracts.
 */
import type { WebContents } from "electron";
import type { AuditRepository } from "../../../db/repositories/audit-repository.js";
import type { SearchRepository } from "../../../db/repositories/search-repository.js";
import type { VaultRepository } from "../../../db/repositories/vault-repository.js";
import type {
  SearchCancelRequest,
  SearchCancelResponse,
  SearchGetRequest,
  SearchGetResponse,
  SearchPivotRequest,
  SearchPivotResponse,
  SearchRunRequest,
  SearchRunResponse
} from "../../../shared/schemas/search.js";
import type { SourceConnector } from "../../search/source-connector.js";
import { runSearch } from "../../search/orchestrator.js";

export function createSearchHandlers(
  searchRepository: SearchRepository,
  auditRepository: AuditRepository,
  connectors: readonly SourceConnector[],
  webContentsProvider: () => readonly WebContents[],
  vaultRepository: VaultRepository
) {
  const activeRuns = new Map<string, AbortController>();

  // Resolve a connector's stored secret through the vault gate, which audits the
  // read. Returns null when the connector needs no key or none is stored, so a
  // key-based source degrades to "no results" instead of throwing.
  function resolveApiKey(connector: SourceConnector): string | null {
    if (!connector.keySource || !vaultRepository.has(connector.keySource)) {
      return null;
    }
    return vaultRepository.readSecret(connector.keySource, "local-user", `search.${connector.id}`);
  }

  searchRepository.upsertSources(
    connectors.map((connector) => ({
      id: connector.id,
      label: connector.label,
      category: connector.category,
      tier: connector.tier,
      keyRequired: connector.keyRequired
    }))
  );

  async function execute(request: SearchRunRequest | SearchPivotRequest, action: string): Promise<SearchRunResponse> {
    const controller = new AbortController();
    const run = await runSearch({
      seed: request.seed,
      runId: request.runId,
      signal: controller.signal,
      connectors,
      resolveApiKey,
      events: {
        runStarted: (runId, startedTs) => {
          activeRuns.set(runId, controller);
          searchRepository.startRun(runId, request.seed, startedTs);
        },
        sourceReturned: (status) => emitToRenderers("search:source-returned", status),
        observations: (observations) => {
          searchRepository.appendObservations(observations);
          emitToRenderers("search:observations", observations);
        }
      }
    });
    activeRuns.delete(run.runId);
    searchRepository.finalizeRun(run);
    auditRepository.record({
      actor: "local-user",
      action,
      objectType: "search_run",
      objectId: run.runId,
      sensitivity: "medium",
      detail: { seedType: request.seed.type, sourceCount: run.statuses.length }
    });
    return { run };
  }

  function emitToRenderers(channel: "search:source-returned" | "search:observations", payload: unknown): void {
    for (const webContents of webContentsProvider()) {
      webContents.send(channel, payload);
    }
  }

  return {
    "search:run": (request: SearchRunRequest): Promise<SearchRunResponse> => execute(request, "search.run"),
    "search:pivot": (request: SearchPivotRequest): Promise<SearchPivotResponse> => execute(request, "search.pivot"),
    "search:get": (request: SearchGetRequest): SearchGetResponse => ({
      run: searchRepository.getRun(request.runId)
    }),
    "search:cancel": (request: SearchCancelRequest): SearchCancelResponse => {
      const controller = activeRuns.get(request.runId);
      controller?.abort(new Error("Search cancelled"));
      activeRuns.delete(request.runId);
      return { runId: request.runId, cancelled: Boolean(controller) };
    }
  };
}
