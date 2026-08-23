/**
 * Image and username depth stay in main because browser automation, WSL tools,
 * agent handoff, case saves, and correlation persistence are host boundaries.
 * If the renderer drove Lens or Maigret directly, uploads and usernames could
 * escape audit and fixed-argv policy.
 */
import { randomUUID } from "node:crypto";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type { ImageSearchRepository } from "../../db/repositories/image-search-repository.js";
import type { SearchRepository } from "../../db/repositories/search-repository.js";
import type { VaultRepository } from "../../db/repositories/vault-repository.js";
import type { AgentRuntimeService } from "../agents/agent-runtime-service.js";
import type { AnalyzerLauncher } from "../analyzers/analyzers-service.js";
import type {
  BrowserLaunch,
  SearchImageRequest,
  SearchImageResponse,
  UsernameSweepRequest,
  UsernameSweepResponse
} from "../../shared/schemas/image-username.js";
import type { ImageSearchSource } from "../../shared/types/image-username.js";
import type { Observation, ObservationInput, SearchRunResult, SourceStatus } from "../../shared/types/search.js";
import { buildSearchRunResult } from "../search/correlation.js";
import { fetchJson } from "../search/http.js";

export interface ImageMatch {
  readonly title: string;
  readonly url: string;
  readonly source: ImageSearchSource;
}

export interface BrowserImageSearchResult {
  readonly matches: readonly ImageMatch[];
  readonly launches: readonly BrowserLaunch[];
}

export type BrowserImageSearch = (imagePath: string) => Promise<BrowserImageSearchResult>;
export type ImageUsernameFetch = typeof fetchJson;

export class ImageUsernameService {
  public constructor(
    private readonly imageSearchRepository: ImageSearchRepository,
    private readonly searchRepository: SearchRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly vaultRepository: VaultRepository,
    private readonly launcher: AnalyzerLauncher,
    private readonly agentRuntimeService: AgentRuntimeService,
    private readonly browserImageSearch: BrowserImageSearch = defaultBrowserImageSearch,
    private readonly fetcher: ImageUsernameFetch = fetchJson,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async searchImage(request: SearchImageRequest): Promise<SearchImageResponse> {
    const apiMatches = await this.searchImageViaOptionalApis(request.imagePath);
    const usedBrowserFallback = apiMatches.length === 0;
    const browserResult = usedBrowserFallback ? await this.browserImageSearch(request.imagePath) : { matches: [], launches: [] };
    const matches = usedBrowserFallback ? browserResult.matches : apiMatches;
    const records = matches.map((match) =>
      this.imageSearchRepository.record({ path: request.imagePath, source: match.source, resultRef: match.url })
    );
    const run = this.persistRun({
      seed: { type: "image", value: request.imagePath },
      observations: matches.map((match) => ({
        entity: match.url,
        type: "image-match",
        value: match.title,
        source: match.source,
        raw: { url: match.url, imagePath: request.imagePath }
      }))
    });
    const savedItems = this.saveObservationsToCase(request.caseId, run);
    this.auditRepository.record({
      actor: "local-user",
      action: "search.image",
      objectType: "image_search",
      objectId: run.runId,
      sensitivity: "medium",
      detail: { imagePath: request.imagePath, resultCount: matches.length, usedBrowserFallback }
    });
    return { run, records, savedItems, usedBrowserFallback, browserLaunches: [...browserResult.launches] };
  }

  public async usernameSweep(request: UsernameSweepRequest): Promise<UsernameSweepResponse> {
    const toolResults = await Promise.all([
      this.launcher.run({
        runId: `maigret:${request.username}`,
        wslDistro: request.wslDistro,
        argv: ["maigret", request.username, "--json", "-"]
      }),
      this.launcher.run({
        runId: `blackbird:${request.username}`,
        wslDistro: request.wslDistro,
        argv: ["blackbird", "-u", request.username, "--json"]
      })
    ]);
    const observations = [
      ...parseUsernameToolOutput("maigret", toolResults[0].stdout),
      ...parseUsernameToolOutput("blackbird", toolResults[1].stdout)
    ];
    const run = this.persistRun({
      seed: { type: "username", value: request.username },
      observations
    });
    const savedItems = this.saveObservationsToCase(request.caseId, run);
    const agentRun = request.sendToAgent
      ? await this.agentRuntimeService.run({
          agentId: "osint-agent",
          seed: { type: "username", value: request.username },
          caseId: request.caseId
        })
      : null;
    this.auditRepository.record({
      actor: "local-user",
      action: "search.usernameSweep",
      objectType: "search_run",
      objectId: run.runId,
      sensitivity: "medium",
      detail: { username: request.username, observations: observations.length, agentRunId: agentRun?.run.id ?? null }
    });
    return {
      run,
      savedItems,
      toolRunIds: [`maigret:${request.username}`, `blackbird:${request.username}`],
      agentRunId: agentRun?.run.id ?? null
    };
  }

  private async searchImageViaOptionalApis(imagePath: string): Promise<readonly ImageMatch[]> {
    if (this.vaultRepository.has("openweb-ninja")) {
      const key = this.vaultRepository.readSecret("openweb-ninja", "local-user", "image.search.openweb-ninja");
      const response = await this.fetcher("https://api.openwebninja.com/google-lens/search", {
        headers: { "x-api-key": key },
        method: "POST",
        body: JSON.stringify({ image_path: imagePath })
      });
      return parseImageApiMatches(response, "openweb-ninja");
    }
    if (this.vaultRepository.has("bright-data")) {
      const key = this.vaultRepository.readSecret("bright-data", "local-user", "image.search.bright-data");
      const response = await this.fetcher("https://api.brightdata.com/request", {
        headers: { authorization: `Bearer ${key}` },
        method: "POST",
        body: JSON.stringify({ source: "google_lens", image_path: imagePath })
      });
      return parseImageApiMatches(response, "bright-data");
    }
    return [];
  }

  private persistRun(input: {
    readonly seed: SearchRunResult["seed"];
    readonly observations: readonly ObservationInput[];
  }): SearchRunResult {
    const runId = randomUUID();
    const observations = input.observations.map((observation, index): Observation => ({
      id: `${runId}:depth:${index}`,
      runId,
      entity: observation.entity,
      type: observation.type,
      value: observation.value,
      source: observation.source,
      confidence: 1,
      raw: observation.raw
    }));
    const statuses = buildStatuses(observations);
    const nowTs = this.now().toISOString();
    const run = buildSearchRunResult({
      runId,
      seed: input.seed,
      startedTs: nowTs,
      completedTs: nowTs,
      statuses,
      observations
    });
    this.searchRepository.saveRun(run);
    return run;
  }

  private saveObservationsToCase(caseId: string | undefined, run: SearchRunResult): number {
    if (!caseId) {
      return 0;
    }
    for (const observation of run.observations) {
      this.casesRepository.addItem({
        caseId,
        itemType: "observation",
        refId: observation.id,
        title: observation.value,
        text: `${observation.source}: ${observation.value}`,
        metadata: {
          entity: observation.entity,
          strength: run.entities.find((entity) => entity.entity === observation.entity)?.strength ?? 1,
          sourceId: observation.source,
          runId: run.runId
        }
      });
    }
    return run.observations.length;
  }
}

function parseImageApiMatches(response: unknown, source: ImageSearchSource): ImageMatch[] {
  const root = objectValue(response);
  const items = arrayValue(root.visual_matches ?? root.results ?? root.matches);
  return items.map(objectValue).map((item) => ({
    title: stringValue(item.title) || stringValue(item.name) || "Visual match",
    url: stringValue(item.link) || stringValue(item.url) || source,
    source
  }));
}

function parseUsernameToolOutput(source: string, stdout: string): ObservationInput[] {
  const parsed = parseJson(stdout);
  const items = Array.isArray(parsed) ? parsed : arrayValue(objectValue(parsed).results ?? objectValue(parsed).sites);
  return items.map(objectValue).flatMap((item) => {
    const site = stringValue(item.site) || stringValue(item.name) || stringValue(item.platform);
    const url = stringValue(item.url) || stringValue(item.profile_url) || stringValue(item.link);
    const found = item.exists === true || item.status === "found" || item.found === true || Boolean(url);
    if (!found || !site) {
      return [];
    }
    return [{
      entity: url || site,
      type: "account",
      value: site,
      source,
      raw: { site, url }
    }];
  });
}

function buildStatuses(observations: readonly Observation[]): SourceStatus[] {
  const counts = new Map<string, number>();
  for (const observation of observations) {
    counts.set(observation.source, (counts.get(observation.source) ?? 0) + 1);
  }
  return [...counts.entries()].map(([sourceId, observationCount]) => ({
    sourceId,
    label: sourceId,
    status: "returned" as const,
    observationCount
  }));
}

async function defaultBrowserImageSearch(): Promise<BrowserImageSearchResult> {
  const launches: BrowserLaunch[] = [
    { source: "browser-google-lens", url: "https://lens.google.com/search" },
    { source: "browser-yandex", url: "https://yandex.com/images/search" }
  ];
  const { default: electron } = await import("electron");
  const { shell } = electron;
  await Promise.all(launches.map((launch) => shell.openExternal(launch.url)));
  return { matches: [], launches };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
