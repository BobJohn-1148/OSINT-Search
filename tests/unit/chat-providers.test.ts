/**
 * OllamaChatProvider is the only real model call in the codebase, so its
 * request shape and failure handling are worth pinning directly rather than
 * only through agent-runtime-service.ts's higher-level tests.
 */
import { ChatProviderResolver, OllamaChatProvider, UnavailableChatProvider } from "../../src/main/providers/chat-providers";

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

describe("ChatProviderResolver", () => {
  it("resolves ollama to a real provider and unwired providers to UnavailableChatProvider by default", () => {
    const resolver = new ChatProviderResolver();
    expect(resolver.resolve("ollama")).toBeInstanceOf(OllamaChatProvider);
    expect(resolver.resolve("openai")).toBeInstanceOf(UnavailableChatProvider);
  });

  it("throws for a provider id that was never registered", () => {
    const resolver = new ChatProviderResolver([new OllamaChatProvider()]);
    expect(() => resolver.resolve("anthropic")).toThrow(/not configured/);
  });
});
