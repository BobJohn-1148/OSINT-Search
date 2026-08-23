/**
 * The tools repository is the only SQL surface for WSL catalog, authorization,
 * and captured run rows. If launch code wrote these tables directly, the active
 * gate and case attachment path would be much harder to prove in tests.
 */
import { randomUUID } from "node:crypto";
import type { ReacherDatabase } from "../database.js";
import type { ToolCategory, ToolRunStatus, ToolTier } from "../../shared/types/tools.js";
import type { AuthorizationRecord, ToolCatalogRecord, ToolRunRecord } from "../../shared/schemas/tools.js";

interface ToolCatalogRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly install_command: string;
  readonly official_link: string;
  readonly category: ToolCategory;
  readonly tier: ToolTier;
  readonly default_args_json: string;
}

interface AuthorizationRow {
  readonly id: string;
  readonly target: string;
  readonly tier: ToolTier;
  readonly created_ts: string;
  readonly expires_ts: string;
}

interface ToolRunRow {
  readonly id: string;
  readonly tool_id: string;
  readonly case_id: string | null;
  readonly target: string;
  readonly wsl_distro: string;
  readonly argv_json: string;
  readonly status: ToolRunStatus;
  readonly stdout: string;
  readonly stderr: string;
  readonly started_ts: string;
  readonly completed_ts: string | null;
  readonly authorization_id: string | null;
}

export interface CreateToolRunInput {
  readonly toolId: string;
  readonly caseId?: string | null;
  readonly target: string;
  readonly wslDistro: string;
  readonly argv: readonly string[];
  readonly status: ToolRunStatus;
  readonly authorizationId?: string | null;
}

export interface FinishToolRunInput {
  readonly runId: string;
  readonly status: Extract<ToolRunStatus, "succeeded" | "failed" | "blocked">;
  readonly stdout: string;
  readonly stderr: string;
}

export class ToolsRepository {
  public constructor(private readonly db: ReacherDatabase) {}

  public listCatalog(): ToolCatalogRecord[] {
    const rows = this.db.prepare("SELECT * FROM tool_catalog ORDER BY name COLLATE NOCASE").all() as ToolCatalogRow[];
    return rows.map((row) => this.toCatalog(row));
  }

  public getCatalog(toolId: string): ToolCatalogRecord | null {
    const row = this.db.prepare("SELECT * FROM tool_catalog WHERE id = ?").get(toolId) as ToolCatalogRow | undefined;
    return row ? this.toCatalog(row) : null;
  }

  public addCatalog(input: Omit<ToolCatalogRecord, "id">): ToolCatalogRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO tool_catalog
         (id, name, description, install_command, official_link, category, tier, default_args_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description,
        input.installCommand,
        input.officialLink,
        input.category,
        input.tier,
        JSON.stringify(input.defaultArgs)
      );
    return this.getCatalog(id) ?? this.missingTool(id);
  }

  public updateCatalog(input: ToolCatalogRecord): ToolCatalogRecord {
    const result = this.db
      .prepare(
        `UPDATE tool_catalog
         SET name = ?, description = ?, install_command = ?, official_link = ?, category = ?, tier = ?, default_args_json = ?
         WHERE id = ?`
      )
      .run(
        input.name,
        input.description,
        input.installCommand,
        input.officialLink,
        input.category,
        input.tier,
        JSON.stringify(input.defaultArgs),
        input.id
      );
    if (result.changes === 0) {
      throw new Error(`Tool ${input.id} does not exist`);
    }
    return this.getCatalog(input.id) ?? this.missingTool(input.id);
  }

  public createAuthorization(input: { readonly target: string; readonly tier: ToolTier; readonly expiresTs: string }): AuthorizationRecord {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO authorizations (id, target, tier, expires_ts) VALUES (?, ?, ?, ?)")
      .run(id, input.target, input.tier, input.expiresTs);
    return this.getAuthorization(id) ?? this.missingAuthorization(id);
  }

  public listAuthorizations(): AuthorizationRecord[] {
    const rows = this.db.prepare("SELECT * FROM authorizations ORDER BY created_ts DESC").all() as AuthorizationRow[];
    return rows.map((row) => this.toAuthorization(row));
  }

  public findMatchingAuthorization(input: {
    readonly target: string;
    readonly tier: ToolTier;
    readonly nowTs: string;
  }): AuthorizationRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM authorizations
         WHERE target = ? AND tier = ? AND expires_ts > ?
         ORDER BY expires_ts DESC
         LIMIT 1`
      )
      .get(input.target, input.tier, input.nowTs) as AuthorizationRow | undefined;
    return row ? this.toAuthorization(row) : null;
  }

  public createRun(input: CreateToolRunInput): ToolRunRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO tool_runs
         (id, tool_id, case_id, target, wsl_distro, argv_json, status, authorization_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.toolId,
        input.caseId ?? null,
        input.target,
        input.wslDistro,
        JSON.stringify(input.argv),
        input.status,
        input.authorizationId ?? null
      );
    return this.getRun(id) ?? this.missingRun(id);
  }

  public finishRun(input: FinishToolRunInput): ToolRunRecord {
    const result = this.db
      .prepare(
        `UPDATE tool_runs
         SET status = ?, stdout = ?, stderr = ?, completed_ts = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(input.status, input.stdout, input.stderr, input.runId);
    if (result.changes === 0) {
      throw new Error(`Tool run ${input.runId} does not exist`);
    }
    return this.getRun(input.runId) ?? this.missingRun(input.runId);
  }

  public getRun(runId: string): ToolRunRecord | null {
    const row = this.db.prepare("SELECT * FROM tool_runs WHERE id = ?").get(runId) as ToolRunRow | undefined;
    return row ? this.toRun(row) : null;
  }

  private getAuthorization(authorizationId: string): AuthorizationRecord | null {
    const row = this.db
      .prepare("SELECT * FROM authorizations WHERE id = ?")
      .get(authorizationId) as AuthorizationRow | undefined;
    return row ? this.toAuthorization(row) : null;
  }

  private toCatalog(row: ToolCatalogRow): ToolCatalogRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      installCommand: row.install_command,
      officialLink: row.official_link,
      category: row.category,
      tier: row.tier,
      defaultArgs: JSON.parse(row.default_args_json) as string[]
    };
  }

  private toAuthorization(row: AuthorizationRow): AuthorizationRecord {
    return {
      id: row.id,
      target: row.target,
      tier: row.tier,
      createdTs: row.created_ts,
      expiresTs: row.expires_ts
    };
  }

  private toRun(row: ToolRunRow): ToolRunRecord {
    return {
      id: row.id,
      toolId: row.tool_id,
      caseId: row.case_id,
      target: row.target,
      wslDistro: row.wsl_distro,
      argv: JSON.parse(row.argv_json) as string[],
      status: row.status,
      stdout: row.stdout,
      stderr: row.stderr,
      startedTs: row.started_ts,
      completedTs: row.completed_ts,
      authorizationId: row.authorization_id
    };
  }

  private missingTool(toolId: string): never {
    throw new Error(`Tool ${toolId} was not persisted`);
  }

  private missingAuthorization(authorizationId: string): never {
    throw new Error(`Authorization ${authorizationId} was not persisted`);
  }

  private missingRun(runId: string): never {
    throw new Error(`Tool run ${runId} was not persisted`);
  }
}
