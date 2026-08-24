/**
 * Renderer shell tests pin navigation, token use, and local persistence before
 * real investigative surfaces arrive. If stubs cannot route and keep shell
 * state now, later feature tests will hide foundation regressions.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
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
    if (channel === "agent:states") {
      return Promise.resolve({ ok: true as const, value: { states: [] } });
    }
    if (channel === "agent:runs") {
      return Promise.resolve({ ok: true as const, value: { runs: [] } });
    }
    if (channel === "agent:memory:list") {
      return Promise.resolve({ ok: true as const, value: { memory: [] } });
    }
    if (channel === "agent:playbooks") {
      return Promise.resolve({ ok: true as const, value: { playbooks: [] } });
    }
    if (channel === "dashboard:summary") {
      return Promise.resolve({
        ok: true as const,
        value: {
          activeCases: [],
          recentSearches: [],
          recentAgentRuns: [],
          agentStatus: { working: 0, idle: 0, offline: 0, error: 0, states: [] },
          watchAlerts: [],
          recentAudit: []
        }
      });
    }
    if (channel === "audit:query") {
      return Promise.resolve({ ok: true as const, value: { events: [] } });
    }
    if (channel === "mobile:profiles") {
      return Promise.resolve({
        ok: true as const,
        value: {
          profiles: [
            {
              platform: "android",
              label: "Android",
              requiredTool: "adb",
              dataTypes: [
                {
                  id: "android-device-info",
                  label: "Device info",
                  sensitivity: "medium",
                  description: "Model and build data.",
                  commandPreview: ["adb", "shell", "getprop"]
                }
              ]
            },
            {
              platform: "ios",
              label: "Apple iOS",
              requiredTool: "libimobiledevice",
              dataTypes: [
                {
                  id: "ios-device-info",
                  label: "Device info",
                  sensitivity: "medium",
                  description: "Trusted-pairing inventory.",
                  commandPreview: ["ideviceinfo"]
                }
              ]
            }
          ]
        }
      });
    }
    if (channel === "mobile:detect") {
      return Promise.resolve({ ok: true as const, value: { devices: [], unavailableTools: ["adb"] } });
    }
    if (channel === "social:analyze") {
      return Promise.resolve({
        ok: true as const,
        value: {
          username: "jdoe",
          totalNetworks: 320,
          candidates: [
            {
              network: "Example social",
              url: "https://example.test/jdoe",
              fields: ["profile", "relationships", "images"],
              status: "candidate"
            }
          ],
          recommendedTools: ["maigret-social", "whatsmyname"]
        }
      });
    }
    if (channel === "methodology:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          phases: [
            {
              id: "reconnaissance",
              title: "Reconnaissance",
              summary: "Gather public context.",
              frameworkRefs: ["OWASP WSTG-INFO"],
              tools: [
                {
                  id: "search",
                  label: "OSINT search",
                  surface: "Search",
                  command: "search:run",
                  input: "Seed",
                  output: "Observations",
                  tier: "passive",
                  authorizationRequired: false
                }
              ]
            }
          ]
        }
      });
    }
    if (channel === "methodology:export") {
      return Promise.resolve({
        ok: true as const,
        value: { filename: "reacher-methodology-coverage.csv", csv: "phase,tool\nReconnaissance,OSINT search" }
      });
    }
    if (channel === "settings:get") {
      return Promise.resolve({ ok: true as const, value: { key: "agents.cleanIdleStatuses", value: "false" } });
    }
    if (channel === "settings:set") {
      return Promise.resolve({ ok: true as const, value: { key: "agents.cleanIdleStatuses", value: "true" } });
    }
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [] } });
    }
    if (channel === "watch:list") {
      return Promise.resolve({ ok: true as const, value: { watches: [], alerts: [] } });
    }
    if (channel === "watch:exposures") {
      return Promise.resolve({ ok: true as const, value: { exposures: [] } });
    }
    if (channel === "watch:add") {
      return Promise.resolve({
        ok: true as const,
        value: {
          watch: {
            id: "watch-one",
            type: "email",
            value: "security@example.com",
            caseId: null,
            checkIntervalMinutes: 60,
            createdTs: "2026-08-10T10:00:00.000Z",
            lastCheckedTs: null
          }
        }
      });
    }
    if (channel === "watch:checkNow") {
      return Promise.resolve({
        ok: true as const,
        value: {
          watch: {
            id: "watch-one",
            type: "email",
            value: "security@example.com",
            caseId: null,
            checkIntervalMinutes: 60,
            createdTs: "2026-08-10T10:00:00.000Z",
            lastCheckedTs: "2026-08-10T10:01:00.000Z"
          },
          exposures: [],
          newExposures: [],
          alerts: [],
          skippedSources: [],
          savedItems: 0,
          searchRunId: null
        }
      });
    }
    if (channel === "watch:remove") {
      return Promise.resolve({ ok: true as const, value: { removed: true } });
    }
    if (channel === "case:timeline") {
      return Promise.resolve({ ok: true as const, value: { items: [] } });
    }
    if (channel === "case:summary") {
      return Promise.resolve({ ok: true as const, value: { summary: { caseId: "case-one", counts: {}, keyEntities: [] } } });
    }
    if (channel === "case:documents:list") {
      return Promise.resolve({ ok: true as const, value: { documents: [] } });
    }
    if (channel === "case:document:upsert") {
      return Promise.resolve({
        ok: true as const,
        value: {
          document: {
            id: "document-one",
            caseId: "case-one",
            name: "Rules of engagement",
            scope: "example.com",
            dateFrom: "2026-08-10",
            dateTo: "2026-08-17",
            body: "Scope notes",
            createdTs: "2026-08-10T10:00:00.000Z",
            updatedTs: "2026-08-10T10:00:00.000Z"
          }
        }
      });
    }
    if (channel === "report:list") {
      return Promise.resolve({ ok: true as const, value: { reports: [] } });
    }
    if (channel === "tools:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          tools: [
            {
              id: "sherlock",
              name: "Sherlock",
              description: "Username lookup across public social sites.",
              installCommand: "pipx install sherlock-project",
              officialLink: "https://github.com/sherlock-project/sherlock",
              category: "username",
              tier: "passive",
              defaultArgs: ["sherlock"]
            }
          ]
        }
      });
    }
    if (channel === "auth:list") {
      return Promise.resolve({ ok: true as const, value: { authorizations: [] } });
    }
    if (channel === "scan:topology") {
      return Promise.resolve({ ok: true as const, value: { topology: { scanId: "scan-one", nodes: [], edges: [] } } });
    }
    if (channel === "analyzer:evtx:import") {
      return Promise.resolve({ ok: true as const, value: { importId: "evtx-one", events: [], findings: [] } });
    }
    if (channel === "analyzer:pcap:import") {
      return Promise.resolve({ ok: true as const, value: { importId: "pcap-one", conversations: [], findings: [] } });
    }
    if (channel === "analyzer:dork:build") {
      return Promise.resolve({ ok: true as const, value: { dorks: [], findings: [] } });
    }
    if (channel === "analyzer:mac:lookup") {
      return Promise.resolve({
        ok: true as const,
        value: { result: { mac: "00:16:3e:00:00:01", oui: "00163E", vendor: "Apple, Inc.", source: "offline" }, findings: [] }
      });
    }
    if (channel === "analyzer:vuln:lookup") {
      return Promise.resolve({ ok: true as const, value: { vulnerabilities: [], findings: [], cached: false } });
    }
    if (channel === "system:pickImage") {
      return Promise.resolve({ ok: true as const, value: { imagePath: "C:\\images\\picked.png" } });
    }
    if (channel === "search:image") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: minimalRun("image-run", { type: "image", value: "C:\\images\\subject.png" }, "Matching profile photo"),
          records: [],
          savedItems: 1,
          usedBrowserFallback: true,
          browserLaunches: []
        }
      });
    }
    if (channel === "search:usernameSweep") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: minimalRun("username-run", { type: "username", value: "jdoe" }, "GitHub"),
          savedItems: 2,
          toolRunIds: ["maigret:jdoe", "blackbird:jdoe"],
          agentRunId: null
        }
      });
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
        "system:pickImage",
        "system:pickFile",
        "dashboard:summary",
        "audit:query",
        "mobile:profiles",
        "mobile:detect",
        "social:analyze",
        "methodology:list",
        "methodology:export",
        "keys:list",
        "providers:list",
        "agents:list",
        "agents:setEffort",
        "agent:states",
        "agent:runs",
        "agent:memory:list",
        "agent:playbooks",
        "agent:run",
        "settings:get",
        "settings:set",
        "search:run",
        "search:image",
        "search:usernameSweep",
        "cases:list",
        "cases:create",
        "case:addItem",
        "case:timeline",
        "case:summary",
        "case:documents:list",
        "case:document:upsert",
        "report:generate",
        "report:list",
        "report:open",
        "tools:list",
        "tools:detect",
        "tools:launch",
        "catalog:add",
        "catalog:update",
        "auth:create",
        "auth:list",
        "scan:run",
        "scan:get",
        "scan:topology",
        "analyzer:evtx:import",
        "analyzer:pcap:import",
        "analyzer:dork:build",
        "analyzer:mac:lookup",
        "analyzer:vuln:lookup",
        "analyzer:malware:triage",
        "analyzer:email:headers",
        "watch:add",
        "watch:list",
        "watch:remove",
        "watch:checkNow",
        "watch:exposures"
      ],
      onSearchEvent: vi.fn().mockReturnValue(() => {}),
      onAgentEvent: vi.fn().mockReturnValue(() => {}),
      onToolEvent: vi.fn().mockReturnValue(() => {}),
      onScanEvent: vi.fn().mockReturnValue(() => {}),
      invoke: invokeMock
    }
  });
});

it("renders every stub route and the settings route so the app boots and navigates across all surfaces", async () => {
  for (const route of navigationRoutes) {
    const { unmount } = render(
      <MemoryRouter initialEntries={[route.path]}>
        <AppFrame />
      </MemoryRouter>
    );

    if (route.id === "search") {
      expect(screen.getByRole("heading", { name: /good (morning|afternoon|evening), user\./i })).toBeInTheDocument();
    } else if (route.id === "social-analyzer") {
      expect(screen.getByRole("heading", { name: "Which username are we tracing?" })).toBeInTheDocument();
    } else if (route.id === "ai-agents") {
      // The AI agents route dropped its page title so the 3D den is the hero;
      // the always-present "Roster" section heading anchors the assertion.
      expect(screen.getByRole("heading", { name: "Roster" })).toBeInTheDocument();
    } else {
      expect(screen.getByRole("heading", { name: route.label })).toBeInTheDocument();
    }
    if (route.id === "dashboard") {
      expect(screen.getByRole("button", { name: "Add watch" })).toBeInTheDocument();
    } else if (route.id === "settings") {
      expect(screen.getByRole("heading", { name: "API keys" })).toBeInTheDocument();
    } else if (route.id === "search") {
      expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    } else if (route.id === "cases") {
      expect(screen.getByRole("button", { name: "Create case" })).toBeInTheDocument();
    } else if (route.id === "ai-agents") {
      expect(screen.getByRole("button", { name: "Open chat" })).toBeInTheDocument();
    } else if (route.id === "tools") {
      expect(await screen.findByRole("button", { name: "Launch tool" })).toBeInTheDocument();
    } else if (route.id === "network-scan") {
      expect(screen.getByRole("button", { name: "Run scan" })).toBeInTheDocument();
    } else if (route.id === "analyzers") {
      expect(screen.getByRole("button", { name: "Build dorks" })).toBeInTheDocument();
    } else if (route.id === "mobile") {
      expect(screen.getByRole("button", { name: "Detect mobile devices" })).toBeInTheDocument();
    } else if (route.id === "social-analyzer") {
      expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    } else if (route.id === "methodology-map") {
      expect(screen.getByRole("button", { name: "Export coverage spreadsheet" })).toBeInTheDocument();
    } else if (route.id === "audit-log") {
      expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
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

  expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveClass("sidebar-toggle");

  await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(window.localStorage.getItem("reacher.sidebar.collapsed")).toBe("true");
  firstRender.unmount();

  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppFrame />
    </MemoryRouter>
  );

  const expandToggle = screen.getByRole("button", { name: "Expand sidebar" });
  expect(expandToggle).toHaveAttribute("aria-expanded", "false");
  expect(expandToggle).toHaveClass("sidebar-toggle");
});

it("sidebar dashboard navigation stays in-app instead of exposing a browser-open href", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/social-analyzer"]}>
      <AppFrame />
    </MemoryRouter>
  );

  const dashboardButton = screen.getByRole("button", { name: "Open Dashboard" });
  expect(dashboardButton).not.toHaveAttribute("href");

  await user.click(dashboardButton);

  expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  expect(dashboardButton).toHaveAttribute("aria-current", "page");
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

  await user.type(screen.getByLabelText("Seed"), "example.com");
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
  await waitFor(() => {
    expect(screen.getAllByText("Saved to Acme review").length).toBeGreaterThan(0);
  });
});

it("search route sends a selected tree node to an agent so discoveries can continue in the agent hub", async () => {
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
    if (channel === "agent:run") {
      return Promise.resolve({ ok: true as const, value: {} });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.type(screen.getByLabelText("Seed"), "example.com");
  await user.click(screen.getByRole("button", { name: "Search" }));
  await user.click(await screen.findByRole("button", { name: /example\.com from RDAP/i }));
  await user.click(screen.getByRole("button", { name: "Send to agent" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "agent:run",
      expect.objectContaining({
        agentId: "osint-agent",
        caseId: "case-one",
        seed: { type: "domain", value: "example.com" }
      })
    );
  });
  await waitFor(() => {
    expect(screen.getAllByText("Sent to OSINT agent for Acme review").length).toBeGreaterThan(0);
  });
});

it("search route runs public-record name lookups and exposes lookup links in details", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string, request?: unknown) => {
    if (channel === "search:run") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: {
            runId: "public-run",
            seed: { type: "name", value: "John Doe" },
            startedTs: "2026-08-10T10:00:00.000Z",
            completedTs: "2026-08-10T10:00:01.000Z",
            statuses: [
              { sourceId: "govsalaries", label: "GovSalaries", status: "returned", observationCount: 1 },
              { sourceId: "judici", label: "Judici public courts", status: "returned", observationCount: 1 }
            ],
            observations: [
              {
                id: "public-run:govsalaries:0",
                runId: "public-run",
                entity: "public-record:govsalaries:john doe",
                type: "public-salary-lookup",
                value: "GovSalaries employee lookup for John Doe",
                source: "govsalaries",
                confidence: 1,
                raw: { lookupUrl: "https://govsalaries.com/search?employee=John+Doe" }
              },
              {
                id: "public-run:judici:0",
                runId: "public-run",
                entity: "public-record:judici:john doe",
                type: "court-record-lookup",
                value: "Judici participating-court lookup for John Doe",
                source: "judici",
                confidence: 1,
                raw: { lookupUrl: "https://www.judici.com/courts/court_list.jsp" }
              }
            ],
            entities: [
              {
                entity: "public-record:govsalaries:john doe",
                type: "public-salary-lookup",
                value: "GovSalaries employee lookup for John Doe",
                sourceIds: ["govsalaries"],
                strength: 1,
                band: "single-source"
              }
            ],
            tree: {
              id: "run:public-run",
              label: "name:John Doe",
              kind: "root",
              saveable: true,
              pivotSeed: { type: "name", value: "John Doe" },
              children: [
                {
                  id: "source:public-run:govsalaries",
                  label: "GovSalaries",
                  kind: "source",
                  sourceId: "govsalaries",
                  saveable: true,
                  children: [
                    {
                      id: "observation:public-run:govsalaries:0",
                      label: "GovSalaries employee lookup for John Doe",
                      kind: "observation",
                      sourceId: "govsalaries",
                      observationId: "public-run:govsalaries:0",
                      entity: "public-record:govsalaries:john doe",
                      strength: 1,
                      band: "single-source",
                      saveable: true,
                      children: []
                    }
                  ]
                }
              ]
            }
          }
        }
      });
    }

    return createDefaultInvokeMock()(channel, request);
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  // Seed type is auto-detected now: "John Doe" (a multi-word value) resolves to name.
  await user.type(screen.getByLabelText("Seed"), "John Doe");
  await user.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "search:run",
      expect.objectContaining({
        seed: { type: "name", value: "John Doe" }
      })
    );
  });

  await user.click(await screen.findByRole("button", { name: /GovSalaries employee lookup for John Doe/i }));

  expect(screen.getByRole("link", { name: "Open lookup" })).toHaveAttribute("href", "https://govsalaries.com/search?employee=John+Doe");
});

it("cases route renders timeline items so saved evidence can be verified", async () => {
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
    if (channel === "case:documents:list") {
      return Promise.resolve({ ok: true as const, value: { documents: [] } });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/cases"]}>
      <AppFrame />
    </MemoryRouter>
  );

  // Evidence is a file-tree node; opening it shows the item text in the viewer.
  await user.click(await screen.findByRole("button", { name: "Saved domain" }));
  expect(await screen.findByText("example.com appeared in RDAP")).toBeInTheDocument();
});

it("cases route generates a PDF from a selected case so reports live under cases", async () => {
  const user = userEvent.setup();
  let generatedReport: {
    id: string;
    caseId: string;
    scanId: null;
    format: "pdf";
    path: string;
    createdTs: string;
  } | null = null;
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
      return Promise.resolve({ ok: true as const, value: { reports: generatedReport ? [generatedReport] : [] } });
    }
    if (channel === "case:timeline") {
      return Promise.resolve({ ok: true as const, value: { items: [] } });
    }
    if (channel === "case:summary") {
      return Promise.resolve({ ok: true as const, value: { summary: { caseId: "case-one", counts: {}, keyEntities: [] } } });
    }
    if (channel === "case:documents:list") {
      return Promise.resolve({ ok: true as const, value: { documents: [] } });
    }
    if (channel === "report:generate") {
      generatedReport = {
        id: "report-one",
        caseId: "case-one",
        scanId: null,
        format: "pdf",
        path: "C:\\reports\\acme.pdf",
        createdTs: "2026-08-10T10:00:00.000Z"
      };
      return Promise.resolve({
        ok: true as const,
        value: { report: generatedReport }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/cases"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getAllByText("Acme review").length).toBeGreaterThan(0);
  });
  await user.click(await screen.findByRole("button", { name: "Generate report" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("report:generate", { caseId: "case-one", format: "pdf" });
  });
  // The generated report is a tree node; opening it shows its path in the viewer.
  await user.click(await screen.findByRole("button", { name: "PDF report" }));
  expect(await screen.findByText("C:\\reports\\acme.pdf")).toBeInTheDocument();
});

it("network scan route renders topology nodes from scan results so parsed hosts are visible", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "scan:run") {
      return Promise.resolve({
        ok: true as const,
        value: {
          scan: {
            id: "scan-one",
            target: "192.168.1.0/24",
            wslDistro: "Ubuntu",
            status: "succeeded",
            scanType: "quick-top-100",
            timing: "T3",
            argv: ["nmap", "-oX", "-", "-T3", "192.168.1.0/24"],
            stdout: "<nmaprun />",
            stderr: "",
            startedTs: "2026-08-10T10:00:00.000Z",
            completedTs: "2026-08-10T10:00:01.000Z",
            authorizationId: "auth-one"
          },
          hosts: [
            {
              id: "host-one",
              scanId: "scan-one",
              address: "192.168.1.10",
              hostname: "workstation.local",
              status: "up",
              hopDistance: 1,
              ports: [
                {
                  id: "port-one",
                  scanId: "scan-one",
                  hostId: "host-one",
                  protocol: "tcp",
                  port: 443,
                  state: "open",
                  service: "https",
                  product: "nginx",
                  version: "1.25"
                }
              ]
            }
          ],
          topology: {
            scanId: "scan-one",
            nodes: [
              { id: "target", label: "192.168.1.0/24", x: 0, y: 0, ring: 0 },
              { id: "host-one", label: "workstation.local (192.168.1.10)", x: 120, y: 40, ring: 1 }
            ],
            edges: [{ id: "target-host-one", source: "target", target: "host-one" }]
          }
        }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/network-scan"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Run scan" }));

  expect(await screen.findByText("workstation.local (192.168.1.10)")).toBeInTheDocument();
  expect(screen.getByText("443/tcp https")).toBeInTheDocument();
});

it("analyzers route builds dorks and saves findings through IPC so query generation stays main-owned", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "dashboard:summary") {
      return Promise.resolve({
        ok: true as const,
        value: {
          activeCases: [
            {
              id: "case-one",
              title: "Credential case",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ],
          recentSearches: [],
          recentAgentRuns: [],
          agentStatus: { working: 0, idle: 0, offline: 0, error: 0, states: [] },
          watchAlerts: [],
          recentAudit: []
        }
      });
    }
    if (channel === "cases:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          cases: [
            {
              id: "case-one",
              title: "Analyzer case",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ]
        }
      });
    }
    if (channel === "analyzer:dork:build") {
      return Promise.resolve({
        ok: true as const,
        value: {
          dorks: [{ label: "Login portals", query: "site:example.com intitle:login OR inurl:login" }],
          findings: [
            {
              id: "dork-one",
              analyzer: "dork",
              type: "dork",
              title: "Login portals",
              text: "site:example.com intitle:login OR inurl:login",
              source: "google-dork",
              severity: "low",
              metadata: {}
            }
          ]
        }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/analyzers"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: "Build dorks" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("analyzer:dork:build", {
      target: "example.com",
      caseId: "case-one"
    });
  });
  expect(await screen.findByText("site:example.com intitle:login OR inurl:login")).toBeInTheDocument();
  // Findings now render as INFO cards: the analyzer badge and source appear separately.
  expect(screen.getAllByText("google-dork").length).toBeGreaterThan(0);
  expect(screen.getAllByText("| dork").length).toBeGreaterThan(0);
});

it("analyzers route hashes a dropped file and renders VirusTotal report data", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "cases:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          cases: [
            {
              id: "case-one",
              title: "Analyzer case",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ]
        }
      });
    }
    if (channel === "analyzer:virustotal:lookup") {
      return Promise.resolve({
        ok: true as const,
        value: {
          report: {
            id: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            sha1: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
            md5: "5d41402abc4b2a76b9719d911017c592",
            fileName: "hello.txt",
            fileSize: 5,
            typeDescription: "Text",
            meaningfulName: "hello.txt",
            magic: "ASCII text",
            reputation: -4,
            firstSubmissionTs: "2026-08-15T10:00:00.000Z",
            lastAnalysisTs: "2026-08-15T11:00:00.000Z",
            lastModificationTs: null,
            detectionStats: {
              malicious: 1,
              suspicious: 0,
              harmless: 12,
              undetected: 58,
              timeout: 0,
              confirmedTimeout: 0,
              failure: 0,
              typeUnsupported: 3
            },
            topDetections: [
              {
                engineName: "AlphaAV",
                category: "malicious",
                result: "EICAR-Test-File",
                method: "blacklist",
                engineVersion: "1.0",
                engineUpdate: "20260815"
              }
            ],
            names: ["hello.txt"],
            tags: ["test-file"],
            threatLabel: "test.eicar",
            guiUrl: "https://www.virustotal.com/gui/file/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            apiUrl: "https://www.virustotal.com/api/v3/files/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            rawJson: { data: { id: "vt-file", attributes: { last_analysis_stats: { malicious: 1 } } } }
          },
          findings: [
            {
              id: "vt-one",
              analyzer: "virustotal",
              type: "file",
              title: "VirusTotal hello.txt",
              text: "malicious:1 suspicious:0 harmless:12 undetected:58",
              source: "https://www.virustotal.com/gui/file/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
              severity: "high",
              metadata: {}
            }
          ]
        }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/analyzers"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: /VirusTotal/ }));
  await user.upload(screen.getByLabelText("VirusTotal file"), new File(["hello"], "hello.txt", { type: "text/plain" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("analyzer:virustotal:lookup", {
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      fileName: "hello.txt",
      fileSize: 5,
      caseId: "case-one"
    });
  });
  expect((await screen.findAllByText("VirusTotal hello.txt")).length).toBeGreaterThan(0);
  expect(screen.getByText("AlphaAV / malicious")).toBeInTheDocument();
  expect(screen.getByText(/"vt-file"/)).toBeInTheDocument();
});

it("analyzers route triages a picked file statically and pivots an extracted IOC into search", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [] } });
    }
    if (channel === "system:pickFile") {
      return Promise.resolve({ ok: true as const, value: { filePath: "C:\\samples\\dropper.bin" } });
    }
    if (channel === "analyzer:malware:triage") {
      return Promise.resolve({
        ok: true as const,
        value: {
          report: {
            sha256: "a".repeat(64),
            sha1: "b".repeat(40),
            md5: "c".repeat(32),
            fileName: "dropper.bin",
            fileSize: 2048,
            fileType: "PE executable (MZ)",
            overallEntropy: 7.4,
            truncated: false,
            isPe: true,
            pe: {
              machine: "x86 (i386)",
              isDll: false,
              subsystem: "Windows console",
              compileTimestampTs: null,
              hasAuthenticode: false,
              sections: [{ name: ".text", virtualSize: 4096, rawSize: 4096, entropy: 7.6, suspicious: true }],
              imports: [{ dll: "kernel32.dll", functions: ["VirtualAlloc"] }],
              suspiciousImports: ["VirtualAlloc"]
            },
            stringCount: 40,
            iocs: [
              { kind: "domain", value: "evil.example.test", seedType: "domain", occurrences: 3 },
              { kind: "mutex", value: "Global\\LockName", seedType: null, occurrences: 1 }
            ],
            notableStrings: ["Dropper build 7"],
            riskScore: 78,
            riskReasons: ["High overall entropy (7.4) suggests packing or encryption"]
          },
          findings: [
            {
              id: "malware:abc",
              analyzer: "malware",
              type: "file",
              title: "Malware triage dropper.bin",
              text: "risk:78/100",
              source: `sha256:${"a".repeat(64)}`,
              severity: "high",
              metadata: {}
            }
          ]
        }
      });
    }
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/analyzers"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: /Malware triage/ }));
  await user.click(screen.getByRole("button", { name: "Browse file" }));
  await user.click(await screen.findByRole("button", { name: "Triage file" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("analyzer:malware:triage", {
      filePath: "C:\\samples\\dropper.bin",
      caseId: undefined
    });
  });
  expect(await screen.findByText("VirtualAlloc")).toBeInTheDocument();
  expect(screen.getByText("evil.example.test")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Pivot" }));

  // The pivot lands on the search composer with the IOC pre-seeded for review.
  expect(await screen.findByRole("heading", { name: /good (morning|afternoon|evening), user\./i })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByLabelText("Seed")).toHaveValue("evil.example.test");
  });
});

it("dashboard adds a watch target and checks exposure alerts so credential monitoring is reachable", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "dashboard:summary") {
      return Promise.resolve({
        ok: true as const,
        value: {
          activeCases: [
            {
              id: "case-one",
              title: "Credential case",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ],
          recentSearches: [],
          recentAgentRuns: [],
          agentStatus: { working: 0, idle: 0, offline: 0, error: 0, states: [] },
          watchAlerts: [],
          recentAudit: []
        }
      });
    }
    if (channel === "cases:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          cases: [
            {
              id: "case-one",
              title: "Credential case",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ]
        }
      });
    }
    if (channel === "watch:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          watches: [
            {
              id: "watch-one",
              type: "email",
              value: "security@example.com",
              caseId: "case-one",
              checkIntervalMinutes: 60,
              createdTs: "2026-08-10T10:00:00.000Z",
              lastCheckedTs: null
            }
          ],
          alerts: []
        }
      });
    }
    if (channel === "watch:exposures") {
      return Promise.resolve({ ok: true as const, value: { exposures: [] } });
    }
    if (channel === "watch:add") {
      return Promise.resolve({
        ok: true as const,
        value: {
          watch: {
            id: "watch-one",
            type: "email",
            value: "security@example.com",
            caseId: "case-one",
            checkIntervalMinutes: 60,
            createdTs: "2026-08-10T10:00:00.000Z",
            lastCheckedTs: null
          }
        }
      });
    }
    if (channel === "watch:checkNow") {
      return Promise.resolve({
        ok: true as const,
        value: {
          watch: {
            id: "watch-one",
            type: "email",
            value: "security@example.com",
            caseId: "case-one",
            checkIntervalMinutes: 60,
            createdTs: "2026-08-10T10:00:00.000Z",
            lastCheckedTs: "2026-08-10T10:01:00.000Z"
          },
          exposures: [
            {
              id: "exposure-one",
              watchId: "watch-one",
              source: "xposedornot",
              title: "Acme breach",
              detail: "XposedOrNot reported security@example.com in Acme breach.",
              fingerprint: "xposedornot:acme breach",
              firstSeenTs: "2026-08-10T10:01:00.000Z",
              lastSeenTs: "2026-08-10T10:01:00.000Z"
            }
          ],
          newExposures: [
            {
              id: "exposure-one",
              watchId: "watch-one",
              source: "xposedornot",
              title: "Acme breach",
              detail: "XposedOrNot reported security@example.com in Acme breach.",
              fingerprint: "xposedornot:acme breach",
              firstSeenTs: "2026-08-10T10:01:00.000Z",
              lastSeenTs: "2026-08-10T10:01:00.000Z"
            }
          ],
          alerts: [
            {
              id: "alert-one",
              exposureId: "exposure-one",
              watchId: "watch-one",
              message: "security@example.com exposed in Acme breach",
              createdTs: "2026-08-10T10:01:00.000Z",
              acknowledgedTs: null
            }
          ],
          skippedSources: [],
          savedItems: 1,
          searchRunId: "run-one"
        }
      });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: "Add watch" }));
  await user.click(await screen.findByRole("button", { name: "Check now" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "watch:checkNow",
      expect.objectContaining({ watchId: "watch-one", caseId: "case-one" })
    );
  });
  expect(await screen.findByText("1 new exposures saved:1")).toBeInTheDocument();
});

it("search attach-image icon picks a file and reverse-searches it in one action", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  // The image path field and browse/search buttons are gone: one attach icon
  // picks a file (system:pickImage) and immediately reverse-searches it.
  await user.click(screen.getByRole("button", { name: "Attach image for reverse search" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("search:image", {
      imagePath: "C:\\images\\picked.png",
      caseId: undefined
    });
  });
});

it("search 'Re-run Ocean agent' button hands the typed seed to the OSINT agent", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.type(screen.getByLabelText("Seed"), "example.com");
  await user.click(screen.getByRole("button", { name: "Re-run Ocean agent" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "agent:run",
      expect.objectContaining({ agentId: "osint-agent", seed: { type: "domain", value: "example.com" } })
    );
  });
});

it("search board fills in the Ocean agent's cited finding as it streams in, so one Enter produces the whole profile", async () => {
  const user = userEvent.setup();
  // The agent replies on its own channel after the search resolves, so the test
  // has to hold the listener the view registered and drive it directly.
  let agentListener: ((batch: { readonly events: readonly unknown[] }) => void) | null = null;
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: {
      ...window.reacher,
      onAgentEvent: vi.fn((_event: string, listener: (batch: { readonly events: readonly unknown[] }) => void) => {
        agentListener = listener;
        return () => {};
      })
    }
  });
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "search:run") {
      return Promise.resolve({
        ok: true as const,
        value: { run: minimalRun("agent-run", { type: "domain", value: "example.com" }, "Example Registrar Inc") }
      });
    }
    return Promise.resolve({ ok: true as const, value: { cases: [], watches: [], alerts: [], agents: [] } });
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.type(screen.getByLabelText("Seed"), "example.com");
  await user.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Ocean agent/ })).toBeInTheDocument();
  });

  act(() => {
    agentListener?.({
      events: [
        {
          type: "agent:step",
          step: {
            runId: "r1",
            agentId: "osint-agent",
            sequence: 1,
            title: "Read the registrar record",
            status: "complete",
            summary: "RDAP named the registrar.",
            next: null,
            sources: ["observation:agent-run:obs"]
          }
        },
        {
          type: "agent:finding",
          finding: {
            id: "f1",
            runId: "r1",
            agentId: "osint-agent",
            caseId: "c1",
            title: "Registrar identified",
            summary: "example.com is registered through Example Registrar Inc.",
            sources: ["observation:agent-run:obs"],
            confidence: 2,
            savedItemId: null
          }
        }
      ]
    });
  });

  expect(await screen.findByText("Registrar identified")).toBeInTheDocument();
  expect(screen.getByText("Read the registrar record")).toBeInTheDocument();
  // The citation is rendered, because a finding the investigator cannot trace
  // back to an observation is exactly what the citation gate exists to prevent.
  expect(screen.getByText("observation:agent-run:obs")).toBeInTheDocument();
});

it("search board ignores agent events from other agents so an unrelated run cannot overwrite the panel", async () => {
  const user = userEvent.setup();
  let agentListener: ((batch: { readonly events: readonly unknown[] }) => void) | null = null;
  Object.defineProperty(window, "reacher", {
    configurable: true,
    value: {
      ...window.reacher,
      onAgentEvent: vi.fn((_event: string, listener: (batch: { readonly events: readonly unknown[] }) => void) => {
        agentListener = listener;
        return () => {};
      })
    }
  });
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "search:run") {
      return Promise.resolve({
        ok: true as const,
        value: { run: minimalRun("other-run", { type: "domain", value: "example.com" }, "Example Registrar Inc") }
      });
    }
    return Promise.resolve({ ok: true as const, value: { cases: [], watches: [], alerts: [], agents: [] } });
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.type(screen.getByLabelText("Seed"), "example.com");
  await user.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Ocean agent/ })).toBeInTheDocument();
  });

  act(() => {
    agentListener?.({
      events: [
        {
          type: "agent:finding",
          finding: {
            id: "f2",
            runId: "r2",
            agentId: "malware-analyst-agent",
            caseId: "c1",
            title: "Unrelated malware finding",
            summary: "Belongs to another surface entirely.",
            sources: ["seed:domain:example.com"],
            confidence: 1,
            savedItemId: null
          }
        }
      ]
    });
  });

  expect(screen.queryByText("Unrelated malware finding")).not.toBeInTheDocument();
});

it("renders six connected methodology phases and stays read-only so the map cannot launch tools", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "methodology:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          phases: [
            "Reconnaissance",
            "Scanning and enumeration",
            "Vulnerability analysis",
            "Exploitation readiness",
            "Post-exploitation analysis",
            "Reporting"
          ].map((title, index) => ({
            id: title.toLowerCase().replaceAll(" ", "-"),
            title,
            summary: `${title} summary`,
            frameworkRefs: ["OWASP WSTG", "PTES", "OSSTMM"],
            tools: [
              {
                id: `${index}-tool`,
                label: `${title} tool`,
                surface: "Tools",
                command: "reference only",
                input: "Input",
                output: "Output",
                tier: index === 3 ? "active" : "passive",
                authorizationRequired: index === 3
              }
            ]
          }))
        }
      });
    }
    if (channel === "methodology:export") {
      return Promise.resolve({
        ok: true as const,
        value: { filename: "reacher-methodology-coverage.csv", csv: "phase,tool\nReconnaissance,OSINT search" }
      });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/methodology-map"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Reconnaissance" })).toBeInTheDocument();
  expect(document.querySelectorAll(".methodology-connector")).toHaveLength(5);
  await user.click(screen.getByRole("button", { name: /Exploitation readiness/ }));
  expect(screen.getByRole("button", { name: /Open Exploitation readiness tool/i })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Export coverage spreadsheet" }));

  const invokedChannels = invokeMock.mock.calls.map(([channel]) => channel);
  expect(invokedChannels.every((channel) => ["methodology:list", "methodology:export"].includes(channel))).toBe(true);
  expect(invokedChannels).not.toEqual(expect.arrayContaining(["tools:launch", "scan:run", "analyzer:pcap:import"]));
});

it("methodology tool links navigate into the recommended tool showcase with fake catalog data", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "methodology:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          phases: [
            {
              id: "reconnaissance",
              title: "Reconnaissance",
              summary: "Gather public context.",
              frameworkRefs: ["OWASP WSTG-INFO"],
              tools: [
                {
                  id: "sherlock",
                  label: "Sherlock",
                  surface: "Tools",
                  command: "sherlock <username>",
                  input: "Username",
                  output: "Profile candidates",
                  tier: "passive",
                  authorizationRequired: false
                }
              ]
            }
          ]
        }
      });
    }
    if (channel === "tools:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          tools: [
            {
              id: "sherlock",
              name: "Sherlock",
              description: "Username lookup across public social sites.",
              installCommand: "pipx install sherlock-project",
              officialLink: "https://github.com/sherlock-project/sherlock",
              category: "username",
              tier: "passive",
              defaultArgs: ["sherlock"]
            }
          ]
        }
      });
    }
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [] } });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/methodology-map"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: "Open Sherlock" }));

  expect(await screen.findByRole("heading", { name: "Tools" })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Sherlock" })).toBeInTheDocument();
});

it("cases route creates and edits a fake scoped document from the document editor", async () => {
  const user = userEvent.setup();
  const fakeCase = {
    id: "case-smoke",
    title: "Fake client assessment",
    status: "open",
    createdTs: "2026-08-10T10:00:00.000Z",
    updatedTs: "2026-08-10T10:00:00.000Z",
    tags: ["fake"]
  };
  let documents: unknown[] = [];
  invokeMock.mockImplementation((channel: string, request?: unknown) => {
    if (channel === "cases:list") {
      return Promise.resolve({ ok: true as const, value: { cases: [fakeCase] } });
    }
    if (channel === "case:timeline") {
      return Promise.resolve({ ok: true as const, value: { items: [] } });
    }
    if (channel === "case:summary") {
      return Promise.resolve({ ok: true as const, value: { summary: { caseId: "case-smoke", counts: {}, keyEntities: [] } } });
    }
    if (channel === "case:documents:list") {
      return Promise.resolve({ ok: true as const, value: { documents } });
    }
    if (channel === "case:document:upsert") {
      const draft = request as {
        name: string;
        scope: string;
        dateFrom: string;
        dateTo: string;
        body: string;
      };
      const document = {
        id: "doc-smoke",
        caseId: "case-smoke",
        ...draft,
        createdTs: "2026-08-10T10:00:00.000Z",
        updatedTs: "2026-08-10T10:00:00.000Z"
      };
      documents = [document];
      return Promise.resolve({ ok: true as const, value: { document } });
    }
    if (channel === "report:list") {
      return Promise.resolve({ ok: true as const, value: { reports: [] } });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/cases"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect((await screen.findAllByText("Fake client assessment")).length).toBeGreaterThan(0);
  await waitFor(() => {
    expect(invokeMock.mock.calls.filter(([channel]) => channel === "case:documents:list").length).toBeGreaterThanOrEqual(2);
  });
  await user.clear(screen.getByLabelText("Document name"));
  await user.type(screen.getByLabelText("Document name"), "Rules of engagement");
  await user.clear(screen.getByLabelText("Document scope"));
  await user.type(screen.getByLabelText("Document scope"), "example.com and 192.0.2.0/24 only");
  await user.clear(screen.getByLabelText("Start date"));
  await user.type(screen.getByLabelText("Start date"), "2026-08-20");
  await user.clear(screen.getByLabelText("End date"));
  await user.type(screen.getByLabelText("End date"), "2026-08-27");
  await user.type(screen.getByLabelText("Case document body"), "Fake data scope notes with report-ready language.");
  await user.click(screen.getByRole("button", { name: "Save document" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "case:document:upsert",
      expect.objectContaining({
        caseId: "case-smoke",
        name: "Rules of engagement",
        scope: "example.com and 192.0.2.0/24 only",
        dateFrom: "2026-08-20",
        dateTo: "2026-08-27"
      })
    );
  });
  expect(await screen.findByRole("button", { name: /Rules of engagement/ })).toBeInTheDocument();
});

it("tools route detects, launches, and adds fake catalog entries without real WSL", async () => {
  const user = userEvent.setup();
  let tools = [
    {
      id: "sherlock",
      name: "Sherlock",
      description: "Username lookup across public social sites.",
      installCommand: "pipx install sherlock-project",
      officialLink: "https://github.com/sherlock-project/sherlock",
      category: "username",
      tier: "passive",
      defaultArgs: ["sherlock"]
    }
  ];
  invokeMock.mockImplementation((channel: string, request?: unknown) => {
    if (channel === "tools:list") {
      return Promise.resolve({ ok: true as const, value: { tools } });
    }
    if (channel === "cases:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          cases: [
            {
              id: "case-smoke",
              title: "Fake client assessment",
              status: "open",
              createdTs: "2026-08-10T10:00:00.000Z",
              updatedTs: "2026-08-10T10:00:00.000Z",
              tags: []
            }
          ]
        }
      });
    }
    if (channel === "tools:detect") {
      return Promise.resolve({ ok: true as const, value: { installed: [{ toolId: "sherlock", installed: true }] } });
    }
    if (channel === "tools:launch") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: {
            id: "run-smoke",
            toolId: "sherlock",
            caseId: "case-smoke",
            target: "example.com",
            wslDistro: "Ubuntu",
            argv: ["sherlock", "example.com"],
            status: "succeeded",
            stdout: "fake sherlock output for example.com",
            stderr: "",
            startedTs: "2026-08-10T10:00:00.000Z",
            completedTs: "2026-08-10T10:00:01.000Z",
            authorizationId: null
          }
        }
      });
    }
    if (channel === "catalog:add") {
      const payload = request as Omit<typeof tools[number], "id">;
      const tool = { ...payload, id: "fake-tool" };
      tools = [...tools, tool];
      return Promise.resolve({ ok: true as const, value: { tool } });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/tools"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Sherlock" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Detect" }));
  expect(await screen.findByText("Detection complete")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Launch tool" }));
  expect(await screen.findByText(/fake sherlock output for example\.com/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Add or edit" }));
  await user.click(screen.getByRole("button", { name: "New catalog entry" }));
  await user.type(screen.getByLabelText("Name"), "Fake OSINT Tool");
  await user.type(screen.getByLabelText("Description"), "Fake test-only catalog entry.");
  await user.type(screen.getByLabelText("Install"), "echo install-fake-tool");
  await user.type(screen.getByLabelText("Link"), "https://example.test/fake-tool");
  await user.type(screen.getByLabelText("Argv prefix"), "fake-tool --target");
  await user.click(screen.getByRole("button", { name: "Add catalog entry" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      "catalog:add",
      expect.objectContaining({
        name: "Fake OSINT Tool",
        description: "Fake test-only catalog entry.",
        defaultArgs: ["fake-tool", "--target"]
      })
    );
  });
  expect(await screen.findByText("Catalog entry added")).toBeInTheDocument();
});

it("mobile, social, settings, and audit routes complete fake-data utility workflows", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string, request?: unknown) => {
    if (channel === "mobile:profiles") {
      return Promise.resolve({
        ok: true as const,
        value: {
          profiles: [
            {
              platform: "android",
              label: "Android",
              requiredTool: "adb",
              dataTypes: [
                {
                  id: "device-info",
                  label: "Device info",
                  sensitivity: "medium",
                  description: "Fake model and build data.",
                  commandPreview: ["adb", "shell", "getprop"]
                }
              ]
            }
          ]
        }
      });
    }
    if (channel === "mobile:detect") {
      return Promise.resolve({
        ok: true as const,
        value: {
          devices: [
            {
              id: "fake-phone",
              platform: "android",
              label: "Pixel Fake",
              dataTypes: ["device-info"]
            }
          ],
          unavailableTools: []
        }
      });
    }
    if (channel === "social:analyze") {
      return Promise.resolve({
        ok: true as const,
        value: {
          username: "jdoe",
          totalNetworks: 320,
          candidates: [
            {
              network: "Fakebook",
              url: "https://example.test/jdoe",
              fields: ["profile"],
              status: "candidate"
            },
            {
              network: "PhotoWall",
              url: "https://photos.example.test/jdoe",
              fields: ["images", "profile"],
              status: "candidate"
            }
          ],
          recommendedTools: ["whatsmyname"]
        }
      });
    }
    if (channel === "keys:list") {
      return Promise.resolve({ ok: true as const, value: { keys: [] } });
    }
    if (channel === "providers:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          providers: [
            {
              id: "openai",
              label: "OpenAI",
              requiresKey: true,
              keySource: "openai",
              defaultModel: "gpt-5.1",
              availableModels: ["gpt-5.1"]
            }
          ]
        }
      });
    }
    if (channel === "agents:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          agents: [
            {
              id: "osint-agent",
              name: "OSINT agent",
              provider: "openai",
              model: "gpt-5.1",
              promptPath: "planning/agent-prompts/osint-agent.md",
              approvalMode: "manual"
            }
          ]
        }
      });
    }
    if (channel === "keys:add") {
      return Promise.resolve({
        ok: true as const,
        value: { key: { source: "openai", createdTs: "2026-08-10T10:00:00.000Z", lastUsedTs: null } }
      });
    }
    if (channel === "settings:get") {
      const key = (request as { key?: string } | undefined)?.key;
      if (key === "tools.wslDistro") {
        return Promise.resolve({ ok: true as const, value: { key, value: "Ubuntu" } });
      }
      if (key === "agents.sharedMemoryScope") {
        return Promise.resolve({ ok: true as const, value: { key, value: "default" } });
      }
      return Promise.resolve({ ok: true as const, value: { key: "agents.cleanIdleStatuses", value: "false" } });
    }
    if (channel === "settings:set") {
      return Promise.resolve({ ok: true as const, value: { key: "tools.wslDistro", value: "Ubuntu" } });
    }
    if (channel === "audit:query") {
      return Promise.resolve({
        ok: true as const,
        value: {
          events: [
            {
              id: 1,
              ts: "2026-08-10T10:00:00.000Z",
              actor: "local-user",
              action: "fake.workflow",
              objectType: "smoke",
              objectId: "fake-object",
              sensitivity: "low",
              detail: { result: "ok" }
            }
          ]
        }
      });
    }
    return createDefaultInvokeMock()(channel);
  });

  const mobileRender = render(
    <MemoryRouter initialEntries={["/mobile"]}>
      <AppFrame />
    </MemoryRouter>
  );
  await user.click(await screen.findByRole("button", { name: "Detect mobile devices" }));
  // The device name now shows on both the handset lock screen and the device row.
  expect((await screen.findAllByText("Pixel Fake")).length).toBeGreaterThan(0);
  mobileRender.unmount();

  const socialRender = render(
    <MemoryRouter initialEntries={["/social-analyzer"]}>
      <AppFrame />
    </MemoryRouter>
  );
  await user.click(screen.getByRole("button", { name: "Analyze" }));
  expect(await screen.findByText("Fakebook")).toBeInTheDocument();
  expect(await screen.findByText("PhotoWall")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Search candidates"), "photo");
  await waitFor(() => {
    expect(screen.queryByText("Fakebook")).not.toBeInTheDocument();
  });
  expect(screen.getByText("PhotoWall")).toBeInTheDocument();
  await user.clear(screen.getByLabelText("Search candidates"));
  await user.type(screen.getByLabelText("Search candidates"), "not-a-real-candidate");
  expect(await screen.findByText("No candidates match this search.")).toBeInTheDocument();
  socialRender.unmount();

  const settingsRender = render(
    <MemoryRouter initialEntries={["/settings"]}>
      <AppFrame />
    </MemoryRouter>
  );
  await user.type(await screen.findByLabelText("Secret"), "sk-fake-test-key");
  await user.click(screen.getByRole("button", { name: "Store key" }));
  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("keys:add", { source: "openai", secret: "sk-fake-test-key" });
  });
  await user.click(screen.getByRole("button", { name: "Save runtime" }));
  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("settings:set", { key: "tools.wslDistro", value: "Ubuntu" });
  });
  settingsRender.unmount();

  render(
    <MemoryRouter initialEntries={["/audit-log"]}>
      <AppFrame />
    </MemoryRouter>
  );
  expect(await screen.findByText("fake.workflow")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(await screen.findByText("1 audit events")).toBeInTheDocument();
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

function minimalRun(runId: string, seed: { readonly type: string; readonly value: string }, value: string) {
  return {
    runId,
    seed,
    startedTs: "2026-08-10T10:00:00.000Z",
    completedTs: "2026-08-10T10:00:01.000Z",
    statuses: [{ sourceId: "phase11", label: "Phase 11", status: "returned", observationCount: 1 }],
    observations: [
      {
        id: `${runId}:obs`,
        runId,
        entity: value,
        type: "phase11",
        value,
        source: "phase11",
        confidence: 1,
        raw: {}
      }
    ],
    entities: [
      {
        entity: value,
        type: "phase11",
        value,
        sourceIds: ["phase11"],
        strength: 1,
        band: "single-source"
      }
    ],
    tree: {
      id: `run:${runId}`,
      label: `${seed.type}:${seed.value}`,
      kind: "root",
      saveable: true,
      children: []
    }
  };
}

function collectRendererFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectRendererFiles(fullPath);
    }
    return /\.(ts|tsx|css)$/.test(fullPath) ? [fullPath] : [];
  });
}
