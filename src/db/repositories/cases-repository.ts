/**
 * Case persistence owns every SQL write for cases and evidence because saveable
 * results must not depend on which UI surface produced them. If search, agents,
 * and reports wrote case rows directly, timelines and FTS would drift by source.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { CaseItemType } from "../../shared/types/cases.js";
import type { CaseItem, CaseRecord, CaseSummary } from "../../shared/schemas/cases.js";

interface CaseRow {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "archived";
  readonly created_ts: string;
  readonly updated_ts: string;
}

interface CaseItemRow {
  readonly id: string;
  readonly case_id: string;
  readonly item_type: CaseItemType;
  readonly ref_id: string | null;
  readonly title: string;
  readonly text: string;
  readonly source_ts: string;
  readonly metadata: string;
}

export class CasesRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public create(title: string, tags: readonly string[]): CaseRecord {
    const id = randomUUID();
    const write = this.db.transaction(() => {
      this.db.prepare("INSERT INTO cases (id, title, status) VALUES (?, ?, 'open')").run(id, title);
      this.replaceTags(id, tags);
    });
    write();
    return this.getCase(id) ?? this.missingCase(id);
  }

  public list(): CaseRecord[] {
    const rows = this.db.prepare("SELECT * FROM cases ORDER BY updated_ts DESC, title").all() as CaseRow[];
    return rows.map((row) => this.toCase(row));
  }

  public get(caseId: string): { readonly case: CaseRecord | null; readonly items: CaseItem[] } {
    return {
      case: this.getCase(caseId),
      items: this.timeline(caseId)
    };
  }

  public update(input: {
    readonly caseId: string;
    readonly title?: string;
    readonly status?: "open" | "archived";
    readonly tags?: readonly string[];
  }): CaseRecord {
    const existing = this.getCase(input.caseId);
    if (!existing) {
      throw new Error(`Case ${input.caseId} does not exist`);
    }

    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE cases
           SET title = ?, status = ?, updated_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?`
        )
        .run(input.title ?? existing.title, input.status ?? existing.status, input.caseId);
      if (input.tags) {
        this.replaceTags(input.caseId, input.tags);
      }
    });
    write();
    return this.getCase(input.caseId) ?? this.missingCase(input.caseId);
  }

  public addItem(input: {
    readonly caseId: string;
    readonly itemType: CaseItemType;
    readonly refId?: string | null;
    readonly title: string;
    readonly text: string;
    readonly sourceTs?: string;
    readonly metadata: Record<string, unknown>;
  }): CaseItem {
    if (!this.getCase(input.caseId)) {
      throw new Error(`Case ${input.caseId} does not exist`);
    }
    const id = randomUUID();
    const sourceTs = input.sourceTs ?? new Date().toISOString();
    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO case_items (id, case_id, item_type, ref_id, title, text, source_ts, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.caseId,
          input.itemType,
          input.refId ?? null,
          input.title,
          input.text,
          sourceTs,
          JSON.stringify(input.metadata)
        );
      this.touch(input.caseId);
    });
    write();
    return this.getItem(id) ?? this.missingItem(id);
  }

  public timeline(caseId: string): CaseItem[] {
    const rows = this.db
      .prepare("SELECT * FROM case_items WHERE case_id = ? ORDER BY source_ts ASC, id ASC")
      .all(caseId) as CaseItemRow[];
    return rows.map((row) => this.toItem(row));
  }

  public summary(caseId: string): CaseSummary {
    const items = this.timeline(caseId);
    const counts: Record<string, number> = {};
    const entities = new Map<string, { strength: number; count: number }>();

    for (const item of items) {
      counts[item.itemType] = (counts[item.itemType] ?? 0) + 1;
      const entity = typeof item.metadata.entity === "string" ? item.metadata.entity : null;
      const strength = typeof item.metadata.strength === "number" ? Math.max(1, Math.round(item.metadata.strength)) : 1;
      if (entity) {
        const existing = entities.get(entity) ?? { strength: 0, count: 0 };
        entities.set(entity, {
          strength: Math.max(existing.strength, strength),
          count: existing.count + 1
        });
      }
    }

    return {
      caseId,
      counts,
      keyEntities: [...entities.entries()]
        .map(([entity, value]) => ({ entity, ...value }))
        .sort((a, b) => b.strength - a.strength || b.count - a.count || a.entity.localeCompare(b.entity))
    };
  }

  public search(caseId: string, query: string): CaseItem[] {
    const ftsQuery = toFtsPrefixQuery(query);
    const rows = this.db
      .prepare(
        `SELECT case_items.*
         FROM case_items_fts
         JOIN case_items ON case_items_fts.rowid = case_items.rowid
         WHERE case_items_fts MATCH ? AND case_items.case_id = ?
         ORDER BY case_items.source_ts ASC`
      )
      .all(ftsQuery, caseId) as CaseItemRow[];
    if (rows.length > 0) {
      return rows.map((row) => this.toItem(row));
    }

    const likeRows = this.db
      .prepare(
        `SELECT *
         FROM case_items
         WHERE case_id = ? AND (title LIKE ? OR text LIKE ?)
         ORDER BY source_ts ASC`
      )
      .all(caseId, `%${query}%`, `%${query}%`) as CaseItemRow[];
    return likeRows.map((row) => this.toItem(row));
  }

  private replaceTags(caseId: string, tags: readonly string[]): void {
    this.db.prepare("DELETE FROM case_tags WHERE case_id = ?").run(caseId);
    const insert = this.db.prepare("INSERT OR IGNORE INTO case_tags (case_id, tag) VALUES (?, ?)");
    for (const tag of tags) {
      insert.run(caseId, tag);
    }
  }

  private getCase(caseId: string): CaseRecord | null {
    const row = this.db.prepare("SELECT * FROM cases WHERE id = ?").get(caseId) as CaseRow | undefined;
    return row ? this.toCase(row) : null;
  }

  private getItem(itemId: string): CaseItem | null {
    const row = this.db.prepare("SELECT * FROM case_items WHERE id = ?").get(itemId) as CaseItemRow | undefined;
    return row ? this.toItem(row) : null;
  }

  private toCase(row: CaseRow): CaseRecord {
    const tags = this.db.prepare("SELECT tag FROM case_tags WHERE case_id = ? ORDER BY tag").all(row.id) as { tag: string }[];
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      createdTs: row.created_ts,
      updatedTs: row.updated_ts,
      tags: tags.map((tag) => tag.tag)
    };
  }

  private toItem(row: CaseItemRow): CaseItem {
    return {
      id: row.id,
      caseId: row.case_id,
      itemType: row.item_type,
      refId: row.ref_id,
      title: row.title,
      text: row.text,
      sourceTs: row.source_ts,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>
    };
  }

  private touch(caseId: string): void {
    this.db.prepare("UPDATE cases SET updated_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(caseId);
  }

  private missingCase(caseId: string): never {
    throw new Error(`Case ${caseId} was not persisted`);
  }

  private missingItem(itemId: string): never {
    throw new Error(`Case item ${itemId} was not persisted`);
  }
}

function toFtsPrefixQuery(query: string): string {
  const tokens = query.match(/[A-Za-z0-9_]+/g) ?? [];
  return tokens.map((token) => `"${token}"*`).join(" OR ") || "\"\"";
}
