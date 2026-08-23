/**
 * Audit writes are isolated in a repository so handlers can record intent
 * without knowing SQL column names. If raw inserts spread through handlers, later
 * sensitive actions would be harder to prove against the append-only invariant.
 */
import type { ReacherDatabase } from "../database.js";
import type { AuditEvent, AuditQueryRequest, AuditSensitivity } from "../../shared/schemas/audit.js";

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

  public query(input: AuditQueryRequest): AuditEvent[] {
    const clauses: string[] = [];
    const params: (number | string)[] = [];

    if (input.action) {
      clauses.push("action = ?");
      params.push(input.action);
    }
    if (input.objectType) {
      clauses.push("object_type = ?");
      params.push(input.objectType);
    }
    if (input.sensitivity) {
      clauses.push("sensitivity = ?");
      params.push(input.sensitivity);
    }
    if (input.target) {
      clauses.push("(object_id LIKE ? OR detail LIKE ?)");
      const targetLike = `%${input.target}%`;
      params.push(targetLike, targetLike);
    }
    if (input.dateFrom) {
      clauses.push("ts >= ?");
      params.push(this.normalizeDateFrom(input.dateFrom));
    }
    if (input.dateTo) {
      clauses.push("ts <= ?");
      params.push(this.normalizeDateTo(input.dateTo));
    }

    params.push(input.limit);
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT id, ts, actor, action, object_type, object_id, sensitivity, detail
         FROM audit_events
         ${where}
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(...params) as AuditRow[];

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

  private normalizeDateFrom(value: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  }

  private normalizeDateTo(value: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
  }
}
