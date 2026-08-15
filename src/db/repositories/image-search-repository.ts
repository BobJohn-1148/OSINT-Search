/**
 * Image search persistence is intentionally tiny because observations carry the
 * searchable evidence while this table records provider provenance. If image
 * lookups wrote raw provider JSON here, reports would drift from case evidence.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { ImageSearchRecord } from "../../shared/schemas/image-username.js";
import type { ImageSearchSource } from "../../shared/types/image-username.js";

interface ImageSearchRow {
  readonly id: string;
  readonly path: string;
  readonly source: ImageSearchSource;
  readonly result_ref: string;
  readonly ts: string;
}

export class ImageSearchRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public record(input: { readonly path: string; readonly source: ImageSearchSource; readonly resultRef: string }): ImageSearchRecord {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO image_searches (id, path, source, result_ref) VALUES (?, ?, ?, ?)")
      .run(id, input.path, input.source, input.resultRef);
    return this.get(id) ?? this.missing(id);
  }

  public list(): ImageSearchRecord[] {
    const rows = this.db.prepare("SELECT * FROM image_searches ORDER BY ts DESC, id DESC").all() as ImageSearchRow[];
    return rows.map(toRecord);
  }

  private get(id: string): ImageSearchRecord | null {
    const row = this.db.prepare("SELECT * FROM image_searches WHERE id = ?").get(id) as ImageSearchRow | undefined;
    return row ? toRecord(row) : null;
  }

  private missing(id: string): never {
    throw new Error(`Image search ${id} was not persisted`);
  }
}

function toRecord(row: ImageSearchRow): ImageSearchRecord {
  return {
    id: row.id,
    path: row.path,
    source: row.source,
    resultRef: row.result_ref,
    ts: row.ts
  };
}
