/**
 * Settings view tests exist because a provider's Test light was pure React
 * state (useState({}), no persistence at all) -- it reset to grey/red on
 * every single app launch even after a real successful Test, which read as
 * "the app forgot it verified this" every time Jack reopened Reacher. The
 * mock here tracks settings:set calls in a real dictionary and answers
 * settings:get from it, so a fresh render (standing in for an app restart)
 * only shows green if the fix genuinely persisted something -- not because
 * the mock happened to remember it for free.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "../../src/renderer/components/settings-view";
import type { Result } from "../../src/shared/result";

type RendererInvokeMock = (channel: string, request?: unknown) => Promise<Result<unknown>>;

function createStore(options: { readonly withStoredKey?: boolean } = {}) {
  const store = new Map<string, string>();
  let keyRevoked = false;

  function invoke(channel: string, request?: unknown): Promise<Result<unknown>> {
    if (channel === "keys:list") {
      const keys = options.withStoredKey && !keyRevoked ? [{ source: "openai", lastUsedTs: null }] : [];
      return Promise.resolve({ ok: true as const, value: { keys } });
    }
    if (channel === "keys:revoke") {
      keyRevoked = true;
      return Promise.resolve({ ok: true as const, value: { revoked: true } });
    }
    if (channel === "keys:test") {
      return Promise.resolve({ ok: true as const, value: { ok: true, message: "openai reachable" } });
    }
    if (channel === "providers:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          providers: [
            { id: "openai", label: "OpenAI", requiresKey: true, keySource: "openai", defaultModel: "gpt-5.1", availableModels: ["gpt-5.1"] },
            { id: "ollama", label: "Ollama", requiresKey: false, keySource: null, defaultModel: "llama3.1:8b", availableModels: ["llama3.1:8b"] }
          ]
        }
      });
    }
    if (channel === "agents:list") {
      return Promise.resolve({ ok: true as const, value: { agents: [] } });
    }
    if (channel === "providers:test") {
      const provider = (request as { readonly provider: string }).provider;
      return Promise.resolve({ ok: true as const, value: { provider, ok: true, message: `${provider} reachable`, model: "test-model" } });
    }
    if (channel === "settings:get") {
      const key = (request as { readonly key: string }).key;
      return Promise.resolve({ ok: true as const, value: { key, value: store.get(key) ?? null } });
    }
    if (channel === "settings:set") {
      const { key, value } = request as { readonly key: string; readonly value: string };
      store.set(key, value);
      return Promise.resolve({ ok: true as const, value: { key, value } });
    }
    return Promise.resolve({ ok: true as const, value: {} });
  }

  return { invoke: vi.fn<RendererInvokeMock>(invoke), store };
}

function installBridge(invoke: RendererInvokeMock): void {
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: { channels: [], invoke, onSearchEvent: vi.fn().mockReturnValue(() => {}), onAgentEvent: vi.fn().mockReturnValue(() => {}) }
  });
}

it("keeps a provider's Test result green after the app restarts, instead of forgetting it every launch", async () => {
  const user = userEvent.setup();
  const { invoke } = createStore();
  installBridge(invoke);

  const first = render(<SettingsView />);
  await user.click((await screen.findAllByRole("button", { name: "Test" }))[0]);
  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith("providers:test", { provider: "openai" });
  });
  await waitFor(() => {
    expect(document.querySelector(".status-dot-verified")).not.toBeNull();
  });
  first.unmount();

  // A fresh mount with the same backing store stands in for relaunching the
  // app: nothing was clicked here, so a green dot can only come from what
  // the first mount actually persisted.
  render(<SettingsView />);
  await waitFor(() => {
    expect(document.querySelector(".status-dot-verified")).not.toBeNull();
  });
});

it("clears a key's Test result when it is revoked, so a stale green light cannot outlive the credential", async () => {
  const user = userEvent.setup();
  const { invoke, store } = createStore({ withStoredKey: true });
  installBridge(invoke);

  render(<SettingsView />);
  await user.click(await screen.findByRole("button", { name: "Test openai" }));
  await waitFor(() => {
    expect(store.get("providers.diagnostics.openai")).toBe("ok");
  });
  expect(document.querySelector(".status-dot-verified")).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "Revoke openai" }));
  await waitFor(() => {
    expect(store.get("providers.diagnostics.openai")).toBe("untested");
  });

  // A fresh mount (standing in for a restart) must not read the revoked
  // key's diagnostic back as verified -- neither the (now gone) key row nor
  // the still-present provider row, since both read the same diagnostic id.
  render(<SettingsView />);
  await waitFor(() => {
    expect(screen.getAllByText("OpenAI").length).toBeGreaterThan(0);
  });
  expect(document.querySelectorAll(".status-dot-verified")).toHaveLength(0);
});
