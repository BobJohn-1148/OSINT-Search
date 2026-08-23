/**
 * The vault repository is the only read gate for API secrets because every
 * decrypted read must be audited before the value leaves storage. If handlers
 * decrypted ciphertext themselves, revocation and audit guarantees would split
 * across call sites.
 */
import type { ReacherDatabase } from "../database.js";
import type { AuditRepository } from "./audit-repository.js";
import type { VaultCrypto } from "../../main/security/vault-crypto.js";
import type { KeySource } from "../../shared/types/sources.js";
import type { KeyMetadata } from "../../shared/schemas/keys.js";

interface KeyRow {
  readonly id: number;
  readonly source: KeySource;
  readonly ciphertext: string;
  readonly created_ts: string;
  readonly last_used_ts: string | null;
}

export class VaultRepository {
  public constructor(
    private readonly db: ReacherDatabase,
    private readonly crypto: VaultCrypto,
    private readonly auditRepository: AuditRepository
  ) {}

  public add(source: KeySource, secret: string): KeyMetadata {
    const ciphertext = this.crypto.encryptString(secret);
    this.db
      .prepare(
        `INSERT INTO api_keys (source, ciphertext)
         VALUES (?, ?)
         ON CONFLICT(source) DO UPDATE SET ciphertext = excluded.ciphertext`
      )
      .run(source, ciphertext);

    return this.getMetadata(source);
  }

  public list(): KeyMetadata[] {
    const rows = this.db
      .prepare("SELECT id, source, created_ts, last_used_ts FROM api_keys ORDER BY source")
      .all() as Omit<KeyRow, "ciphertext">[];

    return rows.map((row) => this.toMetadata(row));
  }

  public has(source: KeySource): boolean {
    return Boolean(this.db.prepare("SELECT id FROM api_keys WHERE source = ?").get(source));
  }

  public readSecret(source: KeySource, actor: string, purpose: string): string {
    const row = this.db.prepare("SELECT * FROM api_keys WHERE source = ?").get(source) as KeyRow | undefined;
    if (!row) {
      throw new Error(`No API key is stored for ${source}`);
    }

    this.auditRepository.record({
      actor,
      action: "key.read",
      objectType: "api_key",
      objectId: source,
      sensitivity: "sensitive",
      detail: { source, purpose }
    });

    this.db
      .prepare("UPDATE api_keys SET last_used_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source = ?")
      .run(source);

    return this.crypto.decryptString(row.ciphertext);
  }

  public revoke(source: KeySource): boolean {
    const result = this.db.prepare("DELETE FROM api_keys WHERE source = ?").run(source);
    return result.changes > 0;
  }

  public getCiphertextForTest(source: KeySource): string | null {
    const row = this.db.prepare("SELECT ciphertext FROM api_keys WHERE source = ?").get(source) as
      | Pick<KeyRow, "ciphertext">
      | undefined;
    return row?.ciphertext ?? null;
  }

  private getMetadata(source: KeySource): KeyMetadata {
    const row = this.db.prepare("SELECT id, source, created_ts, last_used_ts FROM api_keys WHERE source = ?").get(source);
    if (!row) {
      throw new Error(`API key metadata for ${source} was not persisted`);
    }

    return this.toMetadata(row as Omit<KeyRow, "ciphertext">);
  }

  private toMetadata(row: Omit<KeyRow, "ciphertext">): KeyMetadata {
    return {
      id: row.id,
      source: row.source,
      createdTs: row.created_ts,
      lastUsedTs: row.last_used_ts
    };
  }
}
