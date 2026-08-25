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
 * Three providers are real: Ollama (local, free, no key), Anthropic (hosted,
 * keyed), and xAI (hosted, keyed). Anthropic is here because Jack deliberately
 * put ripper-agent on it; migrating that choice away would have been easier
 * than honouring it, and wrong. xAI uses its OpenAI-compatible REST endpoint
 * directly rather than a proxy service (a "free unlimited Grok API" tutorial
 * Jack found routed every call through a third party's own servers first --
 * the opposite of every other provider here, which all call their vendor
 * directly). Both keyed providers' keys arrive through an injected resolver
 * rather than ambient environment so the read stays behind the audited vault
 * gate, the same rule the ScrapeGraph connector follows.
 *
 * Reasoning effort is passed to every provider and honoured by the ones that
 * have such a control. Ollama has none, so it ignores the field -- which is what
 * the agents view already tells Jack in as many words.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ProviderId, ReasoningEffort } from "../../shared/types/providers.js";
import type { KeySource } from "../../shared/types/sources.js";
import { asRecord, fetchJson, HttpLookupError } from "../search/http.js";

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
      // A reachable daemon that answers with an error status (confirmed live:
      // an unpulled model returns a normal 404 with {"error": "model ... not
      // found"}) is a different problem than an unreachable one, and needs a
      // different fix. Collapsing both into "is it running?" sent Jack to
      // check a daemon that was never the problem.
      if (error instanceof HttpLookupError) {
        const reported = ollamaErrorMessage(error.body);
        throw new Error(
          reported
            ? `Ollama rejected the request: ${reported} (model: ${request.model})`
            : `Ollama returned HTTP ${error.status} for model ${request.model}`,
          { cause: error }
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not reach Ollama at ${this.baseUrl} -- is it running? (${message})`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Ollama's error responses are `{"error": "..."}`; falls back to null for a body that isn't that shape. */
function ollamaErrorMessage(body: string): string | null {
  try {
    const parsed = asRecord(JSON.parse(body)).error;
    return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
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

const XAI_TIMEOUT_MS = 120_000;
const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export class XaiChatProvider implements ChatProvider {
  public readonly id: ProviderId = "xai";

  public constructor(private readonly resolveKey: () => string | null) {}

  public async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const apiKey = this.resolveKey();
    if (!apiKey) {
      throw new Error("No xAI key is stored. Add one in Settings -> API keys, or switch this agent to Ollama.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), XAI_TIMEOUT_MS);
    try {
      // xAI's chat endpoint is OpenAI-compatible, so this reuses the same
      // fetchJson/HttpLookupError plumbing every keyless connector already
      // uses instead of pulling in a dedicated SDK for one provider.
      const response = await fetchJson(XAI_CHAT_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt }
          ],
          ...(xaiEffort(request.effort) ? { reasoning_effort: xaiEffort(request.effort) } : {})
        }),
        signal: controller.signal
      });

      const choices = asRecord(response).choices;
      const firstChoice = Array.isArray(choices) ? asRecord(choices[0]) : {};
      const content = asRecord(firstChoice.message).content;
      if (typeof content !== "string" || content.length === 0) {
        const finishReason = typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
        throw new Error(`xAI returned no text content (finish reason: ${finishReason})`);
      }
      return { text: content };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`xAI did not respond within ${XAI_TIMEOUT_MS / 1000}s (model: ${request.model})`, { cause: error });
      }
      if (error instanceof HttpLookupError) {
        throw describeXaiError(error, request.model);
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** xAI's reasoning_effort ladder is two rungs (low|high); other stored values fall through unset rather than guessing. */
function xaiEffort(effort: ReasoningEffort | null | undefined): "low" | "high" | null {
  return effort === "low" || effort === "high" ? effort : null;
}

/**
 * Confirmed live against the real endpoint (unauthenticated, no key needed to
 * see this): xAI's error body is `{"error": "plain string", "code": "..."}`,
 * not OpenAI's nested `{"error": {"message": "..."}}` despite the rest of the
 * API being OpenAI-compatible. Both shapes are handled since a differently
 * classified error could still come back nested.
 */
function xaiErrorMessage(body: string): string | null {
  try {
    const error: unknown = asRecord(JSON.parse(body)).error;
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
    const nestedMessage = asRecord(error).message;
    return typeof nestedMessage === "string" && nestedMessage.length > 0 ? nestedMessage : null;
  } catch {
    return null;
  }
}

function describeXaiError(error: HttpLookupError, model: string): Error {
  if (error.status === 401) {
    return new Error("The stored xAI key was rejected. Replace it in Settings -> API keys.", { cause: error });
  }
  if (error.status === 404) {
    return new Error(`xAI does not recognize the model "${model}". Pick another one in Settings.`, { cause: error });
  }
  if (error.status === 429) {
    return new Error("xAI rate-limited this run. Wait a moment and re-run the agent.", { cause: error });
  }
  const reported = xaiErrorMessage(error.body);
  return new Error(
    reported ? `xAI returned an error: ${reported} (model: ${model})` : `xAI returned HTTP ${error.status} for model ${model}`,
    { cause: error }
  );
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
    new XaiChatProvider(() => resolveSecret("xai", "agent.xai")),
    new UnavailableChatProvider("openai"),
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
