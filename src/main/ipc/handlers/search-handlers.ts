/**
 * Search handlers bridge Electron IPC to the orchestrator while keeping source
 * events renderer-visible and persistence repository-owned. If the renderer ran
 * connectors directly, passive lookups could bypass audit and database contracts.
 *
 * A completed search also triggers the OSINT agent, so one Enter in the search
 * box produces the whole profile — sources, scripts, and reasoning — instead of
 * three separate clicks. Main owns that trigger rather than the renderer firing
 * two calls in parallel, because the agent has to reason over the observations
 * this run just produced: an agent started alongside the search would have no
 * evidence in its context and would fail its own citation gate every time.
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
import type { CaseRecord } from "../../../shared/schemas/cases.js";
import type { SearchRunResult } from "../../../shared/types/search.js";
import type { AgentRunInput } from "../../agents/agent-runtime-service.js";
import { runSearch } from "../../search/orchestrator.js";
import type { SourceConnector } from "../../search/source-connector.js";

const AUTO_AGENT_ID = "osint-agent";

/**
 * The agent and case dependencies are declared structurally rather than as the
 * concrete service and repository so this handler can be exercised without
 * standing up a model call. The alternative -- importing AgentRuntimeService
 * directly -- would make every search test depend on a live Ollama.
 */
export interface SearchAgentRunner {
  run(input: AgentRunInput): Promise<unknown>;
}

export interface SearchCaseDirectory {
  list(): readonly CaseRecord[];
  create(title: string, tags: readonly string[]): CaseRecord;
}

export function createSearchHandlers(
  searchRepository: SearchRepository,
  auditRepository: AuditRepository,
  connectors: readonly SourceConnector[],
  webContentsProvider: () => readonly WebContents[],
  vaultRepository: VaultRepository,
  agentRuntimeService: SearchAgentRunner,
  casesRepository: SearchCaseDirectory
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

  /**
   * Every search would otherwise mint its own case, because the runtime creates
   * one whenever none is passed. Reusing the newest open case mirrors what the
   * search view already did by hand before the agent ran automatically.
   */
  function activeCaseId(seedValue: string): string {
    const openCase = casesRepository.list().find((record) => record.status === "open");
    return (openCase ?? casesRepository.create(`Investigation — ${seedValue}`, ["search"])).id;
  }

  /**
   * Deliberately not awaited by the caller: a local model takes far longer than
   * the search itself, and blocking the IPC reply on it would leave the board
   * empty until the agent finished. The agent reports its own progress over the
   * agent:events channel, and a failure here (no Ollama, no grounded citation)
   * must not turn a good search into a failed one.
   */
  function startAgent(run: SearchRunResult): void {
    void agentRuntimeService
      .run({
        agentId: AUTO_AGENT_ID,
        seed: run.seed,
        caseId: activeCaseId(run.seed.value),
        observations: run.observations
      })
      .catch(() => undefined);
  }

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
    // A cancelled search must not hand its partial results to the agent — the
    // investigator stopped it for a reason.
    if (!controller.signal.aborted) {
      startAgent(run);
    }
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
