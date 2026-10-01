/**
 * Renderer shell tests pin navigation, token use, and local persistence before
 * real investigative surfaces arrive. If stubs cannot route and keep shell
 * state now, later feature tests will hide foundation regressions.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { AppFrame } from "../../src/renderer/App";
import { navigationRoutes } from "../../src/renderer/navigation";
import type { Result } from "../../src/shared/result";
import type { ScanOutputEvent } from "../../src/shared/schemas/scans";

type RendererInvokeMock = (channel: string, request?: unknown) => Promise<Result<unknown>>;
type ScanEventMock = (channel: "scan:output", handler: (event: ScanOutputEvent) => void) => () => void;

function createDefaultInvokeMock() {
  return vi.fn<RendererInvokeMock>((channel, request) => {
    if (channel === "keys:list") {
      return Promise.resolve({ ok: true as const, value: { keys: [] } });
    }
    if (channel === "providers:list") {
      return Promise.resolve({ ok: true as const, value: { providers: [] } });
    }
    if (channel === "apiDiagnostics:list") {
      return Promise.resolve({
        ok: true as const,
        value: {
          apis: [
            {
              source: "openai",
              label: "OpenAI",
              category: "AI provider",
              probe: "live",
              requiresKey: true,
              configured: false,
              status: "skipped",
              message: "Ready to test",
              latencyMs: null,
              checkedTs: "2026-08-10T10:00:00.000Z"
            }
          ]
        }
      });
    }
    if (channel === "apiDiagnostics:test") {
      return Promise.resolve({
        ok: true as const,
        value: {
          results: [
            {
              source: "openai",
              label: "OpenAI",
              category: "AI provider",
              probe: "live",
              requiresKey: true,
              configured: true,
              status: "pass",
              message: "OpenAI responded to the live health check",
              latencyMs: 42,
              checkedTs: "2026-08-10T10:00:01.000Z"
            }
          ]
        }
      });
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
    if (channel === "entityGraph:list") {
      return Promise.resolve({ ok: true as const, value: { entities: [], identifiers: [], assertions: [], relationships: [], candidates: [], truncated: false } });
    }
    if (channel === "qualityReview:list") {
      return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: null, sampleHistory: [], sampleSources: [] } });
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
      return Promise.resolve({
        ok: true as const,
        value: {
          devices: [
            {
              id: "ios-one",
              platform: "ios",
              label: "Bob's iPhone / iPhone16,2 (ios-one)",
              connected: true,
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
          ],
          unavailableTools: []
        }
      });
    }
    if (channel === "mobile:collect") {
      return Promise.resolve({
        ok: true as const,
        value: {
          deviceId: "ios-one",
          platform: "ios",
          completedTs: "2026-08-10T10:00:02.000Z",
          results: [
            {
              dataTypeId: "ios-device-info",
              label: "Device info",
              sensitivity: "medium",
              status: "passed",
              commandPreview: ["ideviceinfo"],
              stdout: "ProductType: iPhone16,2\nProductVersion: 18.6",
              stderr: "",
              summary: "Device info: captured 2 output lines.",
              startedTs: "2026-08-10T10:00:01.000Z",
              completedTs: "2026-08-10T10:00:02.000Z"
            },
            {
              dataTypeId: "ios-syslog",
              label: "Live syslog",
              sensitivity: "sensitive",
              status: "passed",
              commandPreview: ["idevicesyslog"],
              stdout: "## syslog sample\nAug 15 20:23:23.900727 kernel[0] <Notice>: vm: segments queued for swapout\nAug 15 20:23:23.928594 locationd[70983] <Debug>: skipping invalidated device\nAug 15 20:23:24.007528 InCallService[22286] <Info>: observer relay",
              stderr: "",
              summary: "Live syslog: captured 4 output lines.",
              startedTs: "2026-08-10T10:00:01.000Z",
              completedTs: "2026-08-10T10:00:03.000Z"
            }
          ]
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
      const key = (request as { key?: string } | undefined)?.key ?? "agents.cleanIdleStatuses";
      return Promise.resolve({ ok: true as const, value: { key, value: key === "agents.cloudContextSharing" ? "true" : "false" } });
    }
    if (channel === "settings:set") {
      const key = (request as { key?: string } | undefined)?.key ?? "agents.cleanIdleStatuses";
      const value = (request as { value?: string } | undefined)?.value ?? "true";
      return Promise.resolve({ ok: true as const, value: { key, value } });
    }
    if (channel === "irsEoBmf:status") {
      return Promise.resolve({ ok: true as const, value: { status: { installed: false, sha256: null, sizeBytes: null, recordCount: 0, fetchedTs: null } } });
    }
    if (channel === "irsEoBmf:install") {
      return Promise.resolve({ ok: true as const, value: { status: { installed: false, sha256: null, sizeBytes: null, recordCount: 0, fetchedTs: null }, cancelled: true } });
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
        "entityGraph:list",
        "entityGraph:saveObservation",
        "audit:query",
        "mobile:profiles",
        "mobile:detect",
        "mobile:collect",
        "social:analyze",
        "methodology:list",
        "methodology:export",
        "keys:list",
        "providers:list",
        "agents:list",
        "apiDiagnostics:list",
        "apiDiagnostics:test",
        "agent:states",
        "agent:runs",
        "agent:memory:list",
        "agent:playbooks",
        "agent:run",
        "settings:get",
        "settings:set",
        "irsEoBmf:status",
        "irsEoBmf:install",
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
      expect(await screen.findByText("Not installed · searches will not contact or query the IRS")).toBeInTheDocument();
      const installIrsIndex = screen.getByRole("button", { name: "Install Illinois index" });
      await userEvent.click(installIrsIndex);
      expect(invokeMock).toHaveBeenCalledWith("irsEoBmf:install", {});
      const sharing = await screen.findByRole("checkbox", { name: "Always send mission brief and shared memory to the selected cloud model" });
      await waitFor(() => expect(sharing).toBeEnabled());
      expect(sharing).toBeChecked();
      await userEvent.click(sharing);
      expect(invokeMock).toHaveBeenCalledWith("settings:set", { key: "agents.cloudContextSharing", value: "false" });
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
      expect(screen.getByRole("button", { name: "Detect phone" })).toBeInTheDocument();
    } else if (route.id === "social-analyzer") {
      expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    } else if (route.id === "methodology-map") {
      expect(screen.getByRole("button", { name: "Export coverage spreadsheet" })).toBeInTheDocument();
    } else if (route.id === "audit-log") {
      expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
    } else if (route.id === "evidence-graph") {
      expect(screen.getByRole("heading", { name: "Evidence graph" })).toBeInTheDocument();
      expect(await screen.findByText(/No durable entities yet/)).toBeInTheDocument();
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

it("mobile route detects a trusted phone and collects live metadata snapshots", async () => {
  render(
    <MemoryRouter initialEntries={["/mobile"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect((await screen.findAllByText("Bob's iPhone / iPhone16,2 (ios-one)")).length).toBeGreaterThan(0);
  expect(screen.getByRole("navigation", { name: "Mobile sections" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Detect phone" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Toolbox" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Verification Report/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Smart Flash/i })).toBeDisabled();
  expect(screen.queryByRole("heading", { name: "Android" })).not.toBeInTheDocument();

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("mobile:collect", {
      deviceId: "ios-one",
      platform: "ios",
      dataTypeIds: undefined
    });
  });
  expect(await screen.findByText("Device info: captured 2 output lines.")).toBeInTheDocument();
  expect(screen.getByText("ProductVersion")).toBeInTheDocument();
  expect(screen.getAllByText("18.6").length).toBeGreaterThan(0);
  expect(await screen.findByRole("table", { name: "syslog sample log events" })).toBeInTheDocument();
  expect(screen.getByText("kernel[0]")).toBeInTheDocument();
  expect(screen.getByText("vm: segments queued for swapout")).toBeInTheDocument();
});

it("social analyzer renders a dot graph and lets candidate dots focus the review queue", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/social-analyzer"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Analyze" }));

  expect(await screen.findByRole("heading", { name: "Candidate graph" })).toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Select Example social candidate" }));

  expect(screen.getByPlaceholderText("Filter network or URL")).toHaveValue("Example social");
  expect(screen.getByText("1 dots")).toBeInTheDocument();
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
    if (channel === "entityGraph:saveObservation") {
      return Promise.resolve({ ok: true as const, value: { entity: { id: "entity-one", type: "domain", label: "Example domain", createdTs: "2026-10-01T00:00:00.000Z" } } });
    }

    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Search" }));
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

  await user.click(screen.getByText("Save as entity"));
  await user.type(screen.getByPlaceholderText("example.com"), "Example domain");
  await user.click(screen.getByRole("button", { name: "Save cited evidence" }));
  await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("entityGraph:saveObservation", {
    observationId: "obs-one", type: "unknown", label: "Example domain"
  }));
  expect(await screen.findByText("Saved Example domain to the evidence graph with its source record")).toBeInTheDocument();
});

it("browses all source records while hiding raw payloads and rejecting non-HTTP record links", async () => {
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "entityGraph:list") {
      return Promise.resolve({ ok: true as const, value: {
        entities: [], identifiers: [], assertions: [{
          id: "source-one", sourceId: "fixture", recordUrl: "javascript:alert(1)", assertedType: "domain", assertedValue: "example.com",
          rawSnapshot: { private: "should not display" }, fetchedTs: "2026-10-01T00:00:00.000Z"
        }], relationships: [], candidates: [], truncated: false
      } });
    }
    if (channel === "qualityReview:list") {
      return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [{ sourceId: "fixture", label: "Fixture", attempts: 2, returned: 2, failed: 0, timeouts: 0, cancelled: 0, transportFailures: 0, httpFailures: 0, responseLimitFailures: 0, invalidJsonFailures: 0, invalidResponseFailures: 0, unclassifiedFailures: 0, emptyResponses: 1, observations: 2, reviewedRecords: 1, sourceRecordCount: 1, reviewEvents: 3, reviewedVerdicts: { confirmed: 1, incorrect: 0, duplicate: 0, missing: 0, error: 0, uncertain: 1 } }], sample: null, sampleHistory: [], sampleSources: [{ sourceId: "fixture", eligibleCount: 1 }] } });
    }
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
  render(<MemoryRouter initialEntries={["/evidence-graph"]}><AppFrame /></MemoryRouter>);

  expect(await screen.findByRole("button", { name: /domain: example.com/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open source record" })).not.toBeInTheDocument();
  expect(screen.queryByText("should not display")).not.toBeInTheDocument();
  expect(await screen.findByText("confirmed: 1 · uncertain: 1")).toBeInTheDocument();
  expect(screen.getByText("unique records per verdict; labels may overlap")).toBeInTheDocument();
});

it("draws a local probability sample and links the analyst verdict to its sampled member", async () => {
  const user = userEvent.setup();
  const item = { id: "sample-item-1", targetId: "source-one", ordinal: 1, assertedType: "domain", assertedValue: "example.com" };
  const secondItem = { id: "sample-item-2", targetId: "source-two", ordinal: 2, assertedType: "domain", assertedValue: "other.example" };
  const sample = { id: "sample-one", sourceId: "fixture", frameSize: 4, sampleSize: 2, selectionMethod: "simple-random-without-replacement" as const, createdTs: "2026-10-01T00:00:00Z", reviewedCount: 0, items: [item, secondItem] };
  const completedSample = { ...sample, reviewedCount: 1, items: [{ ...item, verdict: "incorrect" as const }, secondItem] };
  let currentSample: typeof sample | null = null;
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "entityGraph:list") return Promise.resolve({ ok: true as const, value: { entities: [], identifiers: [], assertions: [{ id: item.targetId, sourceId: "fixture", assertedType: item.assertedType, assertedValue: item.assertedValue, fetchedTs: "2026-10-01T00:00:00Z" }], relationships: [], candidates: [], truncated: false } });
    if (channel === "qualityReview:list") return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: currentSample, sampleHistory: currentSample ? [{ id: currentSample.id, sourceId: currentSample.sourceId, frameSize: currentSample.frameSize, sampleSize: currentSample.sampleSize, selectionMethod: currentSample.selectionMethod, createdTs: currentSample.createdTs, reviewedCount: currentSample.reviewedCount }] : [], sampleSources: [{ sourceId: "fixture", eligibleCount: 4 }] } });
    if (channel === "qualityReview:sample") { currentSample = sample; return Promise.resolve({ ok: true as const, value: { sample } }); }
    if (channel === "qualityReview:create") { currentSample = completedSample; return Promise.resolve({ ok: true as const, value: { review: { id: "review-one", kind: "source_record", verdict: "incorrect", targetId: item.targetId, note: "", createdTs: "2026-10-01T00:01:00Z" }, metrics: [], sourceOutcomes: [], sample: completedSample, sampleHistory: [{ id: completedSample.id, sourceId: completedSample.sourceId, frameSize: completedSample.frameSize, sampleSize: completedSample.sampleSize, selectionMethod: completedSample.selectionMethod, createdTs: completedSample.createdTs, reviewedCount: completedSample.reviewedCount }], sampleSources: [{ sourceId: "fixture", eligibleCount: 4 }] } }); }
    if (channel === "qualityReview:sampleGet") return Promise.resolve({ ok: true as const, value: { sample: currentSample } });
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
  render(<MemoryRouter initialEntries={["/evidence-graph"]}><AppFrame /></MemoryRouter>);

  const drawButton = await screen.findByRole("button", { name: "Draw random sample" });
  await waitFor(() => expect(drawButton).toBeEnabled());
  expect(screen.getByRole("option", { name: "fixture · 4 saved" })).toBeInTheDocument();
  await user.click(drawButton);
  expect(await screen.findByText("Frozen frame: 4 eligible records · method: simple random without replacement · drawn 2026-10-01T00:00:00Z")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Review this sampled record" })[0]);
  await user.selectOptions(screen.getByLabelText("Assessment"), "incorrect");
  await user.click(screen.getByRole("button", { name: "Save review" }));
  await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("qualityReview:create", expect.objectContaining({ targetId: item.targetId, sampleItemId: item.id, verdict: "incorrect" })));
  expect(await screen.findByText("Reviewer-assessed distribution among 1 reviewed sampled record: incorrect: 1/1 (100%). This describes only reviewed members of this draw, not source accuracy.")).toBeInTheDocument();
});

it("loads an explicitly selected historical review sample", async () => {
  const user = userEvent.setup();
  const oldSample = { id: "sample-old", sourceId: "fixture", frameSize: 3, sampleSize: 1, selectionMethod: "simple-random-without-replacement" as const, createdTs: "2026-09-30T12:00:00Z", reviewedCount: 1, items: [{ id: "old-item", targetId: "old-record", ordinal: 1, assertedType: "domain", assertedValue: "old.example", verdict: "confirmed" as const }] };
  const latestSample = { ...oldSample, id: "sample-latest", createdTs: "2026-10-01T12:00:00Z", items: [{ ...oldSample.items[0], id: "latest-item", targetId: "latest-record", assertedValue: "latest.example" }] };
  invokeMock.mockImplementation((channel: string, payload?: unknown) => {
    if (channel === "entityGraph:list") return Promise.resolve({ ok: true as const, value: { entities: [], identifiers: [], assertions: [], relationships: [], candidates: [], truncated: false } });
    if (channel === "qualityReview:list") return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: latestSample, sampleHistory: [latestSample, oldSample].map(({ id, sourceId, frameSize, sampleSize, selectionMethod, createdTs, reviewedCount }) => ({ id, sourceId, frameSize, sampleSize, selectionMethod, createdTs, reviewedCount })), sampleSources: [] } });
    if (channel === "qualityReview:sampleGet") return Promise.resolve({ ok: true as const, value: { sample: (payload as { id?: string } | undefined)?.id === oldSample.id ? oldSample : latestSample } });
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
  render(<MemoryRouter initialEntries={["/evidence-graph"]}><AppFrame /></MemoryRouter>);

  expect(await screen.findByText("1. domain: latest.example")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Saved review sample"), "sample-old");
  expect(await screen.findByText("1. domain: old.example")).toBeInTheDocument();
  expect(invokeMock).toHaveBeenCalledWith("qualityReview:sampleGet", { id: "sample-old" });
});

it("does not let an older sample fetch overwrite a later selection when responses resolve out of order", async () => {
  const user = userEvent.setup();
  const makeSample = (id: string, value: string) => ({ id, sourceId: "fixture", frameSize: 3, sampleSize: 1, selectionMethod: "simple-random-without-replacement" as const, createdTs: "2026-10-01T12:00:00Z", reviewedCount: 1, items: [{ id: `${id}-item`, targetId: `${id}-record`, ordinal: 1, assertedType: "domain", assertedValue: value, verdict: "confirmed" as const }] });
  const sampleA = makeSample("sample-a", "a.example");
  const sampleB = makeSample("sample-b", "b.example");
  const latestSample = makeSample("sample-latest", "latest.example");
  interface SampleGetResult { ok: true; value: { sample: typeof sampleA } }
  let resolveA: (value: SampleGetResult) => void = () => {};
  let resolveB: (value: SampleGetResult) => void = () => {};
  invokeMock.mockImplementation((channel: string, payload?: unknown) => {
    if (channel === "entityGraph:list") return Promise.resolve({ ok: true as const, value: { entities: [], identifiers: [], assertions: [], relationships: [], candidates: [], truncated: false } });
    if (channel === "qualityReview:list") return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: latestSample, sampleHistory: [latestSample, sampleA, sampleB].map(({ id, sourceId, frameSize, sampleSize, selectionMethod, createdTs, reviewedCount }) => ({ id, sourceId, frameSize, sampleSize, selectionMethod, createdTs, reviewedCount })), sampleSources: [] } });
    if (channel === "qualityReview:sampleGet") {
      const id = (payload as { id?: string } | undefined)?.id;
      if (id === sampleA.id) return new Promise<SampleGetResult>((resolve) => { resolveA = resolve; });
      if (id === sampleB.id) return new Promise<SampleGetResult>((resolve) => { resolveB = resolve; });
      return Promise.resolve({ ok: true as const, value: { sample: latestSample } });
    }
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
  render(<MemoryRouter initialEntries={["/evidence-graph"]}><AppFrame /></MemoryRouter>);

  expect(await screen.findByText("1. domain: latest.example")).toBeInTheDocument();
  const history = screen.getByLabelText("Saved review sample");
  await user.selectOptions(history, sampleA.id);
  await user.selectOptions(history, sampleB.id);
  await waitFor(() => expect(resolveA).toBeDefined());
  await waitFor(() => expect(resolveB).toBeDefined());
  act(() => { resolveB({ ok: true, value: { sample: sampleB } }); });
  expect(await screen.findByText("1. domain: b.example")).toBeInTheDocument();
  act(() => { resolveA({ ok: true, value: { sample: sampleA } }); });
  expect(screen.getByText("1. domain: b.example")).toBeInTheDocument();
  expect(screen.queryByText("1. domain: a.example")).not.toBeInTheDocument();
});

it("invalidates a pending historical read when refresh removes that sample", async () => {
  const user = userEvent.setup();
  const savedSample = { id: "sample-old", sourceId: "fixture", frameSize: 2, sampleSize: 1, selectionMethod: "simple-random-without-replacement" as const, createdTs: "2026-09-30T12:00:00Z", reviewedCount: 0, items: [{ id: "old-item", targetId: "old-record", ordinal: 1, assertedType: "domain", assertedValue: "old.example" }] };
  const latestSample = { ...savedSample, id: "sample-latest", items: [{ ...savedSample.items[0], id: "latest-item", assertedValue: "latest.example" }] };
  let listCalls = 0;
  interface SavedResult { ok: true; value: { sample: typeof savedSample } }
  let resolveSaved: (value: SavedResult) => void = () => {};
  invokeMock.mockImplementation((channel: string, payload?: unknown) => {
    if (channel === "entityGraph:list") return Promise.resolve({ ok: true as const, value: { entities: [], identifiers: [], assertions: [], relationships: [], candidates: [], truncated: false } });
    if (channel === "qualityReview:list") {
      listCalls++;
      if (listCalls === 1) return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: latestSample, sampleHistory: [latestSample, savedSample].map(({ id, sourceId, frameSize, sampleSize, selectionMethod, createdTs, reviewedCount }) => ({ id, sourceId, frameSize, sampleSize, selectionMethod, createdTs, reviewedCount })), sampleSources: [] } });
      return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: null, sampleHistory: [], sampleSources: [] } });
    }
    if (channel === "qualityReview:sampleGet" && (payload as { id?: string } | undefined)?.id === savedSample.id) {
      return new Promise<SavedResult>((resolve) => { resolveSaved = resolve; });
    }
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
  render(<MemoryRouter initialEntries={["/evidence-graph"]}><AppFrame /></MemoryRouter>);

  expect(await screen.findByText("1. domain: latest.example")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Saved review sample"), savedSample.id);
  await waitFor(() => expect(resolveSaved).toBeDefined());
  await user.click(screen.getByRole("button", { name: "Refresh evidence graph" }));
  await waitFor(() => expect(screen.queryByLabelText("Saved review sample")).not.toBeInTheDocument());
  act(() => { resolveSaved({ ok: true, value: { sample: savedSample } }); });
  expect(screen.queryByText("1. domain: old.example")).not.toBeInTheDocument();
});

it("does not imply there are no saved runs when a completed run has no returned or failed outcomes", async () => {
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "entityGraph:list") return Promise.resolve({ ok: true as const, value: { entities: [], identifiers: [], assertions: [], relationships: [], candidates: [], truncated: false } });
    if (channel === "qualityReview:list") return Promise.resolve({ ok: true as const, value: { reviews: [], metrics: [], parserTargets: [], coverageScopes: [], sourceOutcomes: [], sample: null, sampleHistory: [], sampleSources: [] } });
    return Promise.resolve({ ok: true as const, value: { pong: true, nonce: "test", audited: true } });
  });
  render(<MemoryRouter initialEntries={["/evidence-graph"]}><AppFrame /></MemoryRouter>);

  expect(await screen.findByText("No returned or failed source outcomes to summarize yet.")).toBeInTheDocument();
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
      return Promise.resolve({
        ok: true as const,
        value: {
          run: { id: "agent-run-one" },
          finding: {
            id: "finding-one",
            runId: "agent-run-one",
            agentId: "osint-agent",
            caseId: "case-one",
            title: "Registration data points to the seed",
            summary: "The returned record names the seed domain; this alone does not establish who operates it.",
            sources: ["obs-one"],
            confidence: 1,
            savedItemId: "item-one"
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
  const assessment = screen.getByRole("region", { name: "AI assessment" });
  expect(within(assessment).getByText("Interpretation")).toBeInTheDocument();
  expect(within(assessment).getByText("Registration data points to the seed")).toBeInTheDocument();
  expect(within(assessment).getByText("Confidence as reported · 1")).toBeInTheDocument();
  expect(within(assessment).getByRole("button", { name: "obs-one" })).toBeInTheDocument();
});

it("search route cross-references matching observations across sources before showing evidence", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "search:run") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: {
            runId: "run-cross",
            seed: { type: "domain", value: "example.com" },
            startedTs: "2026-08-10T10:00:00.000Z",
            completedTs: "2026-08-10T10:00:01.000Z",
            statuses: [
              { sourceId: "rdap", label: "RDAP", status: "returned", observationCount: 1 },
              { sourceId: "crtsh", label: "crt.sh", status: "returned", observationCount: 1 },
              { sourceId: "dns-doh", label: "DNS over HTTPS", status: "returned", observationCount: 1 }
            ],
            observations: [
              {
                id: "obs-rdap",
                runId: "run-cross",
                entity: "example.com",
                type: "domain",
                value: "example.com",
                source: "rdap",
                upstreamFamilyId: "rdap-registry",
                confidence: 2,
                raw: { sourceUrl: "https://rdap.example.test/example.com" }
              },
              {
                id: "obs-crtsh",
                runId: "run-cross",
                entity: "example.com",
                type: "domain",
                value: "example.com",
                source: "crtsh",
                upstreamFamilyId: "crt-sh",
                confidence: 2,
                raw: { sourceUrl: "https://crt.sh/?q=example.com" }
              },
              {
                id: "obs-mail",
                runId: "run-cross",
                entity: "example.com",
                type: "hostname",
                value: "mail.example.com",
                source: "dns-doh",
                upstreamFamilyId: "cloudflare-doh",
                confidence: 1,
                raw: {}
              }
            ],
            entities: [
              {
                entity: "example.com",
                type: "domain",
                value: "example.com",
                sourceIds: ["crtsh", "rdap"],
                upstreamFamilyIds: ["crt-sh", "rdap-registry"],
                strength: 2,
                band: "likely"
              },
              {
                entity: "example.com",
                type: "hostname",
                value: "mail.example.com",
                sourceIds: ["dns-doh"],
                strength: 1,
                band: "single-source"
              }
            ],
            tree: {
              id: "root",
              label: "domain:example.com",
              kind: "root",
              saveable: true,
              children: []
            }
          }
        }
      });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/search"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(screen.getByRole("button", { name: "Search" }));

  expect(await screen.findByRole("heading", { name: "Evidence", level: 2 })).toBeInTheDocument();
  const list = screen.getByRole("list", { name: "Evidence facts" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("2 declared upstream families returned this exact domain; integrations: crtsh, rdap. Family declarations are recorded for comparison, not independently audited.")).toBeInTheDocument();
  expect(within(list).getByText("Exact match · 2 upstream families")).toBeInTheDocument();
  await user.click(within(list).getByRole("button", { name: /mail\.example\.com/i }));
  expect(screen.getByText("Only one declared upstream family returned this fact. Treat it as a lead until another independent family agrees.")).toBeInTheDocument();
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
            argv: ["nmap", "-oX", "-", "192.168.1.0/24"],
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

it("network scan topology previews live nmap XML hosts before the scan process exits", async () => {
  const user = userEvent.setup();
  let scanHandler: ((event: ScanOutputEvent) => void) | null = null;
  let resolveScan: ((value: Result<unknown>) => void) | null = null;
  const liveXml = `<nmaprun><host><status state="up" reason="arp-response"/><address addr="10.0.0.1" addrtype="ipv4"/><address addr="70:13:01:CB:A7:4F" addrtype="mac" vendor="Vantiva - Connected Home"/><hostnames></hostnames></host></nmaprun>`;
  const reacherMock = window.reacher as typeof window.reacher & { readonly onScanEvent: ReturnType<typeof vi.fn<ScanEventMock>> };

  reacherMock.onScanEvent.mockImplementation((_channel, handler) => {
    scanHandler = handler;
    return vi.fn();
  });
  invokeMock.mockImplementation((channel: string) => {
    if (channel === "scan:run") {
      return new Promise((resolve) => {
        resolveScan = resolve;
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
  act(() => {
    scanHandler?.({ scanId: "scan-live", stream: "stdout", chunk: liveXml });
  });

  expect((await screen.findAllByText("10.0.0.1")).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("hosts:1 open_ports:0 status:running-scan")).toBeInTheDocument();

  act(() => {
    resolveScan?.({
      ok: true as const,
      value: {
        scan: {
          id: "scan-live",
          target: "10.0.0.0/24",
          wslDistro: "Local Windows nmap",
          status: "succeeded",
          scanType: "quick-top-100",
          timing: "T3",
          argv: ["nmap", "-oX", "-", "--top-ports", "100", "10.0.0.0/24"],
          stdout: liveXml,
          stderr: "",
          startedTs: "2026-08-10T10:00:00.000Z",
          completedTs: "2026-08-10T10:00:01.000Z",
          authorizationId: null
        },
        hosts: [],
        topology: { scanId: "scan-live", nodes: [{ id: "target", label: "10.0.0.0/24", x: 0, y: 0, ring: 0 }], edges: [] }
      }
    });
  });
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

it("tools route launches a fake CLI run and renders captured output with run context", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string) => {
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
    if (channel === "tools:detect") {
      return Promise.resolve({ ok: true as const, value: { installed: [{ toolId: "sherlock", installed: true }] } });
    }
    if (channel === "tools:launch") {
      return Promise.resolve({
        ok: true as const,
        value: {
          run: {
            id: "tool-run-one",
            toolId: "sherlock",
            caseId: null,
            target: "example.com",
            wslDistro: "Ubuntu",
            argv: ["wsl.exe", "-d", "Ubuntu", "--", "sherlock", "example.com"],
            status: "succeeded",
            stdout: "[+] GitHub: https://github.com/example\n[+] Reddit: https://reddit.com/user/example",
            stderr: "",
            startedTs: "2026-08-10T10:00:00.000Z",
            completedTs: "2026-08-10T10:00:01.000Z",
            authorizationId: null
          }
        }
      });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/tools"]}>
      <AppFrame />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: "Detect tools" }));
  expect(await screen.findByText(/Detection complete/)).toBeInTheDocument();
  expect(screen.getByText(/passive \/ username \/ installed/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Launch tool" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("tools:launch", {
      toolId: "sherlock",
      target: "example.com",
      caseId: undefined,
      wslDistro: "Ubuntu"
    });
  });
  expect(await screen.findByText(/\[\+\] GitHub: https:\/\/github.com\/example/)).toBeInTheDocument();
  expect(screen.getByText("run:tool-run-one status:succeeded target:example.com")).toBeInTheDocument();
});

it("audit log renders fake sensitive events and sends filter values through IPC", async () => {
  const user = userEvent.setup();
  invokeMock.mockImplementation((channel: string, request?: unknown) => {
    if (channel === "audit:query") {
      return Promise.resolve({
        ok: true as const,
        value: {
          events: [
            {
              id: 1,
              ts: "2026-08-10T10:00:00.000Z",
              actor: "local-user",
              action: "mobile.collect",
              objectType: "mobile-device",
              objectId: "ios-one",
              sensitivity: "sensitive",
              detail: {
                platform: "ios",
                sections: 8,
                status: "passed",
                requestEcho: request
              }
            },
            {
              id: 2,
              ts: "2026-08-10T10:01:00.000Z",
              actor: "local-user",
              action: "scan.run",
              objectType: "network-scan",
              objectId: "scan-one",
              sensitivity: "medium",
              detail: { target: "10.0.0.0/24", hosts: 3 }
            }
          ]
        }
      });
    }
    return createDefaultInvokeMock()(channel);
  });

  render(
    <MemoryRouter initialEntries={["/audit-log"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect(await screen.findByText("mobile.collect")).toBeInTheDocument();
  expect(screen.getByText("mobile-device / ios-one / local-user")).toBeInTheDocument();
  expect(screen.getByText("sections")).toBeInTheDocument();
  expect(screen.getByText("8")).toBeInTheDocument();
  expect(screen.getAllByText("scan.run").length).toBeGreaterThanOrEqual(2);

  await user.clear(screen.getByLabelText("Action"));
  await user.type(screen.getByLabelText("Action"), "scan.run");
  await user.selectOptions(screen.getByLabelText("Sensitivity"), "medium");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenLastCalledWith(
      "audit:query",
      expect.objectContaining({ action: "scan.run", sensitivity: "medium", limit: 100 })
    );
  });
});

it("settings route tests all fake API diagnostics and shows per-API status without leaking secrets", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <AppFrame />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "API diagnostics" })).toBeInTheDocument();
  expect(await screen.findByText("OpenAI")).toBeInTheDocument();
  expect(await screen.findByText("Ready to test")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Test all APIs" }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith("apiDiagnostics:test", {});
  });
  expect(await screen.findByText("OpenAI responded to the live health check")).toBeInTheDocument();
  expect(screen.getByText("API diagnostics complete: 1/1 passed")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/sk-[A-Za-z0-9]/);
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
