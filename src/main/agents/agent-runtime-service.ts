/**
 * The agent runtime makes a real model call because the deterministic-template
 * version it replaced produced identical boilerplate for every agent regardless
 * of persona, seed, or case -- the prompt file was read only to count its
 * characters, never sent anywhere. Every claim a model returns is filtered
 * against a citation set built from the exact context it was given (the seed,
 * the observations of the search that triggered this run, recent shared memory,
 * and the case's existing evidence); anything the model cites that was not
 * actually in that context is dropped before it can reach agent_memory, so
 * "never states a thing he cannot cite" (the OSINT agent's own rule) is enforced
 * here, not just requested in the prompt. A provider that is not wired to a real
 * call (see providers/chat-providers.ts) fails the run loudly instead of falling
 * back to fake text, so a misconfigured agent cannot look like it is working
 * when it is not.
 *
 * Reasoning effort (migration 020) is forwarded to the provider, which is what
 * finally makes that stored preference mean something: Anthropic maps it onto its
 * own effort ladder, and Ollama ignores it because a local runtime has no such
 * control -- exactly what the agents view already tells Jack.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import type { AgentsRepository } from "../../db/repositories/agents-repository.js";
import type { AuditRepository } from "../../db/repositories/audit-repository.js";
import type { CasesRepository } from "../../db/repositories/cases-repository.js";
import type { AgentRecord } from "../../shared/schemas/agents.js";
import type {
  AgentFinding,
  AgentLiveState,
  AgentMemoryRecord,
  AgentRuntimeEvent,
  AgentRunRecord
} from "../../shared/schemas/agents-runtime.js";
import { agentFindingSchema, STEP_FORMAT } from "../../shared/schemas/agents-runtime.js";
import type { CaseItem } from "../../shared/schemas/cases.js";
import type { AgentSeed } from "../../shared/types/agents-runtime.js";
import type { Observation } from "../../shared/types/search.js";
import { ChatProviderResolver } from "../providers/chat-providers.js";
import { AgentEventBatcher } from "./agent-event-batcher.js";

const MEMORY_CONTEXT_LIMIT = 20;
const CASE_CONTEXT_LIMIT = 20;
// Search fan-out can return hundreds of observations. The citation list has to
// stay short enough that a small local model still reaches the instructions
// after it, so the prompt is capped rather than truncated mid-entry.
const OBSERVATION_CONTEXT_LIMIT = 40;

const modelStepSchema = z.object({
  title: z.string().min(1),
  status: z.enum(["queued", "running", "complete", "error"]),
  summary: z.union([z.string().min(1), z.null()]).optional().transform((value) => value ?? null),
  next: z.union([z.string().min(1), z.null()]).optional().transform((value) => value ?? null),
  sources: z.array(z.string().min(1)).default([])
});

const modelFindingSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(z.string().min(1)).default([]),
  confidence: z.number().int().min(1)
});

// The model is asked for content only. Ids, run ids, and agent ids are assigned
// after parsing so a model can never claim to be a different agent or overwrite
// another run's rows.
const modelOutputSchema = z.object({
  steps: z.array(modelStepSchema).min(1),
  finding: modelFindingSchema
});

type ModelOutput = z.infer<typeof modelOutputSchema>;

export interface AgentRunInput {
  readonly agentId: string;
  readonly seed: AgentSeed;
  readonly caseId?: string;
  // Observations from the search run that triggered this agent, when there was
  // one. Passed in rather than re-queried so the agent reasons over exactly the
  // evidence the investigator just saw, and can cite it.
  readonly observations?: readonly Observation[];
}

interface AgentContext {
  readonly memoryRows: readonly AgentMemoryRecord[];
  readonly caseItems: readonly CaseItem[];
  readonly citations: ReadonlyMap<string, string>;
}

export class AgentRuntimeService {
  private queue: Promise<unknown> = Promise.resolve();

  public constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly runtimeRepository: AgentRuntimeRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditRepository: AuditRepository,
    private readonly emitBatch: (events: readonly AgentRuntimeEvent[]) => void,
    private readonly repoRoot: string,
    private readonly now = () => new Date(),
    private readonly chatProviders = new ChatProviderResolver()
  ) {}

  public async run(input: AgentRunInput): Promise<{
    readonly run: AgentRunRecord;
    readonly finding: AgentFinding;
  }> {
    const work = this.queue.then(() => this.execute(input));
    this.queue = work.catch(() => undefined);
    return work;
  }

  public states(): AgentLiveState[] {
    const nowTs = this.now().toISOString();
    return this.runtimeRepository.currentStates(this.agentsRepository.list().map((agent) => agent.id), nowTs);
  }

  private async execute(input: AgentRunInput) {
    const agent = this.agentsRepository.get(input.agentId);
    const prompt = this.readPrompt(agent.promptPath);
    const batcher = new AgentEventBatcher(this.emitBatch);
    const startedTs = this.now().toISOString();
    const caseId = input.caseId ?? this.casesRepository.create(`Agent findings for ${input.seed.value}`, ["agents"]).id;
    const run = this.runtimeRepository.startRun({
      agentId: agent.id,
      caseId,
      provider: agent.provider,
      model: agent.model,
      seed: input.seed,
      startedTs
    });
    try {
      const state: AgentLiveState = {
        agentId: agent.id,
        status: "working",
        // The old label claimed "running Sherlock on <seed>" while doing nothing
        // of the sort. Sherlock is a search connector now, so the agent reports
        // the work it actually does: reasoning over cited evidence.
        task: `investigating ${input.seed.type} ${input.seed.value} with ${agent.model}`,
        lastRunId: run.id,
        updatedTs: startedTs
      };
      batcher.push({ type: "agent:state", state });

      const context = this.buildContext(caseId, input.seed, input.observations ?? []);
      const modelOutput = await this.runModel(agent, prompt, input.seed, context);

      let sequence = 1;
      for (const modelStep of modelOutput.steps) {
        const parsed = STEP_FORMAT.parse({
          runId: run.id,
          agentId: agent.id,
          sequence: sequence++,
          title: modelStep.title,
          status: modelStep.status,
          summary: modelStep.summary,
          next: modelStep.next,
          sources: modelStep.sources.filter((source) => context.citations.has(source))
        });
        this.runtimeRepository.appendStep(parsed, this.now().toISOString());
        batcher.push({ type: "agent:step", step: parsed });
      }

      const groundedSources = modelOutput.finding.sources.filter((source) => context.citations.has(source));
      if (groundedSources.length === 0) {
        throw new Error(
          `${agent.name} did not cite anything present in the context it was given (offered: ${modelOutput.finding.sources.join(", ") || "nothing"})`
        );
      }
      const finding = agentFindingSchema.parse({
        id: randomUUID(),
        runId: run.id,
        agentId: agent.id,
        caseId,
        title: modelOutput.finding.title,
        summary: modelOutput.finding.summary,
        sources: groundedSources,
        confidence: modelOutput.finding.confidence,
        savedItemId: null
      });
      const result = this.runtimeRepository.atomic(() => {
        const savedItem = this.casesRepository.addItem({
          caseId,
          itemType: "agent_run",
          refId: finding.id,
          title: finding.title,
          text: finding.summary,
          sourceTs: this.now().toISOString(),
          metadata: { entity: input.seed.value, strength: finding.confidence, sources: finding.sources }
        });
        const savedFinding = agentFindingSchema.parse({ ...finding, savedItemId: savedItem.id });
        this.runtimeRepository.appendMemory({
          scope: "global",
          key: `${input.seed.type}:${input.seed.value}`,
          value: savedFinding.summary,
          sourceAgent: agent.id,
          citedRun: run.id,
          confidence: savedFinding.confidence,
          ts: this.now().toISOString()
        });
        const finished = this.runtimeRepository.finishRun(run.id, "succeeded", this.now().toISOString());
        this.auditRepository.record({
          actor: "local-user",
          action: "agent.run",
          objectType: "agent_run",
          objectId: run.id,
          sensitivity: "medium",
          detail: { agentId: agent.id, seedType: input.seed.type, savedItemId: savedItem.id }
        });
        return { savedFinding, finished };
      });
      const { savedFinding, finished } = result;
      batcher.push({ type: "agent:finding", finding: savedFinding });
      batcher.push({
        type: "agent:state",
        state: { agentId: agent.id, status: "idle", task: null, lastRunId: run.id, updatedTs: finished.completedTs ?? startedTs }
      });
      batcher.flush();
      return { run: finished, finding: savedFinding };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent run failed";
      const failed = this.runtimeRepository.finishRun(run.id, "failed", this.now().toISOString(), message);
      batcher.push({
        type: "agent:state",
        state: { agentId: agent.id, status: "error", task: message, lastRunId: run.id, updatedTs: failed.completedTs ?? startedTs }
      });
      batcher.flush();
      this.auditRepository.record({
        actor: "local-user",
        action: "agent.run.failed",
        objectType: "agent_run",
        objectId: run.id,
        sensitivity: "medium",
        detail: { agentId: agent.id, seedType: input.seed.type, error: message }
      });
      throw error;
    }
  }

  /**
   * The citation map is the whole integrity mechanism: it is built from exactly
   * what the model is about to be shown and nothing else, so a returned source
   * string can be checked by lookup instead of by trusting the model. Keys are
   * namespaced by kind so a memory row and a case item carrying the same text
   * cannot collapse into one citation.
   */
  private buildContext(caseId: string, seed: AgentSeed, observations: readonly Observation[]): AgentContext {
    const memoryRows = this.runtimeRepository.listMemory(undefined, MEMORY_CONTEXT_LIMIT);
    const caseItems = this.casesRepository.timeline(caseId).slice(-CASE_CONTEXT_LIMIT);
    const citations = new Map<string, string>();
    citations.set(`seed:${seed.type}:${seed.value}`, `The seed being investigated: ${seed.type} ${seed.value}`);
    for (const observation of observations.slice(0, OBSERVATION_CONTEXT_LIMIT)) {
      citations.set(`observation:${observation.id}`, `${observation.source} reported ${observation.type}: ${observation.value}`);
    }
    for (const row of memoryRows) {
      citations.set(`memory:${row.key}`, row.value);
    }
    for (const item of caseItems) {
      citations.set(`case-item:${item.id}`, `${item.title}: ${item.text}`);
    }
    return { memoryRows, caseItems, citations };
  }

  /**
   * A direct test against a real local model (llama3.1:8b) showed it can return
   * perfectly valid JSON that still invents a citation -- "seed:username:jdoe:Twitter"
   * in place of the one real key "seed:username:jdoe" -- fabricating a whole finding
   * from nothing despite the prompt saying "never invent a source string" in as many
   * words. The grounding filter correctly drops that citation, but before this
   * change a parseable-yet-ungrounded response only got the single JSON-format
   * retry below, which does nothing to fix a hallucinated source: the run just
   * failed outright. Small local models miss prompt instructions more often than
   * they miss JSON syntax, so grounding failure gets the same one-retry-with-the-
   * specific-problem-fed-back treatment as a parse failure, not a worse one.
   */
  private async runModel(agent: AgentRecord, prompt: string, seed: AgentSeed, context: AgentContext): Promise<ModelOutput> {
    const provider = this.chatProviders.resolve(agent.provider);
    const userPrompt = buildUserPrompt(seed, context.citations);

    const first = await provider.complete({ systemPrompt: prompt, userPrompt, model: agent.model, effort: agent.reasoningEffort });
    const firstResult = evaluateModelResponse(first.text, context.citations);
    if (firstResult.ok) {
      return firstResult.value;
    }

    // One retry with the specific problem fed back, because a dropped brace or an
    // invented citation are both common, cheap-to-correct local-model mistakes. A
    // second failure fails the run: falling back to a template is the exact bug
    // this service was rewritten to remove, so there is no third path.
    const retry = await provider.complete({
      systemPrompt: prompt,
      userPrompt: `${userPrompt}\n\n${firstResult.retryHint}`,
      model: agent.model,
      effort: agent.reasoningEffort
    });
    const retryResult = evaluateModelResponse(retry.text, context.citations);
    if (retryResult.ok) {
      return retryResult.value;
    }
    throw new Error(`${agent.name}'s model response ${retryResult.summary} after one retry`);
  }

  private readPrompt(promptPath: string): string {
    return fs.readFileSync(path.join(this.repoRoot, promptPath), "utf8");
  }
}

function buildUserPrompt(seed: AgentSeed, citations: ReadonlyMap<string, string>): string {
  const citationLines = [...citations.entries()].map(([key, description]) => `- ${key}: ${description}`).join("\n");
  return [
    `Seed: ${seed.type} = ${seed.value}`,
    "",
    'You may only cite the following sources. Use their exact key (the part before the colon) in every "sources" array -- never invent a source string:',
    citationLines || "(no prior context -- this is the first thing known about this seed)",
    "",
    "Respond with ONLY a JSON object, no prose and no markdown code fences, matching exactly this shape:",
    '{"steps": [{"title": string, "status": "complete", "summary": string | null, "next": string | null, "sources": string[]}], "finding": {"title": string, "summary": string, "sources": string[], "confidence": integer >= 1}}'
  ].join("\n");
}

function parseModelOutput(text: string): { readonly ok: true; readonly value: ModelOutput } | { readonly ok: false; readonly error: string } {
  // Local models routinely wrap JSON in a markdown fence despite being told not
  // to; stripping it here is cheaper than spending the one retry on formatting.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return { ok: true, value: modelOutputSchema.parse(JSON.parse(stripped)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown parse error" };
  }
}

type ModelResponseEvaluation =
  | { readonly ok: true; readonly value: ModelOutput }
  | { readonly ok: false; readonly summary: string; readonly retryHint: string };

/**
 * Parsing and grounding are checked together because both are "the response
 * is unusable as-is" -- execute()'s own finding-sources check still runs
 * downstream as a defensive backstop, but by the time a response gets there
 * it should already be grounded, since a response that fails this check never
 * makes it out of runModel without a retry.
 */
function evaluateModelResponse(text: string, citations: ReadonlyMap<string, string>): ModelResponseEvaluation {
  const parsed = parseModelOutput(text);
  if (!parsed.ok) {
    return {
      ok: false,
      summary: "was not valid JSON",
      retryHint: `Your previous response could not be parsed as the required JSON: ${parsed.error}\nRespond again with ONLY the JSON object -- no prose, no markdown code fences.`
    };
  }
  const groundedFindingSources = parsed.value.finding.sources.filter((source) => citations.has(source));
  if (groundedFindingSources.length === 0) {
    return {
      ok: false,
      summary: `did not cite anything present in the context it was given (offered: ${parsed.value.finding.sources.join(", ") || "nothing"})`,
      retryHint:
        `Your finding's sources (${parsed.value.finding.sources.join(", ") || "none"}) did not match any of the citation keys ` +
        "you were given. Copy a key EXACTLY as listed above, verbatim -- do not invent, abbreviate, or extend one. " +
        "If nothing you were given actually supports a finding, cite the seed key itself with a low confidence rather " +
        "than inventing a more specific source. Respond again with ONLY the JSON object."
    };
  }
  return { ok: true, value: parsed.value };
}
