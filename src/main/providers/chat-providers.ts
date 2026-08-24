/**
 * Chat providers are the one place an agent actually reaches a model, because
 * every agent run before this depended on hand-written template strings --
 * agent-runtime-service.ts read a prompt file only to count its characters,
 * never sent it anywhere. That is why every agent's saved memory looked the
 * same regardless of provider, seed, or persona: nothing distinguishing was
 * ever generated. This resolver gives each wired provider one real `complete()`
 * call so that stops being true, and fails loudly (not with fake text) for
 * providers not wired yet, so a misconfigured agent cannot silently keep
 * producing template output that looks like real reasoning.
 *
 * Two providers are real: Ollama (local, free, no key) and Anthropic (hosted,
 * keyed). Anthropic is here because Jack deliberately put ripper-agent on it;
 * migrating that choice away would have been easier than honouring it, and
 * wrong. Its key arrives through an injected resolver rather than ambient
 * environment so the read stays behind the audited vault gate, the same rule the
 * ScrapeGraph connector follows.
 *
 * Reasoning effort is passed to every provider and honoured by the ones that
 * have such a control. Ollama has none, so it ignores the field -- which is what
 * the agents view already tells Jack in as many words.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ProviderId, ReasoningEffort } from "../../shared/types/providers.js";
import type { KeySource } from "../../shared/types/sources.js";
import { asRecord, fetchJson } from "../search/http.js";

export interface ChatCompletionRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly model: string;
  // The agent's stored reasoning_effort (migration 020), or null when unset.
  // Providers without an effort control ignore it rather than approximating one.
  readonly effort?: ReasoningEffort | null;
}

export interface ChatCompletionResult {
  readonly text: string;
}

export interface ChatProvider {
  readonly id: ProviderId;
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
}

/** Reads one secret through the audited vault gate; null when none is stored. */
export type SecretResolver = (source: KeySource, purpose: string) => string | null;

const OLLAMA_TIMEOUT_MS = 120_000;
const LOOPBACK_HOST = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const ANTHROPIC_MAX_TOKENS = 16_000;

export class OllamaChatProvider implements ChatProvider {
  public readonly id: ProviderId = "ollama";

  public constructor(private readonly baseUrl = "http://127.0.0.1:11434") {
    if (!LOOPBACK_HOST.test(baseUrl)) {
      throw new Error("Ollama base URL must be loopback (127.0.0.1 or localhost) -- a remote Ollama endpoint is not supported here");
    }
  }

  public async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const response = await fetchJson(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt }
          ],
          stream: false,
          format: "json"
        }),
        signal: controller.signal
      });
      const content = asRecord(asRecord(response).message).content;
      if (typeof content !== "string" || content.length === 0) {
        throw new Error("Ollama response did not include message content");
      }
      return { text: content };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Ollama did not respond within ${OLLAMA_TIMEOUT_MS / 1000}s (model: ${request.model})`, { cause: error });
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not reach Ollama at ${this.baseUrl} -- is it running? (${message})`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class AnthropicChatProvider implements ChatProvider {
  public readonly id: ProviderId = "anthropic";

  public constructor(
    private readonly resolveKey: () => string | null,
    private readonly createClient = (apiKey: string): Anthropic => new Anthropic({ apiKey })
  ) {}

  public async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const apiKey = this.resolveKey();
    if (!apiKey) {
      // Named as an action rather than a condition: the agents view is where this
      // is fixed, and a bare "unauthorized" would send Jack to the wrong place.
      throw new Error("No Anthropic key is stored. Add one in Settings -> API keys, or switch this agent to Ollama.");
    }

    try {
      const response = await this.createClient(apiKey).messages.create({
        model: request.model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
        // Thinking is deliberately unset: current models run adaptive thinking by
        // default, and the old budget_tokens knob is rejected outright now.
        ...(anthropicEffort(request.effort) ? { output_config: { effort: anthropicEffort(request.effort) } } : {})
      });

      // A response is a list of blocks, not a string. Only text blocks carry the
      // JSON the agent runtime parses; joining rather than taking [0] survives a
      // model that emits a thinking block first.
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      if (text.length === 0) {
        throw new Error(`Anthropic returned no text content (stop reason: ${response.stop_reason ?? "unknown"})`);
      }
      return { text };
    } catch (error) {
      throw describeAnthropicError(error, request.model);
    }
  }
}

export class UnavailableChatProvider implements ChatProvider {
  public constructor(public readonly id: ProviderId) {}

  public complete(): Promise<ChatCompletionResult> {
    return Promise.reject(
      new Error(`${this.id} is not wired to a real model call yet. Switch this agent's provider to Ollama or Anthropic in Settings.`)
    );
  }
}

/**
 * Built as a function rather than a constructor default so the composition root
 * can hand in a real vault-backed resolver while tests hand in a stub, without
 * either one reaching into the vault from inside a provider.
 */
export function defaultChatProviders(resolveSecret: SecretResolver): readonly ChatProvider[] {
  return [
    new OllamaChatProvider(),
    new AnthropicChatProvider(() => resolveSecret("anthropic", "agent.anthropic")),
    new UnavailableChatProvider("openai"),
    new UnavailableChatProvider("xai"),
    new UnavailableChatProvider("lm-studio")
  ];
}

export class ChatProviderResolver {
  private readonly providers: Map<ProviderId, ChatProvider>;

  // Defaults to a keyless resolver so an unconfigured runtime still constructs;
  // the Anthropic provider then reports the missing key instead of throwing here.
  public constructor(providers: readonly ChatProvider[] = defaultChatProviders(() => null)) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
  }

  public resolve(provider: ProviderId): ChatProvider {
    const resolved = this.providers.get(provider);
    if (!resolved) {
      throw new Error(`Chat provider ${provider} is not configured`);
    }
    return resolved;
  }
}

/**
 * The app's ladder carries a "minimal" rung that the Messages API does not.
 * agents-handlers.ts already blocks storing it against Anthropic, so this only
 * fires for a row written before that check existed -- mapping down to "low"
 * beats failing a run over a legacy value.
 */
function anthropicEffort(effort: ReasoningEffort | null | undefined): "low" | "medium" | "high" | null {
  switch (effort) {
    case "minimal":
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    default:
      return null;
  }
}

/**
 * Typed classes checked most specific first. A raw SDK error surfaces in the
 * agent panel as a failed run, so each case has to say what to do about it
 * rather than repeat an HTTP status.
 */
function describeAnthropicError(error: unknown, model: string): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new Error("The stored Anthropic key was rejected. Replace it in Settings -> API keys.", { cause: error });
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new Error(`Anthropic does not recognize the model "${model}". Pick another one in Settings.`, { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new Error("Anthropic rate-limited this run. Wait a moment and re-run the agent.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new Error("Could not reach Anthropic -- check the network connection.", { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    return new Error(`Anthropic returned ${error.status ?? "an error"}: ${error.message}`, { cause: error });
  }
  return error instanceof Error ? error : new Error(String(error));
}
