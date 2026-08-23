/**
 * Tool orchestration stays in main because WSL processes, active-scan approval,
 * audit events, and case evidence are host responsibilities. If the renderer
 * launched tools or decided authorization locally, a compromised view could run
 * active scans outside Reacher's policy boundary.
 */
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type { ToolsRepository } from "../../db/repositories/tools-repository.js";
import type {
  AuthorizationRecord,
  CatalogAddRequest,
  CatalogUpdateRequest,
  ToolCatalogRecord,
  ToolOutputEvent,
  ToolsLaunchRequest
} from "../../shared/schemas/tools.js";
import type { ToolTier } from "../../shared/types/tools.js";
import type { ToolOutputListener, WslToolLauncher } from "./wsl-launcher.js";

export class ToolsService {
  public constructor(
    private readonly toolsRepository: ToolsRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly launcher: WslToolLauncher,
    private readonly emitOutput: ToolOutputListener
  ) {}

  public listCatalog(): ToolCatalogRecord[] {
    return this.toolsRepository.listCatalog();
  }

  public async detect(wslDistro: string): Promise<{ readonly toolId: string; readonly installed: boolean }[]> {
    const executables = this.toolsRepository
      .listCatalog()
      .map((tool) => ({ toolId: tool.id, executable: tool.defaultArgs[0] }))
      .filter((tool): tool is { readonly toolId: string; readonly executable: string } => Boolean(tool.executable));
    return [...(await this.launcher.detect({ wslDistro, executables }))];
  }

  public async launch(request: ToolsLaunchRequest) {
    const tool = this.toolsRepository.getCatalog(request.toolId);
    if (!tool) {
      throw new Error(`Tool ${request.toolId} does not exist`);
    }

    const argv = [...tool.defaultArgs, request.target];
    const authorization = tool.tier === "active" ? this.requireAuthorization(request.target, tool.tier) : null;
    if (tool.tier === "active" && !authorization) {
      const blockedRun = this.toolsRepository.createRun({
        toolId: tool.id,
        caseId: request.caseId ?? null,
        target: request.target,
        wslDistro: request.wslDistro,
        argv,
        status: "blocked"
      });
      const run = this.toolsRepository.finishRun({
        runId: blockedRun.id,
        status: "blocked",
        stdout: "",
        stderr: "Active tool launch blocked because no exact unexpired authorization exists for this target."
      });
      this.auditRepository.record({
        actor: "local-user",
        action: "tool.launch.blocked",
        objectType: "tool_run",
        objectId: run.id,
        sensitivity: "medium",
        detail: { toolId: tool.id, target: request.target, tier: tool.tier }
      });
      return run;
    }

    const startedRun = this.toolsRepository.createRun({
      toolId: tool.id,
      caseId: request.caseId ?? null,
      target: request.target,
      wslDistro: request.wslDistro,
      argv,
      status: "running",
      authorizationId: authorization?.id ?? null
    });
    this.auditRepository.record({
      actor: "local-user",
      action: "tool.launch",
      objectType: "tool_run",
      objectId: startedRun.id,
      sensitivity: "medium",
      detail: { toolId: tool.id, target: request.target, tier: tool.tier, caseId: request.caseId ?? null }
    });

    const result = await this.launcher.run({
      runId: startedRun.id,
      wslDistro: request.wslDistro,
      argv,
      onOutput: (event: ToolOutputEvent) => this.emitOutput(event)
    });
    const run = this.toolsRepository.finishRun({
      runId: startedRun.id,
      status: result.exitCode === 0 ? "succeeded" : "failed",
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (request.caseId) {
      this.casesRepository.addItem({
        caseId: request.caseId,
        itemType: "tool_run",
        refId: run.id,
        title: `${tool.name} on ${request.target}`,
        text: formatToolEvidenceText(result.stdout, result.stderr),
        sourceTs: run.completedTs ?? run.startedTs,
        metadata: { toolId: tool.id, target: request.target, tier: tool.tier, status: run.status }
      });
    }

    return run;
  }

  public addCatalog(input: CatalogAddRequest): ToolCatalogRecord {
    const tool = this.toolsRepository.addCatalog(input);
    this.auditRepository.record({
      actor: "local-user",
      action: "tool.catalog.add",
      objectType: "tool",
      objectId: tool.id,
      sensitivity: "medium",
      detail: { name: tool.name, tier: tool.tier }
    });
    return tool;
  }

  public updateCatalog(input: CatalogUpdateRequest): ToolCatalogRecord {
    const tool = this.toolsRepository.updateCatalog(input);
    this.auditRepository.record({
      actor: "local-user",
      action: "tool.catalog.update",
      objectType: "tool",
      objectId: tool.id,
      sensitivity: "medium",
      detail: { name: tool.name, tier: tool.tier }
    });
    return tool;
  }

  public createAuthorization(input: {
    readonly target: string;
    readonly tier: ToolTier;
    readonly expiresTs: string;
  }): AuthorizationRecord {
    const authorization = this.toolsRepository.createAuthorization(input);
    this.auditRepository.record({
      actor: "local-user",
      action: "tool.authorization.create",
      objectType: "authorization",
      objectId: authorization.id,
      sensitivity: "medium",
      detail: { target: authorization.target, tier: authorization.tier, expiresTs: authorization.expiresTs }
    });
    return authorization;
  }

  public listAuthorizations(): AuthorizationRecord[] {
    return this.toolsRepository.listAuthorizations();
  }

  private requireAuthorization(target: string, tier: ToolTier): AuthorizationRecord | null {
    return this.toolsRepository.findMatchingAuthorization({
      target,
      tier,
      nowTs: new Date().toISOString()
    });
  }
}

function formatToolEvidenceText(stdout: string, stderr: string): string {
  const parts = [];
  if (stdout.trim()) {
    parts.push(stdout.trim());
  }
  if (stderr.trim()) {
    parts.push(`stderr\n${stderr.trim()}`);
  }
  return parts.join("\n\n") || "Tool completed without captured output.";
}
