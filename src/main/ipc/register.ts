/**
 * Handler registration joins the metadata registry to concrete main-process
 * functions in one place. If channels were registered ad hoc, Object.keys(IPC)
 * in preload could expose a channel that main never validates or handles.
 */
import electron from "electron";
import type { MessageBoxOptions } from "electron";
import path from "node:path";
import type { ReacherDatabase } from "../../db/database.js";
import { AgentsRepository } from "../../db/repositories/agents-repository.js";
import { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import { AnalyzersRepository } from "../../db/repositories/analyzers-repository.js";
import { AuditRepository } from "../../db/repositories/audit-repository.js";
import { CasesRepository } from "../../db/repositories/cases-repository.js";
import { DashboardRepository } from "../../db/repositories/dashboard-repository.js";
import { ImageSearchRepository } from "../../db/repositories/image-search-repository.js";
import { MobileRepository } from "../../db/repositories/mobile-repository.js";
import { MonitoringRepository } from "../../db/repositories/monitoring-repository.js";
import { ReportsRepository } from "../../db/repositories/reports-repository.js";
import { ScansRepository } from "../../db/repositories/scans-repository.js";
import { SettingsRepository } from "../../db/repositories/settings-repository.js";
import { VaultRepository } from "../../db/repositories/vault-repository.js";
import { SearchRepository } from "../../db/repositories/search-repository.js";
import { ToolsRepository } from "../../db/repositories/tools-repository.js";
import type { VaultCrypto } from "../security/vault-crypto.js";
import { searchConnectors } from "../search/connectors/index.js";
import { scrapeGraphConnector } from "../search/connectors/scrapegraph-connector.js";
import { createSherlockConnector } from "../search/connectors/sherlock-connector.js";
import type { SourceConnector } from "../search/source-connector.js";
import { IPC, type IpcChannel, type IpcParsedRequest, type IpcResponse } from "../../shared/ipc.js";
import { AgentRuntimeService } from "../agents/agent-runtime-service.js";
import { AnalyzersService } from "../analyzers/analyzers-service.js";
import { ArchitectAgentService } from "../agents/architect-agent-service.js";
import type { AgentRuntimeEvent } from "../../shared/schemas/agents-runtime.js";
import type { ScanOutputEvent } from "../../shared/schemas/scans.js";
import type { ToolOutputEvent } from "../../shared/schemas/tools.js";
import { createArchitectAgentHandlers } from "./handlers/architect-agent-handlers.js";
import { createAgentRuntimeHandlers } from "./handlers/agent-runtime-handlers.js";
import { createAgentsHandlers } from "./handlers/agents-handlers.js";
import { createAnalyzersHandlers } from "./handlers/analyzers-handlers.js";
import { createAuditHandlers } from "./handlers/audit-handlers.js";
import { createCasesHandlers } from "./handlers/cases-handlers.js";
import { createDashboardHandlers } from "./handlers/dashboard-handlers.js";
import { createKeysHandlers } from "./handlers/keys-handlers.js";
import { createImageUsernameHandlers } from "./handlers/image-username-handlers.js";
import { createMethodologyHandlers } from "./handlers/methodology-handlers.js";
import { createMonitoringHandlers } from "./handlers/monitoring-handlers.js";
import { createMobileHandlers } from "./handlers/mobile-handlers.js";
import { createProvidersHandlers } from "./handlers/providers-handlers.js";
import { createReportsHandlers } from "./handlers/reports-handlers.js";
import { createScanHandlers } from "./handlers/scan-handlers.js";
import { createSearchHandlers } from "./handlers/search-handlers.js";
import { createSettingsHandlers } from "./handlers/settings-handlers.js";
import { createSocialHandlers } from "./handlers/social-handlers.js";
import { createSystemHandlers } from "./handlers/system-handlers.js";
import { createToolsHandlers } from "./handlers/tools-handlers.js";
import { executeIpcHandler } from "./transport.js";
import { createDocxRenderer } from "../reports/docx-renderer.js";
import { createPdfRenderer } from "../reports/pdf-renderer.js";
import { ReportService } from "../reports/report-service.js";
import { ScanService } from "../scans/scan-service.js";
import { ToolsService } from "../tools/tools-service.js";
import { WslToolLauncher } from "../tools/wsl-launcher.js";
import { ChatProviderResolver, defaultChatProviders } from "../providers/chat-providers.js";
import { DEFAULT_WSL_DISTRO, WSL_DISTRO_SETTING_KEY } from "../../shared/types/tools.js";
import { ImageUsernameService } from "../image-username/image-username-service.js";
import { MonitoringService } from "../monitoring/monitoring-service.js";
import { DashboardService } from "../dashboard/dashboard-service.js";
import { MobileService } from "../mobile/mobile-service.js";
import { SocialAnalyzerService } from "../social/social-analyzer-service.js";
import { MethodologyService } from "../methodology/methodology-service.js";

const { app, BrowserWindow, dialog, ipcMain, shell } = electron;

type HandlerMap = {
  readonly [TChannel in IpcChannel]: (
    request: IpcParsedRequest<TChannel>
  ) => IpcResponse<TChannel> | Promise<IpcResponse<TChannel>>;
};

export function registerIpcHandlers(db: ReacherDatabase, vaultCrypto: VaultCrypto): void {
  const auditRepository = new AuditRepository(db);
  const agentsRepository = new AgentsRepository(db);
  const agentRuntimeRepository = new AgentRuntimeRepository(db);
  const analyzersRepository = new AnalyzersRepository(db);
  const casesRepository = new CasesRepository(db);
  const dashboardRepository = new DashboardRepository(db);
  const imageSearchRepository = new ImageSearchRepository(db);
  const mobileRepository = new MobileRepository(db);
  const monitoringRepository = new MonitoringRepository(db);
  const reportsRepository = new ReportsRepository(db);
  const scansRepository = new ScansRepository(db);
  const searchRepository = new SearchRepository(db);
  const settingsRepository = new SettingsRepository(db);
  const toolsRepository = new ToolsRepository(db);
  const vaultRepository = new VaultRepository(db, vaultCrypto, auditRepository);
  const wslToolLauncher = new WslToolLauncher();
  const mobileService = new MobileService(mobileRepository, auditRepository);
  const socialAnalyzerService = new SocialAnalyzerService(auditRepository);
  const methodologyService = new MethodologyService();
  const emitAgentEvents = (events: readonly AgentRuntimeEvent[]): void => {
    for (const webContents of BrowserWindow.getAllWindows().map((window) => window.webContents)) {
      webContents.send("agent:events", { events });
    }
  };
  // Keyed chat providers read their secret here, at the one audited gate, rather
  // than from ambient environment inside the provider -- same rule the keyed
  // search connectors follow.
  const chatProviderResolver = new ChatProviderResolver(
    defaultChatProviders((source, purpose) =>
      vaultRepository.has(source) ? vaultRepository.readSecret(source, "local-user", purpose) : null
    )
  );
  const agentRuntimeService = new AgentRuntimeService(
    agentsRepository,
    agentRuntimeRepository,
    casesRepository,
    auditRepository,
    emitAgentEvents,
    app.getAppPath(),
    // Clock stays defaulted; only the resolver below needs injecting.
    undefined,
    chatProviderResolver
  );
  const dashboardService = new DashboardService(dashboardRepository, auditRepository, agentRuntimeService);
  const emitToolOutput = (event: ToolOutputEvent): void => {
    for (const webContents of BrowserWindow.getAllWindows().map((window) => window.webContents)) {
      webContents.send("tools:output", event);
    }
  };
  const toolsService = new ToolsService(
    toolsRepository,
    casesRepository,
    auditRepository,
    wslToolLauncher,
    emitToolOutput
  );
  const emitScanOutput = (event: ScanOutputEvent): void => {
    for (const webContents of BrowserWindow.getAllWindows().map((window) => window.webContents)) {
      webContents.send("scan:output", event);
    }
  };
  const scanService = new ScanService(scansRepository, toolsRepository, auditRepository, wslToolLauncher, emitScanOutput);
  const monitoringService = new MonitoringService(
    monitoringRepository,
    casesRepository,
    searchRepository,
    auditRepository,
    vaultRepository
  );
  monitoringService.startScheduler();
  const analyzersService = new AnalyzersService(
    analyzersRepository,
    casesRepository,
    auditRepository,
    wslToolLauncher,
    { vaultReader: vaultRepository }
  );
  const imageUsernameService = new ImageUsernameService(
    imageSearchRepository,
    searchRepository,
    casesRepository,
    auditRepository,
    vaultRepository,
    wslToolLauncher,
    agentRuntimeService
  );
  const architectAgentService = new ArchitectAgentService(
    agentsRepository,
    agentRuntimeRepository,
    auditRepository,
    app.getAppPath(),
    async (proposal) => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const options: MessageBoxOptions = {
        type: "question",
        buttons: ["Apply", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        title: "Confirm architect apply",
        message: "Apply architect plan?",
        detail: proposal.summary
      };
      const response = focusedWindow
        ? await dialog.showMessageBox(focusedWindow, options)
        : await dialog.showMessageBox(options);
      return response.response === 0;
    }
  );
  const reportService = new ReportService(
    casesRepository,
    reportsRepository,
    auditRepository,
    scansRepository,
    { pdf: createPdfRenderer(app.getAppPath()), docx: createDocxRenderer() },
    path.join(app.getPath("userData"), "reports")
  );
  // The process-backed connectors cannot live in the static registry: Sherlock
  // needs the WSL launcher and the distro Jack configured in Settings, neither of
  // which exists until this composition root has run. Appending them here keeps
  // connectors/index.ts a plain, importable list for the phase audit and tests.
  const passiveSearchConnectors: readonly SourceConnector[] = [
    ...searchConnectors,
    scrapeGraphConnector,
    createSherlockConnector(
      wslToolLauncher,
      () => settingsRepository.get(WSL_DISTRO_SETTING_KEY) ?? DEFAULT_WSL_DISTRO
    )
  ];

  const handlers: HandlerMap = {
    ...createSystemHandlers(
      auditRepository,
      async () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        const result = focusedWindow
          ? await dialog.showOpenDialog(focusedWindow, {
              properties: ["openFile"],
              filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }]
            })
          : await dialog.showOpenDialog({
              properties: ["openFile"],
              filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }]
            });
        return result.canceled ? null : result.filePaths[0] ?? null;
      },
      async () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        const result = focusedWindow
          ? await dialog.showOpenDialog(focusedWindow, {
              properties: ["openFile"],
              filters: [{ name: "All files", extensions: ["*"] }]
            })
          : await dialog.showOpenDialog({
              properties: ["openFile"],
              filters: [{ name: "All files", extensions: ["*"] }]
            });
        return result.canceled ? null : result.filePaths[0] ?? null;
      }
    ),
    ...createSettingsHandlers(settingsRepository),
    ...createAuditHandlers(auditRepository),
    ...createDashboardHandlers(dashboardService),
    ...createCasesHandlers(casesRepository),
    ...createReportsHandlers(reportService, reportsRepository, (filePath) => shell.openPath(filePath)),
    ...createScanHandlers(scanService),
    ...createKeysHandlers(vaultRepository, auditRepository),
    ...createProvidersHandlers(vaultRepository),
    ...createAgentsHandlers(agentsRepository),
    ...createAgentRuntimeHandlers(agentRuntimeService, agentRuntimeRepository),
    ...createArchitectAgentHandlers(architectAgentService),
    ...createToolsHandlers(toolsService),
    ...createAnalyzersHandlers(analyzersService),
    ...createMonitoringHandlers(monitoringService),
    ...createMobileHandlers(mobileService),
    ...createSocialHandlers(socialAnalyzerService),
    ...createMethodologyHandlers(methodologyService),
    ...createImageUsernameHandlers(imageUsernameService),
    ...createSearchHandlers(
      searchRepository,
      auditRepository,
      passiveSearchConnectors,
      () => BrowserWindow.getAllWindows().map((window) => window.webContents),
      vaultRepository,
      agentRuntimeService,
      casesRepository
    )
  };

  // The generic preserves channel-to-schema coupling; a non-generic loop was rejected because it widened every handler to every request shape.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  const registerChannel = <TChannel extends IpcChannel>(channel: TChannel): void => {
    const definition = IPC[channel];
    const handler = (parsedRequest: unknown) => handlers[channel](parsedRequest as IpcParsedRequest<TChannel>);
    ipcMain.handle(channel, (_event, request: unknown) =>
      executeIpcHandler(definition.request, definition.response, request, handler)
    );
  };

  for (const channel of Object.keys(IPC) as IpcChannel[]) {
    registerChannel(channel);
  }
}
