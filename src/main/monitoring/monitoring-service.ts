/**
 * Monitoring service runs provider checks in main so breach lookups, key reads,
 * alerts, case saves, and correlation feeds share one audited boundary. If the
 * dashboard called breach APIs directly, privacy-sensitive targets would bypass
 * vault policy and scheduled dedupe.
 */
import { randomUUID } from "node:crypto";
import type { MonitoringRepository } from "../../db/repositories/monitoring-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type { SearchRepository } from "../../db/repositories/search-repository.js";
import type { VaultRepository } from "../../db/repositories/vault-repository.js";
import type {
  ExposureRecord,
  MonitoringAlert,
  WatchAddRequest,
  WatchCheckNowRequest,
  WatchCheckNowResponse,
  WatchRecord
} from "../../shared/schemas/monitoring.js";
import type { Observation, SearchRunResult, SourceStatus } from "../../shared/types/search.js";
import { buildSearchRunResult } from "../search/correlation.js";
import { fetchJson } from "../search/http.js";
import { credentialSources, type CredentialSource } from "./credential-sources.js";

export type MonitoringFetcher = typeof fetchJson;

export class MonitoringService {
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private schedulerBusy = false;

  public constructor(
    private readonly monitoringRepository: MonitoringRepository,
    private readonly casesRepository: CasesRepository,
    private readonly searchRepository: SearchRepository,
    private readonly auditRepository: AuditRepository,
    private readonly vaultRepository: VaultRepository,
    private readonly sources: readonly CredentialSource[] = credentialSources,
    private readonly fetcher: MonitoringFetcher = fetchJson,
    private readonly now: () => Date = () => new Date()
  ) {}

  public addWatch(request: WatchAddRequest): WatchRecord {
    const watch = this.monitoringRepository.addWatch({
      type: request.type,
      value: request.value,
      caseId: request.caseId,
      checkIntervalMinutes: request.checkIntervalMinutes
    });
    this.auditRepository.record({
      actor: "local-user",
      action: "watch.add",
      objectType: "watch",
      objectId: watch.id,
      sensitivity: "medium",
      detail: { type: watch.type, value: watch.value, caseId: watch.caseId }
    });
    return watch;
  }

  public listWatches(): { readonly watches: WatchRecord[]; readonly alerts: MonitoringAlert[] } {
    return {
      watches: this.monitoringRepository.listWatches(),
      alerts: this.monitoringRepository.listAlerts()
    };
  }

  public removeWatch(watchId: string): boolean {
    const removed = this.monitoringRepository.removeWatch(watchId);
    if (removed) {
      this.auditRepository.record({
        actor: "local-user",
        action: "watch.remove",
        objectType: "watch",
        objectId: watchId,
        sensitivity: "medium",
        detail: {}
      });
    }
    return removed;
  }

  public exposures(watchId?: string): ExposureRecord[] {
    return this.monitoringRepository.listExposures(watchId);
  }

  public async checkNow(request: WatchCheckNowRequest): Promise<WatchCheckNowResponse> {
    const watch = this.monitoringRepository.getWatch(request.watchId);
    if (!watch) {
      throw new Error(`Watch ${request.watchId} does not exist`);
    }
    return this.checkWatch(watch, request.caseId);
  }

  public async runDueRechecks(now = this.now()): Promise<readonly WatchCheckNowResponse[]> {
    const due = this.monitoringRepository.dueWatches(now);
    const results: WatchCheckNowResponse[] = [];
    for (const watch of due) {
      results.push(await this.checkWatch(watch));
    }
    return results;
  }

  public startScheduler(intervalMs = 60_000): () => void {
    if (this.scheduler) {
      return () => this.stopScheduler();
    }
    this.scheduler = setInterval(() => {
      if (this.schedulerBusy) {
        return;
      }
      this.schedulerBusy = true;
      void this.runDueRechecks()
        .catch((error: unknown) => {
          this.auditRepository.record({
            actor: "system",
            action: "watch.scheduler.failed",
            objectType: "watch",
            objectId: null,
            sensitivity: "medium",
            detail: { error: error instanceof Error ? error.message : "scheduled recheck failed" }
          });
        })
        .finally(() => {
          this.schedulerBusy = false;
        });
    }, intervalMs);
    this.scheduler.unref();
    return () => this.stopScheduler();
  }

  public stopScheduler(): void {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
  }

  private async checkWatch(watch: WatchRecord, overrideCaseId?: string): Promise<WatchCheckNowResponse> {
    const skippedSources: string[] = [];
    const sourceResults: ExposureRecord[] = [];
    const newExposures: ExposureRecord[] = [];
    const alerts: MonitoringAlert[] = [];

    for (const source of this.sources.filter((candidate) => candidate.supports(watch.type))) {
      if (source.requiresKey && source.keySource && !this.vaultRepository.has(source.keySource)) {
        skippedSources.push(source.id);
        continue;
      }
      try {
        const apiKey = source.requiresKey && source.keySource
          ? this.vaultRepository.readSecret(source.keySource, "local-user", `watch.check.${source.id}`)
          : undefined;
        const exposures = await source.check(watch.type, watch.value, { apiKey, fetchJson: this.fetcher });
        for (const exposureInput of exposures) {
          const stored = this.monitoringRepository.recordExposure(watch.id, exposureInput);
          sourceResults.push(stored.exposure);
          if (stored.isNew) {
            newExposures.push(stored.exposure);
            alerts.push(this.monitoringRepository.createAlert(stored.exposure, `${watch.value} exposed in ${stored.exposure.title}`));
          }
        }
      } catch (error) {
        skippedSources.push(`${source.id}:${error instanceof Error ? error.message : "source failed"}`);
      }
    }

    const savedItems = this.saveToCase(overrideCaseId ?? watch.caseId ?? undefined, watch, newExposures);
    const searchRun = this.saveCorrelationRun(watch, sourceResults);
    const checkedWatch = this.monitoringRepository.markChecked(watch.id, this.now().toISOString());
    this.auditRepository.record({
      actor: "local-user",
      action: "watch.check",
      objectType: "watch",
      objectId: watch.id,
      sensitivity: "medium",
      detail: {
        value: watch.value,
        exposures: sourceResults.length,
        newExposures: newExposures.length,
        skippedSources,
        searchRunId: searchRun?.runId ?? null
      }
    });

    return {
      watch: checkedWatch,
      exposures: sourceResults,
      newExposures,
      alerts,
      skippedSources,
      savedItems,
      searchRunId: searchRun?.runId ?? null
    };
  }

  private saveToCase(caseId: string | undefined, watch: WatchRecord, exposures: readonly ExposureRecord[]): number {
    if (!caseId) {
      return 0;
    }
    for (const exposure of exposures) {
      this.casesRepository.addItem({
        caseId,
        itemType: "observation",
        refId: exposure.id,
        title: `${watch.value} exposed in ${exposure.title}`,
        text: exposure.detail,
        metadata: {
          entity: watch.value,
          strength: 1,
          sourceId: exposure.source,
          watchId: watch.id,
          exposureId: exposure.id
        }
      });
    }
    return exposures.length;
  }

  private saveCorrelationRun(watch: WatchRecord, exposures: readonly ExposureRecord[]): SearchRunResult | null {
    if (exposures.length === 0) {
      return null;
    }
    const runId = randomUUID();
    const statuses = buildStatuses(exposures);
    const observations = exposures.map((exposure, index): Observation => ({
      id: `${runId}:monitoring:${index}`,
      runId,
      entity: `breach:${exposure.title.toLowerCase()}`,
      type: "breach",
      value: exposure.title,
      source: exposure.source,
      confidence: 1,
      raw: {
        watchId: watch.id,
        exposureId: exposure.id,
        detail: exposure.detail
      }
    }));
    const run = buildSearchRunResult({
      runId,
      seed: { type: watch.type, value: watch.value },
      startedTs: this.now().toISOString(),
      completedTs: this.now().toISOString(),
      statuses,
      observations
    });
    this.searchRepository.saveRun(run);
    return run;
  }
}

function buildStatuses(exposures: readonly ExposureRecord[]): SourceStatus[] {
  const counts = new Map<string, number>();
  for (const exposure of exposures) {
    counts.set(exposure.source, (counts.get(exposure.source) ?? 0) + 1);
  }
  return [...counts.entries()].map(([sourceId, observationCount]) => ({
    sourceId,
    label: sourceId,
    status: "returned" as const,
    observationCount
  }));
}
