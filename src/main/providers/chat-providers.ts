/**
 * Chat providers are the one place an agent actually reaches a model, because
 * every agent run before this depended on hand-written template strings —
 * agent-runtime-service.ts read a prompt file only to count its characters,
 * never sent it anywhere. That is why every agent's saved memory looked the
 * same regardless of provider, seed, or persona: nothing distinguishing was
 * ever generated. This resolver gives each provider one real `complete()`
 * call so that stops being true for Ollama, and fails loudly (not with fake
 * text) for providers not wired yet, so a misconfigured agent cannot silently
 * keep producing template output that looks like real reasoning.
 */
import type { ProviderId } from "../../shared/types/providers.js";
import { asRecord, fetchJson } from "../search/http.js";

export interface ChatCompletionRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly model: string;
}

export interface ChatCompletionResult {
  readonly text: string;
}

export interface ChatProvider {
  readonly id: ProviderId;
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
}

const OLLAMA_TIMEOUT_MS = 120_000;
const LOOPBACK_HOST = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

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

export class UnavailableChatProvider implements ChatProvider {
  public constructor(public readonly id: ProviderId) {}

  public complete(): Promise<ChatCompletionResult> {
    return Promise.reject(
      new Error(`${this.id} is not wired to a real model call yet -- only ollama is. Switch this agent's provider to Ollama in Settings.`)
    );
  }
}

export class ChatProviderResolver {
  private readonly providers: Map<ProviderId, ChatProvider>;

  public constructor(
    providers: readonly ChatProvider[] = [
      new OllamaChatProvider(),
      new UnavailableChatProvider("openai"),
      new UnavailableChatProvider("xai"),
      new UnavailableChatProvider("anthropic"),
      new UnavailableChatProvider("lm-studio")
    ]
  ) {
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
