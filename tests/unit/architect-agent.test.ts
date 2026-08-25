/**
 * Architect tests use the real repositories because Phase 6 is about safe
 * write boundaries, not generated prose. If confirm and audit were mocked away,
 * an in-app code agent could appear safe while writing without owner approval.
 *
 * The provider is the one thing that is faked: a RecordingChatProvider stands in
 * for the model, mirroring the pattern in agent-runtime.test.ts, so these tests
 * assert real citation grounding and audit behaviour without depending on a
 * running Ollama.
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
import {
  ChatProviderResolver,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ChatProvider
} from "../../src/main/providers/chat-providers";
import { RepoReadTool } from "../../src/main/agents/repo-read-tool";
import type { ArchitectProposal } from "../../src/shared/schemas/architect-agent";
import type { ProviderId } from "../../src/shared/types/providers";

/**
 * Answers with plain text for an ask prompt and a grounded JSON plan for a
 * proposePlan prompt, distinguishing the two by the "Question:"/"Request:"
 * prefix buildAskPrompt/buildPlanPrompt always write. Cited files are parsed
 * back out of the prompt (RepoReadTool always joins each excerpt onto one
 * line) so a test can prove the model's output only ever names files it was
 * actually shown.
 */
class RecordingChatProvider implements ChatProvider {
  public readonly calls: ChatCompletionRequest[] = [];

  public constructor(public readonly id: ProviderId = "ollama") {}

  public complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    this.calls.push(request);
    const citedFiles = [...request.userPrompt.matchAll(/^- (\S+):/gm)].map((match) => match[1]);

    if (request.userPrompt.startsWith("Question:")) {
      const question = request.userPrompt.slice("Question: ".length).split("\n")[0];
      return Promise.resolve({ text: `provider answer from ${request.model} for ${question} using ${citedFiles.join(", ")}` });
    }

    const requestText = request.userPrompt.slice("Request: ".length).split("\n")[0];
    return Promise.resolve({
      text: JSON.stringify({
        summary: `Provider plan for ${requestText}`,
        steps: [
          {
            title: "Provider step",
            files: citedFiles,
            reason: `Model ${request.model} received ${request.userPrompt.length} prompt characters.`
          }
        ]
      })
    });
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
  providerResolver = new ChatProviderResolver([new RecordingChatProvider()]),
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

it("answers a codebase question citing real files so architecture advice is grounded", async () => {
  const { service } = createArchitect(false);

  const response = await service.ask({ question: "How is IPC wired?", files: ["src/shared/ipc.ts"] });

  expect(response.answer).toContain("provider answer from llama3.1:8b");
  expect(response.citations.map((citation) => citation.file)).toContain("src/shared/ipc.ts");
  expect(response.model).toBe("llama3.1:8b");
});

it("can start without source checkout files so packaged app startup is not blocked", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reacher-packaged-root-"));
  const { service } = createArchitect(false, tempRoot);

  await expect(service.ask({ question: "How is IPC wired?", files: [] })).rejects.toThrow(
    "Architect agent requires a Reacher source checkout with CLAUDE.md"
  );
});

it("drafts a plan citing real files so feature work starts from repo context", async () => {
  const provider = new RecordingChatProvider();
  const { service } = createArchitect(false, process.cwd(), new ChatProviderResolver([provider]));

  const response = await service.proposePlan({
    request: "Add an audit log filter",
    files: ["src/shared/ipc.ts", "src/main/ipc/register.ts"]
  });

  expect(response.proposal.summary).toBe("Provider plan for Add an audit log filter");
  expect(response.proposal.citations.map((citation) => citation.file)).toEqual(
    expect.arrayContaining(["CLAUDE.md", "planning/REACHER_PLAN.md", "src/shared/ipc.ts", "src/main/ipc/register.ts"])
  );
  expect(response.proposal.steps.some((step) => step.files.includes("src/shared/ipc.ts"))).toBe(true);
  expect(provider.calls[0]).toMatchObject({ model: "llama3.1:8b" });
  expect(provider.calls[0].userPrompt).toContain("Request: Add an audit log filter");
});

it("asks for prose, not JSON, so ask() answers don't come back as an empty object", async () => {
  // Confirmed live against Ollama: forcing JSON mode on a prompt that asks
  // for plain text made llama3.1:8b answer "{}" instead of a real sentence.
  const provider = new RecordingChatProvider();
  const { service } = createArchitect(false, process.cwd(), new ChatProviderResolver([provider]));

  await service.ask({ question: "How is IPC wired?", files: ["src/shared/ipc.ts"] });

  expect(provider.calls[0]).toMatchObject({ expectJson: false });
});

it("asks for JSON on proposePlan so the model's plan can be parsed", async () => {
  const provider = new RecordingChatProvider();
  const { service } = createArchitect(false, process.cwd(), new ChatProviderResolver([provider]));

  await service.proposePlan({ request: "Add a setting", files: ["src/shared/ipc.ts"] });

  expect(provider.calls[0]).toMatchObject({ expectJson: true });
});

it("drops a plan step whose files are entirely invented instead of crashing on the proposal schema's per-step minimum", async () => {
  // Confirmed live against Ollama: a real plan mixed one grounded step with
  // two steps citing invented paths. Filtering each step's files without
  // dropping the now-empty steps left architectProposalSchema's per-step
  // files.min(1) unsatisfied, and proposePlan threw a ZodError instead of
  // returning the grounded part of the plan.
  class MixedGroundingProvider implements ChatProvider {
    public readonly id: ProviderId = "ollama";
    public complete(): Promise<ChatCompletionResult> {
      return Promise.resolve({
        text: JSON.stringify({
          summary: "Mixed plan",
          steps: [
            { title: "Real step", files: ["src/shared/ipc.ts"], reason: "grounded" },
            { title: "Invented step", files: ["src/does/not/exist.ts"], reason: "ungrounded" }
          ]
        })
      });
    }
  }
  const { service } = createArchitect(false, process.cwd(), new ChatProviderResolver([new MixedGroundingProvider()]));

  const response = await service.proposePlan({ request: "Mixed grounding", files: ["src/shared/ipc.ts"] });

  expect(response.proposal.steps.map((step) => step.title)).toEqual(["Real step"]);
});

it("no write happens without an explicit confirm so architect apply cannot bypass the owner", async () => {
  const executor = new RecordingApplyExecutor();
  const { auditRepository, runtimeRepository, service } = createArchitect(
    false,
    process.cwd(),
    new ChatProviderResolver([new RecordingChatProvider()]),
    executor
  );
  const { proposal } = await service.proposePlan({ request: "Change a component", files: ["src/renderer/App.tsx"] });

  const result = await service.apply({ proposalId: proposal.id });

  expect(result).toMatchObject({ applied: false, memoryKey: null, changedFiles: [], audited: true });
  expect(executor.planned).toEqual([]);
  expect(executor.proposals).toEqual([]);
  expect(runtimeRepository.listMemory("global", 10)).toEqual([]);
  expect(auditRepository.list(10)[0]).toMatchObject({ action: "agent.architect.apply.cancelled" });
});

it("provider and model is switchable and architect actions are audited", async () => {
  const { agentsRepository, auditRepository, runtimeRepository, service } = createArchitect(
    true,
    process.cwd(),
    new ChatProviderResolver([new RecordingChatProvider("ollama"), new RecordingChatProvider("anthropic")])
  );
  agentsRepository.setModel("architect-agent", "anthropic", "claude-sonnet-5");
  const { proposal } = await service.proposePlan({ request: "Add a setting", files: ["src/renderer/components/settings-view.tsx"] });

  const result = await service.apply({ proposalId: proposal.id });

  expect(proposal).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5" });
  expect(result.applied).toBe(true);
  expect(result.changedFiles).toEqual([`planning/architect-applied/${proposal.id}.md`]);
  expect(runtimeRepository.listMemory("global", 10)[0]?.key).toBe(result.memoryKey);
  expect(auditRepository.list(10).map((event) => event.action)).toEqual(
    expect.arrayContaining(["agent.architect.proposePlan", "agent.architect.apply.approved", "agent.architect.apply"])
  );
});

it("invokes the switched architect provider so Settings changes affect the real model call", async () => {
  const xaiProvider = new RecordingChatProvider("xai");
  const { agentsRepository, service } = createArchitect(
    false,
    process.cwd(),
    new ChatProviderResolver([new RecordingChatProvider(), xaiProvider])
  );
  agentsRepository.setModel("architect-agent", "xai", "grok-4.6");

  await service.ask({ question: "Which provider handles this?", files: ["src/shared/ipc.ts"] });

  expect(xaiProvider.calls[0]).toMatchObject({ model: "grok-4.6" });
  expect(xaiProvider.calls[0].userPrompt).toContain("Question: Which provider handles this?");
});

it("uses shared memory so architect plans persist across agents and providers", async () => {
  const { runtimeRepository, service } = createArchitect(true);
  const { proposal } = await service.proposePlan({ request: "Remember a decision", files: ["src/shared/ipc.ts"] });

  const applied = await service.apply({ proposalId: proposal.id });
  const answer = await service.ask({ question: "What memory exists?", files: ["src/shared/ipc.ts"] });

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
    const { service } = createArchitect(true, tempRoot, new ChatProviderResolver([new RecordingChatProvider()]), executor);
    const { proposal } = await service.proposePlan({ request: "Write a plan artifact", files: ["src/shared/ipc.ts"] });

    const result = await service.apply({ proposalId: proposal.id });

    expect(result.changedFiles).toEqual([`planning/architect-applied/${proposal.id}.md`]);
    expect(fs.readFileSync(path.join(tempRoot, result.changedFiles[0]), "utf8")).toContain(proposal.summary);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

it("does not execute an approved write when the pre-write audit fails", async () => {
  const executor = new RecordingApplyExecutor();
  const { auditRepository, service } = createArchitect(true, process.cwd(), new ChatProviderResolver([new RecordingChatProvider()]), executor);
  const { proposal } = await service.proposePlan({ request: "Write only if audited", files: ["src/shared/ipc.ts"] });
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

  await service.ask({ question: "How does the app route IPC?", files: ["src/shared/ipc.ts"] });
  const { proposal } = await service.proposePlan({ request: "Add reviewable action", files: ["src/shared/ipc.ts"] });
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
    provider: "ollama",
    model: "llama3.1:8b",
    createdTs: "2026-08-11T12:00:00.000Z"
  };
}

it("rejects repo reads outside the project so scoped tools cannot leak local files", async () => {
  const { service } = createArchitect(false);

  await expect(service.ask({ question: "Read secrets", files: ["../secrets.txt"] })).rejects.toThrow(/outside the Reacher repo/);
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
