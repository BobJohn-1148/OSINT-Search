/**
 * Audit writes are isolated in a repository so handlers can record intent
 * without knowing SQL column names. If raw inserts spread through handlers, later
 * sensitive actions would be harder to prove against the append-only invariant.
 */
import type { ReacherDatabase } from "../database.js";
import type { AuditEvent, AuditSensitivity } from "../../shared/schemas/audit.js";

interface AuditRow {
  readonly id: number;
  readonly ts: string;
  readonly actor: string;
  readonly action: string;
  readonly object_type: string;
  readonly object_id: string | null;
  readonly sensitivity: AuditSensitivity;
  readonly detail: string;
}

export interface RecordAuditEventInput {
  readonly actor: string;
  readonly action: string;
  readonly objectType: string;
  readonly objectId?: string | null;
  readonly sensitivity: AuditSensitivity;
  readonly detail: Record<string, unknown>;
}

export class AuditRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public record(input: RecordAuditEventInput): AuditEvent {
    const result = this.db
      .prepare(
        `INSERT INTO audit_events (actor, action, object_type, object_id, sensitivity, detail)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.actor,
        input.action,
        input.objectType,
        input.objectId ?? null,
        input.sensitivity,
        JSON.stringify(input.detail)
      );

    return this.getById(Number(result.lastInsertRowid));
  }

  public list(limit: number): AuditEvent[] {
    const rows = this.db
      .prepare(
        `SELECT id, ts, actor, action, object_type, object_id, sensitivity, detail
         FROM audit_events
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(limit) as AuditRow[];

    return rows.map((row) => this.toEvent(row));
  }

  private getById(id: number): AuditEvent {
    const row = this.db
      .prepare(
        `SELECT id, ts, actor, action, object_type, object_id, sensitivity, detail
         FROM audit_events
         WHERE id = ?`
      )
      .get(id);

    if (!row) {
      throw new Error(`Audit event ${id} was not persisted`);
    }

    return this.toEvent(row as AuditRow);
  }

  private toEvent(row: AuditRow): AuditEvent {
    return {
      id: row.id,
      ts: row.ts,
      actor: row.actor,
      action: row.action,
      objectType: row.object_type,
      objectId: row.object_id,
      sensitivity: row.sensitivity,
      detail: JSON.parse(row.detail) as Record<string, unknown>
    };
  }
}
