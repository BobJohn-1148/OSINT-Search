/**
 * Analyzer repository centralizes import rows and CVE cache writes so parsers do
 * not learn SQL. If each analyzer wrote tables itself, cache invalidation and
 * import auditability would drift across five independent tools.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { VulnerabilityRecord } from "../../shared/schemas/analyzers.js";

interface VulnCacheRow {
  readonly response_json: string;
}

export class AnalyzersRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public recordEvtxImport(filePath: string, eventCount: number): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO evtx_imports (id, file_path, event_count) VALUES (?, ?, ?)").run(id, filePath, eventCount);
    return id;
  }

  public recordPcapImport(filePath: string, conversationCount: number): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO pcap_imports (id, file_path, conversation_count) VALUES (?, ?, ?)").run(id, filePath, conversationCount);
    return id;
  }

  public readVulnCache(cacheKey: string): VulnerabilityRecord[] | null {
    const row = this.db.prepare("SELECT response_json FROM vuln_cache WHERE cache_key = ?").get(cacheKey) as VulnCacheRow | undefined;
    return row ? JSON.parse(row.response_json) as VulnerabilityRecord[] : null;
  }

  public writeVulnCache(input: {
    readonly cacheKey: string;
    readonly product: string;
    readonly version?: string;
    readonly vulnerabilities: readonly VulnerabilityRecord[];
  }): void {
    this.db
      .prepare(
        `INSERT INTO vuln_cache (cache_key, product, version, response_json, fetched_ts)
         VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(cache_key) DO UPDATE SET
           product = excluded.product,
           version = excluded.version,
           response_json = excluded.response_json,
           fetched_ts = excluded.fetched_ts`
      )
      .run(input.cacheKey, input.product, input.version ?? null, JSON.stringify(input.vulnerabilities));
  }
}
