/**
 * Renderer shell tests pin navigation, token use, and local persistence before
 * real investigative surfaces arrive. If stubs cannot route and keep shell
 * state now, later feature tests will hide foundation regressions.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { AppFrame } from "../../src/renderer/App";
import { navigationRoutes } from "../../src/renderer/navigation";
import type { Result } from "../../src/shared/result";

type RendererInvokeMock = (channel: string, request?: unknown) => Promise<Result<unknown>>;

function createDefaultInvokeMock() {
  return vi.fn<RendererInvokeMock>((channel) => {
    if (channel === "keys:list") {
      return Promise.resolve({ ok: true as const, value: { keys: [] } });
    }
    if (channel === "providers:list") {
      return Promise.resolve({ ok: true as const, value: { providers: [] } });
    }
    if (channel === "agents:list") {
      return Promise.resolve({ ok: true as const, value: { agents: [] } });
    }
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [] } });
    }
    if (channel === "case:timeline") {
      return Promise.resolve({ ok: true as const, value: { items: [] } });
    }
    if (channel === "case:summary") {
      return Promise.resolve({ ok: true as const, value: { summary: { caseId: "case-one", counts: {}, keyEntities: [] } } });
    }
    if (channel === "report:list") {
      return Promise.resolve({ ok: true as const, value: { reports: [] } });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
}

let invokeMock: ReturnType<typeof createDefaultInvokeMock>;

beforeEach(() => {
  window.localStorage.clear();
  invokeMock = createDefaultInvokeMock();
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: {
      channels: [
        "system:ping",
        "keys:list",
        "providers:list",
        "agents:list",
        "search:run",
        "cases:list",
        "cases:create",
        "case:addItem",
        "case:timeline",
        "case:summary",
        "report:generate",
        "report:list",
        "report:open"
      ],
      onSearchEvent: vi.fn().mockReturnValue(() => {}),
      invoke: invokeMock
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
    } else if (route.id === "cases") {
      expect(screen.getByRole("button", { name: "Create case" })).toBeInTheDocument();
    } else if (route.id === "reports") {
      expect(screen.getByRole("button", { name: "Generate report" })).toBeInTheDocument();
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

it("search route saves a selected tree node to a case so search output becomes evidence", async () => {
  const user = userEvent.setup();
  const openCase = {
    id: "case-one",
    title: "Acme review",
    status: "open",
    createdTs: "2026-08-10T10:00:00.000Z",
    updatedTs: "2026-08-10T10:00:00.000Z",
    tags: ["client"]
  };
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "search:run") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: {
            runId: "run-one",
            seed: { type: "domain", value: "example.com" },
            startedTs: "2026-08-10T10:00:00.000Z",
            completedTs: "2026-08-10T10:00:01.000Z",
            statuses: [],
            observations: [],
            entities: [],
            tree: {
              id: "root",
              label: "example.com",
              kind: "root",
              saveable: false,
              children: [
                {
                  id: "node-one",
                  label: "example.com from RDAP",
                  kind: "observation",
                  sourceId: "rdap",
                  observationId: "obs-one",
                  entity: "example.com",
                  strength: 3,
                  band: "strong",
                  saveable: true,
                  children: []
                }
              ]
            }
          }
        }
      });
    }
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [openCase] } });
    }
    if (channel === "case:addItem") {
      return Promise.resolve({
        ok: true as const,
        value: {
          item: {
            id: "item-one",
            caseId: "case-one",
            itemType: "observation",
            refId: "obs-one",
            title: "example.com from RDAP",
            text: "example.com from RDAP",
            sourceTs: "2026-08-10T10:00:01.000Z",
            metadata: {}
          }
        }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.click(await screen.findByRole("button", { name: /example\.com from RDAP/i }));
  await user.click(screen.getByRole("button", { name: "Save node" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "case:addItem",
      expect.objectContaining({
        caseId: "case-one",
        itemType: "observation",
        refId: "obs-one",
        title: "example.com from RDAP"
      })
    );
  });
  expect(await screen.findByText("Saved to Acme review")).toBeInTheDocument();
});

it("cases route renders timeline items so saved evidence can be verified", async () => {
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "cases:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          cases: [
            {
              id: "case-one",
              title: "Acme review",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: ["client"]
            }
          ]
        }
      });
    }
    if (channel === "case:timeline") {
      return Promise.resolve({
        ok: true as const,
        value: {
          items: [
            {
              id: "item-one",
              caseId: "case-one",
              itemType: "observation",
              refId: "obs-one",
              title: "Saved domain",
              text: "example.com appeared in RDAP",
              sourceTs: "2026-08-10T10:00:00.000Z",
              metadata: {}
            }
          ]
        }
      });
    }
    if (channel === "case:summary") {
      return Promise.resolve({
        ok: true as const,
        value: { summary: { caseId: "case-one", counts: { observation: 1 }, keyEntities: [] } }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/cases"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect(await screen.findByText("Saved domain")).toBeInTheDocument();
  expect(screen.getByText("example.com appeared in RDAP")).toBeInTheDocument();
});

it("reports route generates a PDF from a selected case so exports are reachable from the shell", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "cases:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          cases: [
            {
              id: "case-one",
              title: "Acme review",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ]
        }
      });
    }
    if (channel === "report:list") {
      return Promise.resolve({ ok: true as const, value: { reports: [] } });
    }
    if (channel === "report:generate") {
      return Promise.resolve({
        ok: true as const,
        value: {
          report: {
            id: "report-one",
            caseId: "case-one",
            scanId: null,
            format: "pdf",
            path: "C:\\reports\\acme.pdf",
            createdTs: "2026-08-10T10:00:00.000Z"
          }
        }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/reports"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: "Generate report" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("report:generate", { caseId: "case-one", format: "pdf" });
  });
  expect(await screen.findByText("Generated PDF report")).toBeInTheDocument();
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
