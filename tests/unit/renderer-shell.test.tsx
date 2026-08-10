/**
 * Renderer shell tests pin navigation, token use, and local persistence before
 * real investigative surfaces arrive. If stubs cannot route and keep shell
 * state now, later feature tests will hide foundation regressions.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { AppFrame } from "../../src/renderer/App";
import { navigationRoutes } from "../../src/renderer/navigation";

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: {
      channels: ["system:ping", "keys:list", "providers:list", "agents:list", "search:run"],
      onSearchEvent: vi.fn().mockReturnValue(() => {}),
      invoke: vi.fn((channel: string) => {
        if (channel === "keys:list") {
          return Promise.resolve({ ok: true, value: { keys: [] } });
        }
        if (channel === "providers:list") {
          return Promise.resolve({ ok: true, value: { providers: [] } });
        }
        if (channel === "agents:list") {
          return Promise.resolve({ ok: true, value: { agents: [] } });
        }

        return Promise.resolve({ ok: true, value: { pong: true, nonce: "test", audited: true } });
      })
    }
  });
});

it("renders every stub route and the settings route so the app boots and navigates across all surfaces", () => {
  for (const route of navigationRoutes) {
    const { unmount } = render(
      <MemoryRouter initialEntries={[route.path]}>
        <AppFrame />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: route.label })).toBeInTheDocument();
    if (route.id === "settings") {
      expect(screen.getByRole("heading", { name: "API keys" })).toBeInTheDocument();
    } else if (route.id === "search") {
      expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    } else {
      expect(screen.getByText(`surface:${route.id} status:stub`)).toBeInTheDocument();
    }
    unmount();
  }
});

it("sidebar collapse state persists across reload so workspace chrome does not reset", async () => {
  const user = userEvent.setup();
  const firstRender = render(
    <MemoryRouter initialEntries={["/"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(window.localStorage.getItem("reacher.sidebar.collapsed")).toBe("true");
  firstRender.unmount();

  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
});

it("no hex literals in renderer so visual color resolves through theme tokens", () => {
  const rendererRoot = path.join(process.cwd(), "src", "renderer");
  const files = collectRendererFiles(rendererRoot);
  const source = files.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
  const nonThemeSource = files
    .filter((filePath) => path.basename(filePath) !== "theme.css")
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");

  expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(nonThemeSource).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(/i);
});

function collectRendererFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectRendererFiles(fullPath);
    }
    return /\.(ts|tsx|css)$/.test(fullPath) ? [fullPath] : [];
  });
}
