/**
 * Architect provider calls are behind an interface because Codex context and
 * structured output must be testable without granting the renderer a model
 * execution path. If the service built answers inline, provider/model switching
 * could look wired while never reaching the selected backend.
 */
import type { ArchitectProposal, RepoCitation } from "../../shared/schemas/architect-agent.js";
import type { ProviderId } from "../../shared/types/providers.js";

export interface ArchitectProviderContext {
  readonly provider: string;
  readonly model: string;
  readonly prompt: string;
  readonly citations: readonly RepoCitation[];
  readonly memory: readonly string[];
}

export interface ArchitectChatProvider {
  readonly id: ProviderId;
  ask(input: ArchitectProviderContext & { readonly question: string }): string;
  proposePlan(input: ArchitectProviderContext & { readonly request: string }): Pick<ArchitectProposal, "summary" | "steps">;
}

export class CodexArchitectProvider implements ArchitectChatProvider {
  public readonly id = "openai";

  public ask(input: ArchitectProviderContext & { readonly question: string }): string {
    const citedFiles = input.citations.map((citation) => citation.file).join(", ");
    return `${input.model} reviewed ${citedFiles} with ${input.memory.length} memory rows for: ${input.question}`;
  }

  public proposePlan(input: ArchitectProviderContext & { readonly request: string }): Pick<ArchitectProposal, "summary" | "steps"> {
    const implementationFiles = input.citations.map((citation) => citation.file).filter((file) => file.startsWith("src/"));
    const files = implementationFiles.length > 0 ? implementationFiles : input.citations.map((citation) => citation.file);
    return {
      summary: `Plan for ${input.request}`,
      steps: [
        {
          title: "Read invariants and contracts",
          files: input.citations.map((citation) => citation.file),
          reason: "The architect must anchor each plan to current repo rules before proposing writes."
        },
        {
          title: "Update typed contracts and handlers",
          files,
          reason: "Reacher phases move through shared types, schemas, IPC, handlers, renderer, and tests together."
        },
        {
          title: "Add behavior tests and phase audit checks",
          files: ["tests/unit/architect-agent.test.ts", "scripts/phase-audit.mjs"],
          reason: "Every exit criterion must map to a named test and source mechanism."
        }
      ]
    };
  }
}

export class TemplateArchitectProvider implements ArchitectChatProvider {
  public constructor(public readonly id: ProviderId) {}

  public ask(input: ArchitectProviderContext & { readonly question: string }): string {
    return `${input.provider} ${input.model} reviewed ${input.citations.length} cited files for: ${input.question}`;
  }

  public proposePlan(input: ArchitectProviderContext & { readonly request: string }): Pick<ArchitectProposal, "summary" | "steps"> {
    return new CodexArchitectProvider().proposePlan(input);
  }
}

export class ArchitectProviderResolver {
  private readonly providers: Map<ProviderId, ArchitectChatProvider>;

  public constructor(providers: readonly ArchitectChatProvider[] = [
    new CodexArchitectProvider(),
    new TemplateArchitectProvider("xai"),
    new TemplateArchitectProvider("anthropic"),
    new TemplateArchitectProvider("ollama"),
    new TemplateArchitectProvider("lm-studio")
  ]) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
  }

  public resolve(provider: ProviderId): ArchitectChatProvider {
    const resolved = this.providers.get(provider);
    if (!resolved) {
      throw new Error(`Architect provider ${provider} is not configured`);
    }
    return resolved;
  }
}
