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

    expect(screen.getByRole("heading", { name: route.label })).toBeInTheDocument();
    if (route.id === "dashboard") {
      expect(screen.getByRole("button", { name: "Add watch" })).toBeInTheDocument();
    } else if (route.id === "settings") {
      expect(screen.getByRole("heading", { name: "API keys" })).toBeInTheDocument();
    } else if (route.id === "search") {
      expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    } else if (route.id === "cases") {
      expect(screen.getByRole("button", { name: "Create case" })).toBeInTheDocument();
    } else if (route.id === "reports") {
      expect(screen.getByRole("button", { name: "Generate report" })).toBeInTheDocument();
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
  expect(await screen.findByText("Sent to OSINT agent for Acme review")).toBeInTheDocument();
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
  expect(screen.getByText("dork / google-dork")).toBeInTheDocument();
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

it("search route runs image and username depth so Phase 11 pivots enter the correlation tree", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Browse image" }));
  await user.click(screen.getByRole("button", { name: "Search image" }));
  await user.click(screen.getByRole("button", { name: "Username sweep" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("search:image", {
      imagePath: "C:\\images\\picked.png",
      caseId: undefined
    });
  });
  expect(invokeMock).toHaveBeenCalledWith("search:usernameSweep", {
    username: "jdoe",
    wslDistro: "Ubuntu",
    caseId: undefined,
    sendToAgent: true
  });
  expect(await screen.findByText("Username sweep complete; saved:2")).toBeInTheDocument();
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

  expect(await screen.findByRole("button", { name: /Reconnaissance/ })).toBeInTheDocument();
  expect(document.querySelectorAll(".methodology-connector")).toHaveLength(5);
  await user.click(screen.getByRole("button", { name: /Exploitation readiness/ }));
  expect(screen.getByText("Authorization")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Export coverage spreadsheet" }));

  const invokedChannels = invokeMock.mock.calls.map(([channel]) => channel);
  expect(invokedChannels.every((channel) => ["methodology:list", "methodology:export"].includes(channel))).toBe(true);
  expect(invokedChannels).not.toEqual(expect.arrayContaining(["tools:launch", "scan:run", "analyzer:pcap:import"]));
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
