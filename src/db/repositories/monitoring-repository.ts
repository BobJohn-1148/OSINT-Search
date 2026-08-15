/**
 * Monitoring persistence owns dedupe and alert rows because scheduled checks may
 * repeat the same exposure many times. If providers inserted rows directly,
 * every recheck could create noisy duplicate alerts and case evidence.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { ExposureRecord, MonitoringAlert, WatchRecord } from "../../shared/schemas/monitoring.js";
import type { WatchTargetType } from "../../shared/types/monitoring.js";

interface WatchRow {
  readonly id: string;
  readonly type: WatchTargetType;
  readonly value: string;
  readonly case_id: string | null;
  readonly check_interval_minutes: number;
  readonly created_ts: string;
  readonly last_checked_ts: string | null;
  readonly removed_ts: string | null;
}

interface ExposureRow {
  readonly id: string;
  readonly watch_id: string;
  readonly source: string;
  readonly title: string;
  readonly detail: string;
  readonly fingerprint: string;
  readonly first_seen_ts: string;
  readonly last_seen_ts: string;
}

interface AlertRow {
  readonly id: string;
  readonly exposure_id: string;
  readonly watch_id: string;
  readonly message: string;
  readonly created_ts: string;
  readonly acknowledged_ts: string | null;
}

export interface ExposureInput {
  readonly source: string;
  readonly title: string;
  readonly detail: string;
  readonly fingerprint: string;
}

export interface StoredExposureResult {
  readonly exposure: ExposureRecord;
  readonly isNew: boolean;
}

export class MonitoringRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public addWatch(input: {
    readonly type: WatchTargetType;
    readonly value: string;
    readonly caseId?: string;
    readonly checkIntervalMinutes: number;
  }): WatchRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO watchlist (id, type, value, case_id, check_interval_minutes)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(type, value) DO UPDATE SET
           case_id = excluded.case_id,
           check_interval_minutes = excluded.check_interval_minutes,
           removed_ts = NULL`
      )
      .run(id, input.type, normalizeWatchValue(input.value), input.caseId ?? null, input.checkIntervalMinutes);
    return this.findWatchByTypeValue(input.type, input.value) ?? this.missingWatch(id);
  }

  public listWatches(): WatchRecord[] {
    const rows = this.db.prepare("SELECT * FROM watchlist WHERE removed_ts IS NULL ORDER BY created_ts DESC, value").all() as WatchRow[];
    return rows.map(toWatch);
  }

  public getWatch(watchId: string): WatchRecord | null {
    const row = this.db.prepare("SELECT * FROM watchlist WHERE id = ? AND removed_ts IS NULL").get(watchId) as WatchRow | undefined;
    return row ? toWatch(row) : null;
  }

  public removeWatch(watchId: string): boolean {
    const result = this.db
      .prepare("UPDATE watchlist SET removed_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND removed_ts IS NULL")
      .run(watchId);
    return result.changes > 0;
  }

  public dueWatches(now: Date): WatchRecord[] {
    const rows = this.db.prepare("SELECT * FROM watchlist WHERE removed_ts IS NULL ORDER BY created_ts ASC, value").all() as WatchRow[];
    return rows.map(toWatch).filter((watch) => isDue(watch, now));
  }

  public markChecked(watchId: string, checkedTs: string): WatchRecord {
    this.db.prepare("UPDATE watchlist SET last_checked_ts = ? WHERE id = ?").run(checkedTs, watchId);
    return this.getWatch(watchId) ?? this.missingWatch(watchId);
  }

  public recordExposure(watchId: string, input: ExposureInput): StoredExposureResult {
    const id = randomUUID();
    const existing = this.findExposure(watchId, input.source, input.fingerprint);
    this.db
      .prepare(
        `INSERT INTO exposures (id, watch_id, source, title, detail, fingerprint)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(watch_id, source, fingerprint) DO UPDATE SET
           last_seen_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run(id, watchId, input.source, input.title, input.detail, input.fingerprint);
    const exposure = this.findExposure(watchId, input.source, input.fingerprint);
    if (!exposure) {
      throw new Error(`Exposure ${input.fingerprint} was not persisted`);
    }
    return { exposure, isNew: existing === null };
  }

  public createAlert(exposure: ExposureRecord, message: string): MonitoringAlert {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO monitoring_alerts (id, exposure_id, watch_id, message)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, exposure.id, exposure.watchId, message);
    return this.getAlert(id);
  }

  public listAlerts(limit = 50): MonitoringAlert[] {
    const rows = this.db
      .prepare("SELECT * FROM monitoring_alerts ORDER BY created_ts DESC, id DESC LIMIT ?")
      .all(limit) as AlertRow[];
    return rows.map(toAlert);
  }

  public listExposures(watchId?: string): ExposureRecord[] {
    const rows = watchId
      ? this.db.prepare("SELECT * FROM exposures WHERE watch_id = ? ORDER BY first_seen_ts DESC, title").all(watchId)
      : this.db.prepare("SELECT * FROM exposures ORDER BY first_seen_ts DESC, title").all();
    return (rows as ExposureRow[]).map(toExposure);
  }

  private findWatchByTypeValue(type: WatchTargetType, value: string): WatchRecord | null {
    const row = this.db
      .prepare("SELECT * FROM watchlist WHERE type = ? AND value = ? AND removed_ts IS NULL")
      .get(type, normalizeWatchValue(value)) as WatchRow | undefined;
    return row ? toWatch(row) : null;
  }

  private findExposure(watchId: string, source: string, fingerprint: string): ExposureRecord | null {
    const row = this.db
      .prepare("SELECT * FROM exposures WHERE watch_id = ? AND source = ? AND fingerprint = ?")
      .get(watchId, source, fingerprint) as ExposureRow | undefined;
    return row ? toExposure(row) : null;
  }

  private getAlert(alertId: string): MonitoringAlert {
    const row = this.db.prepare("SELECT * FROM monitoring_alerts WHERE id = ?").get(alertId) as AlertRow | undefined;
    if (!row) {
      throw new Error(`Alert ${alertId} was not persisted`);
    }
    return toAlert(row);
  }

  private missingWatch(watchId: string): never {
    throw new Error(`Watch ${watchId} does not exist`);
  }
}

function toWatch(row: WatchRow): WatchRecord {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    caseId: row.case_id,
    checkIntervalMinutes: row.check_interval_minutes,
    createdTs: row.created_ts,
    lastCheckedTs: row.last_checked_ts
  };
}

function toExposure(row: ExposureRow): ExposureRecord {
  return {
    id: row.id,
    watchId: row.watch_id,
    source: row.source,
    title: row.title,
    detail: row.detail,
    fingerprint: row.fingerprint,
    firstSeenTs: row.first_seen_ts,
    lastSeenTs: row.last_seen_ts
  };
}

function toAlert(row: AlertRow): MonitoringAlert {
  return {
    id: row.id,
    exposureId: row.exposure_id,
    watchId: row.watch_id,
    message: row.message,
    createdTs: row.created_ts,
    acknowledgedTs: row.acknowledged_ts
  };
}

function normalizeWatchValue(value: string): string {
  return value.trim().toLowerCase();
}

function isDue(watch: WatchRecord, now: Date): boolean {
  if (!watch.lastCheckedTs) {
    return true;
  }
  const nextCheckMs = new Date(watch.lastCheckedTs).getTime() + watch.checkIntervalMinutes * 60_000;
  return nextCheckMs <= now.getTime();
}
