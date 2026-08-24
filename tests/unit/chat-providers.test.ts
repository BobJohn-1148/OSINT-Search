/**
 * OllamaChatProvider is the only real model call in the codebase, so its
 * request shape and failure handling are worth pinning directly rather than
 * only through agent-runtime-service.ts's higher-level tests.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AnthropicChatProvider,
  ChatProviderResolver,
  defaultChatProviders,
  OllamaChatProvider,
  UnavailableChatProvider
} from "../../src/main/providers/chat-providers";

describe("OllamaChatProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts a chat request to /api/chat with the system and user prompt as messages", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: unknown;
    global.fetch = vi.fn((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve(new Response(JSON.stringify({ message: { role: "assistant", content: "hello" } }), { status: 200 }));
    }) as unknown as typeof fetch;

    const provider = new OllamaChatProvider();
    const result = await provider.complete({ systemPrompt: "You are an agent.", userPrompt: "Investigate jdoe.", model: "llama3.3" });

    expect(result.text).toBe("hello");
    expect(capturedUrl).toBe("http://127.0.0.1:11434/api/chat");
    expect(capturedBody).toMatchObject({
      model: "llama3.3",
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "Investigate jdoe." }
      ]
    });
  });

  it("raises a clear error when Ollama's response has no message content", async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 200 })));
    const provider = new OllamaChatProvider();

    await expect(provider.complete({ systemPrompt: "s", userPrompt: "u", model: "llama3.3" })).rejects.toThrow(
      /did not include message content/
    );
  });

  it("raises a clear, actionable error when Ollama is unreachable instead of a raw fetch error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:11434")));
    const provider = new OllamaChatProvider();

    await expect(provider.complete({ systemPrompt: "s", userPrompt: "u", model: "llama3.3" })).rejects.toThrow(
      /Could not reach Ollama.*is it running/
    );
  });

  it("rejects a non-loopback base URL so a remote host cannot be configured accidentally", () => {
    expect(() => new OllamaChatProvider("http://198.51.100.5:11434")).toThrow(/must be loopback/);
  });
});

describe("UnavailableChatProvider", () => {
  it("fails loudly instead of returning fake text for a provider that has no real call wired", async () => {
    const provider = new UnavailableChatProvider("openai");
    await expect(provider.complete()).rejects.toThrow(/not wired to a real model call/);
  });
});

describe("AnthropicChatProvider", () => {
  // Stands in for the SDK client so the tests never make a network call and can
  // assert on the exact request shape the provider builds.
  function fakeClient(capture: { request?: unknown }, response: unknown) {
    return () =>
      ({
        messages: {
          create: (request: unknown) => {
            capture.request = request;
            return Promise.resolve(response);
          }
        }
      }) as unknown as Anthropic;
  }

  const textResponse = { content: [{ type: "text", text: "{}" }], stop_reason: "end_turn" };

  it("sends the system prompt, the user prompt, and nothing else the current API rejects", async () => {
    const capture: { request?: unknown } = {};
    const provider = new AnthropicChatProvider(() => "sk-ant-test", fakeClient(capture, textResponse));

    await provider.complete({ systemPrompt: "You are Ripper.", userPrompt: "Investigate jdoe.", model: "claude-sonnet-5" });

    expect(capture.request).toMatchObject({
      model: "claude-sonnet-5",
      system: "You are Ripper.",
      messages: [{ role: "user", content: "Investigate jdoe." }]
    });
    // budget_tokens and an explicit thinking block are both rejected by current
    // models, so their absence is part of the contract.
    expect(capture.request).not.toHaveProperty("thinking");
    expect(capture.request).not.toHaveProperty("budget_tokens");
  });

  it("forwards the agent's stored reasoning effort, which nothing sent before this", async () => {
    const capture: { request?: unknown } = {};
    const provider = new AnthropicChatProvider(() => "sk-ant-test", fakeClient(capture, textResponse));

    await provider.complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5", effort: "high" });

    expect(capture.request).toMatchObject({ output_config: { effort: "high" } });
  });

  it("omits output_config entirely when no effort is stored, rather than inventing a default", async () => {
    const capture: { request?: unknown } = {};
    const provider = new AnthropicChatProvider(() => "sk-ant-test", fakeClient(capture, textResponse));

    await provider.complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5", effort: null });

    expect(capture.request).not.toHaveProperty("output_config");
  });

  it("maps the app's minimal rung down to low, because the Messages API has no such level", async () => {
    const capture: { request?: unknown } = {};
    const provider = new AnthropicChatProvider(() => "sk-ant-test", fakeClient(capture, textResponse));

    await provider.complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5", effort: "minimal" });

    expect(capture.request).toMatchObject({ output_config: { effort: "low" } });
  });

  it("joins every text block so a leading thinking block cannot swallow the JSON the agent parses", async () => {
    const provider = new AnthropicChatProvider(
      () => "sk-ant-test",
      fakeClient({}, {
        content: [
          { type: "thinking", thinking: "considering" },
          { type: "text", text: '{"steps":' },
          { type: "text", text: "[]}" }
        ],
        stop_reason: "end_turn"
      })
    );

    const result = await provider.complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5" });

    expect(result.text).toBe('{"steps":[]}');
  });

  it("points at Settings when no key is stored, instead of failing with an authorization error", async () => {
    const provider = new AnthropicChatProvider(() => null);

    await expect(provider.complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5" })).rejects.toThrow(
      /No Anthropic key is stored.*Settings/
    );
  });

  it("raises a clear error when the model returns no text at all", async () => {
    const provider = new AnthropicChatProvider(() => "sk-ant-test", fakeClient({}, { content: [], stop_reason: "refusal" }));

    await expect(provider.complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5" })).rejects.toThrow(
      /no text content.*refusal/
    );
  });
});

describe("ChatProviderResolver", () => {
  it("resolves ollama and anthropic to real providers and unwired ones to UnavailableChatProvider by default", () => {
    const resolver = new ChatProviderResolver();
    expect(resolver.resolve("ollama")).toBeInstanceOf(OllamaChatProvider);
    expect(resolver.resolve("anthropic")).toBeInstanceOf(AnthropicChatProvider);
    expect(resolver.resolve("openai")).toBeInstanceOf(UnavailableChatProvider);
  });

  it("reads the Anthropic key through the injected vault resolver, never from ambient environment", async () => {
    const reads: [string, string][] = [];
    const resolver = new ChatProviderResolver(
      defaultChatProviders((source, purpose) => {
        reads.push([source, purpose]);
        return null;
      })
    );

    await expect(
      resolver.resolve("anthropic").complete({ systemPrompt: "s", userPrompt: "u", model: "claude-sonnet-5" })
    ).rejects.toThrow(/No Anthropic key is stored/);
    expect(reads).toEqual([["anthropic", "agent.anthropic"]]);
  });

  it("throws for a provider id that was never registered", () => {
    const resolver = new ChatProviderResolver([new OllamaChatProvider()]);
    expect(() => resolver.resolve("anthropic")).toThrow(/not configured/);
  });
});
