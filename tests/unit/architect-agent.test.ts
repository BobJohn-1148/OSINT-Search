/**
 * Architect tests use the real repositories because Phase 6 is about safe
 * write boundaries, not generated prose. If confirm and audit were mocked away,
 * an in-app code agent could appear safe while writing without owner approval.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "../../src/db/migrations/runner";
import { AgentRuntimeRepository } from "../../src/db/repositories/agent-runtime-repository";
import { AgentsRepository } from "../../src/db/repositories/agents-repository";
import { AuditRepository } from "../../src/db/repositories/audit-repository";
import { ArchitectAgentService } from "../../src/main/agents/architect-agent-service";
import type { ArchitectApplyExecutor } from "../../src/main/agents/architect-apply-executor";
import { PlanArtifactApplyExecutor } from "../../src/main/agents/architect-apply-executor";
import type { ArchitectChatProvider, ArchitectProviderContext } from "../../src/main/agents/architect-chat-provider";
import { ArchitectProviderResolver } from "../../src/main/agents/architect-chat-provider";
import { RepoReadTool } from "../../src/main/agents/repo-read-tool";
import type { ArchitectProposal } from "../../src/shared/schemas/architect-agent";
import type { ProviderId } from "../../src/shared/types/providers";

class RecordingArchitectProvider implements ArchitectChatProvider {
  public constructor(public readonly id: ProviderId = "openai") {}

  public readonly calls: (ArchitectProviderContext & { readonly question?: string; readonly request?: string })[] = [];

  public ask(input: ArchitectProviderContext & { readonly question: string }): string {
    this.calls.push(input);
    return `provider answer from ${input.model} for ${input.question} using ${input.citations.map((citation) => citation.file).join(", ")}`;
  }

  public proposePlan(input: ArchitectProviderContext & { readonly request: string }): Pick<ArchitectProposal, "summary" | "steps"> {
    this.calls.push(input);
    return {
      summary: `Provider plan for ${input.request}`,
      steps: [
        {
          title: "Provider step",
          files: input.citations.map((citation) => citation.file),
          reason: `Model ${input.model} received ${input.prompt.length} prompt characters.`
        }
      ]
    };
  }
}

class RecordingApplyExecutor implements ArchitectApplyExecutor {
  public readonly proposals: ArchitectProposal[] = [];
  public readonly planned: ArchitectProposal[] = [];

  public plan(proposal: ArchitectProposal): readonly string[] {
    this.planned.push(proposal);
    return [`planning/architect-applied/${proposal.id}.md`];
  }

  public apply(proposal: ArchitectProposal): readonly string[] {
    this.proposals.push(proposal);
    return [`planning/architect-applied/${proposal.id}.md`];
  }
}

function createArchitect(
  confirmApply: boolean,
  repoRoot = process.cwd(),
  providerResolver = new ArchitectProviderResolver([new RecordingArchitectProvider()]),
  executor: ArchitectApplyExecutor = new RecordingApplyExecutor()
) {
  const db = new Database(":memory:");
  runMigrations(db);
  const agentsRepository = new AgentsRepository(db);
  const runtimeRepository = new AgentRuntimeRepository(db);
  const auditRepository = new AuditRepository(db);
  const service = new ArchitectAgentService(
    agentsRepository,
    runtimeRepository,
    auditRepository,
    repoRoot,
    () => confirmApply,
    providerResolver,
    executor,
    () => new Date("2026-08-11T12:00:00.000Z")
  );
  return { agentsRepository, auditRepository, executor, runtimeRepository, service };
}

it("answers a codebase question citing real files so architecture advice is grounded", () => {
  const { service } = createArchitect(false);

  const response = service.ask({ question: "How is IPC wired?", files: ["src/shared/ipc.ts"] });

  expect(response.answer).toContain("provider answer from codex");
  expect(response.citations.map((citation) => citation.file)).toContain("src/shared/ipc.ts");
  expect(response.model).toBe("codex");
});

it("can start without source checkout files so packaged app startup is not blocked", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-packaged-root-"));
  const { service } = createArchitect(false, tempRoot);

  expect(() => service.ask({ question: "How is IPC wired?", files: [] })).toThrow(
    "Architect agent requires a Reacher source checkout with CLAUDE.md"
  );
});

it("drafts a plan citing real files so feature work starts from repo context", () => {
  const provider = new RecordingArchitectProvider();
  const { service } = createArchitect(false, process.cwd(), new ArchitectProviderResolver([provider]));

  const response = service.proposePlan({
    request: "Add an audit log filter",
    files: ["src/shared/ipc.ts", "src/main/ipc/register.ts"]
  });

  expect(response.proposal.summary).toBe("Provider plan for Add an audit log filter");
  expect(response.proposal.citations.map((citation) => citation.file)).toEqual(
    expect.arrayContaining(["CLAUDE.md", "planning/REACHER_PLAN.md", "src/shared/ipc.ts", "src/main/ipc/register.ts"])
  );
  expect(response.proposal.steps.some((step) => step.files.includes("src/shared/ipc.ts"))).toBe(true);
  expect(provider.calls[0]).toMatchObject({ model: "codex", request: "Add an audit log filter" });
});

it("no write happens without an explicit confirm so architect apply cannot bypass the owner", async () => {
  const executor = new RecordingApplyExecutor();
  const { auditRepository, runtimeRepository, service } = createArchitect(false, process.cwd(), new ArchitectProviderResolver([new RecordingArchitectProvider()]), executor);
  const proposal = service.proposePlan({ request: "Change a component", files: ["src/renderer/App.tsx"] }).proposal;

  const result = await service.apply({ proposalId: proposal.id });

  expect(result).toMatchObject({ applied: false, memoryKey: null, changedFiles: [], audited: true });
  expect(executor.planned).toEqual([]);
  expect(executor.proposals).toEqual([]);
  expect(runtimeRepository.listMemory("global", 10)).toEqual([]);
  expect(auditRepository.list(10)[0]).toMatchObject({ action: "agent.architect.apply.cancelled" });
});

it("provider and model is switchable and architect actions are audited", async () => {
  const { agentsRepository, auditRepository, runtimeRepository, service } = createArchitect(true);
  agentsRepository.setModel("architect-agent", "openai", "gpt-5.1-mini");
  const proposal = service.proposePlan({ request: "Add a setting", files: ["src/renderer/components/settings-view.tsx"] }).proposal;

  const result = await service.apply({ proposalId: proposal.id });

  expect(proposal).toMatchObject({ provider: "openai", model: "gpt-5.1-mini" });
  expect(result.applied).toBe(true);
  expect(result.changedFiles).toEqual([`planning/architect-applied/${proposal.id}.md`]);
  expect(runtimeRepository.listMemory("global", 10)[0]?.key).toBe(result.memoryKey);
  expect(auditRepository.list(10).map((event) => event.action)).toEqual(
    expect.arrayContaining(["agent.architect.proposePlan", "agent.architect.apply.approved", "agent.architect.apply"])
  );
});

it("invokes the switched architect provider so Settings changes affect Codex calls", () => {
  const xaiProvider = new RecordingArchitectProvider("xai");
  const { agentsRepository, service } = createArchitect(
    false,
    process.cwd(),
    new ArchitectProviderResolver([new RecordingArchitectProvider(), xaiProvider])
  );
  agentsRepository.setModel("architect-agent", "xai", "grok-4.6");

  service.ask({ question: "Which provider handles this?", files: ["src/shared/ipc.ts"] });

  expect(xaiProvider.calls[0]).toMatchObject({ provider: "xai", model: "grok-4.6" });
});

it("uses shared memory so architect plans persist across agents and providers", async () => {
  const { runtimeRepository, service } = createArchitect(true);
  const proposal = service.proposePlan({ request: "Remember a decision", files: ["src/shared/ipc.ts"] }).proposal;

  const applied = await service.apply({ proposalId: proposal.id });
  const answer = service.ask({ question: "What memory exists?", files: ["src/shared/ipc.ts"] });

  expect(runtimeRepository.listMemory("global", 10)[0]).toMatchObject({
    key: applied.memoryKey,
    sourceAgent: "architect-agent",
    value: proposal.summary
  });
  expect(answer.memoryCount).toBe(1);
});

it("approved confirm writes a plan artifact so architect apply performs a repo change", async () => {
  const tempRoot = createTempRepoRoot();
  try {
    const executor = new PlanArtifactApplyExecutor(tempRoot);
    const { service } = createArchitect(true, tempRoot, new ArchitectProviderResolver([new RecordingArchitectProvider()]), executor);
    const proposal = service.proposePlan({ request: "Write a plan artifact", files: ["src/shared/ipc.ts"] }).proposal;

    const result = await service.apply({ proposalId: proposal.id });

    expect(result.changedFiles).toEqual([`planning/architect-applied/${proposal.id}.md`]);
    expect(fs.readFileSync(path.join(tempRoot, result.changedFiles[0]), "utf8")).toContain(proposal.summary);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

it("does not execute an approved write when the pre-write audit fails", async () => {
  const executor = new RecordingApplyExecutor();
  const { auditRepository, service } = createArchitect(true, process.cwd(), new ArchitectProviderResolver([new RecordingArchitectProvider()]), executor);
  const proposal = service.proposePlan({ request: "Write only if audited", files: ["src/shared/ipc.ts"] }).proposal;
  vi.spyOn(auditRepository, "record").mockImplementation((input) => {
    if (input.action === "agent.architect.apply.approved") {
      throw new Error("audit failed before write");
    }
    return {
      id: 1,
      ts: "2026-08-11T12:00:00.000Z",
      actor: input.actor,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId ?? null,
      sensitivity: input.sensitivity,
      detail: input.detail
    };
  });

  await expect(service.apply({ proposalId: proposal.id })).rejects.toThrow(/audit failed before write/);

  expect(executor.planned).toEqual([proposal]);
  expect(executor.proposals).toEqual([]);
});

it("audits ask propose and apply so every architect action is reviewable", async () => {
  const { auditRepository, service } = createArchitect(true);

  service.ask({ question: "How does the app route IPC?", files: ["src/shared/ipc.ts"] });
  const proposal = service.proposePlan({ request: "Add reviewable action", files: ["src/shared/ipc.ts"] }).proposal;
  await service.apply({ proposalId: proposal.id });

  expect(auditRepository.list(10).map((event) => event.action)).toEqual(
    expect.arrayContaining(["agent.architect.ask", "agent.architect.proposePlan", "agent.architect.apply"])
  );
});

function createTempRepoRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-architect-"));
  const files: Record<string, string> = {
    "CLAUDE.md": "root invariants",
    "planning/REACHER_PLAN.md": "phase plan",
    "planning/codex-instructions/phase-06-architect-agent.md": "phase six",
    "planning/agent-prompts/architect-agent.md": "architect prompt",
    "src/shared/ipc.ts": "export const IPC = {};"
  };
  for (const [file, text] of Object.entries(files)) {
    const fullPath = path.join(tempRoot, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, text);
  }
  return tempRoot;
}

function sampleProposal(): ArchitectProposal {
  return {
    id: "proposal-one",
    agentId: "architect-agent",
    request: "Write safely",
    summary: "Plan for safe write",
    steps: [{ title: "Step", files: ["src/shared/ipc.ts"], reason: "Reason" }],
    citations: [{ file: "src/shared/ipc.ts", excerpt: "IPC" }],
    provider: "openai",
    model: "codex",
    createdTs: "2026-08-11T12:00:00.000Z"
  };
}

it("rejects repo reads outside the project so scoped tools cannot leak local files", () => {
  const { service } = createArchitect(false);

  expect(() => service.ask({ question: "Read secrets", files: ["../secrets.txt"] })).toThrow(/outside the Reacher repo/);
});

it("rejects symlink escapes outside the project so scoped repo reads use canonical paths", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-root-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-outside-"));
  try {
    fs.writeFileSync(path.join(tempRoot, "CLAUDE.md"), "root");
    fs.writeFileSync(path.join(outsideRoot, "leak.txt"), "secret");
    const linkPath = path.join(tempRoot, "linked-outside");
    fs.symlinkSync(outsideRoot, linkPath, process.platform === "win32" ? "junction" : "dir");

    const tool = new RepoReadTool(tempRoot);

    expect(() => tool.assertExistingFile("linked-outside/leak.txt")).toThrow(/resolves outside the Reacher repo/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

it("rejects apply symlink escapes outside the project so approved writes stay in repo", () => {
  const tempRoot = createTempRepoRoot();
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-write-outside-"));
  try {
    const appliedParent = path.join(tempRoot, "planning", "architect-applied");
    fs.rmSync(appliedParent, { recursive: true, force: true });
    fs.symlinkSync(outsideRoot, appliedParent, process.platform === "win32" ? "junction" : "dir");
    const executor = new PlanArtifactApplyExecutor(tempRoot);

    expect(() => executor.apply(sampleProposal())).toThrow(/resolves outside the Reacher repo/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

it("rejects apply ancestor symlink escapes before mkdir so approved writes cannot create outside directories", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-write-root-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-write-ancestor-"));
  try {
    fs.writeFileSync(path.join(tempRoot, "CLAUDE.md"), "root");
    fs.symlinkSync(outsideRoot, path.join(tempRoot, "planning"), process.platform === "win32" ? "junction" : "dir");
    const executor = new PlanArtifactApplyExecutor(tempRoot);

    expect(() => executor.apply(sampleProposal())).toThrow(/resolves outside the Reacher repo/);
    expect(fs.existsSync(path.join(outsideRoot, "architect-applied"))).toBe(false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});
