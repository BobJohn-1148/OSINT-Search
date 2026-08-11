/**
 * Handler registration joins the metadata registry to concrete main-process
 * functions in one place. If channels were registered ad hoc, Object.keys(IPC)
 * in preload could expose a channel that main never validates or handles.
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { MessageBoxOptions } from "electron";
import path from "node:path";
import type { ReacherDatabase } from "../../db/database.js";
import { AgentsRepository } from "../../db/repositories/agents-repository.js";
import { AgentRuntimeRepository } from "../../db/repositories/agent-runtime-repository.js";
import { AuditRepository } from "../../db/repositories/audit-repository.js";
import { CasesRepository } from "../../db/repositories/cases-repository.js";
import { ReportsRepository } from "../../db/repositories/reports-repository.js";
import { SettingsRepository } from "../../db/repositories/settings-repository.js";
import { VaultRepository } from "../../db/repositories/vault-repository.js";
import { SearchRepository } from "../../db/repositories/search-repository.js";
import type { VaultCrypto } from "../security/vault-crypto.js";
import { searchConnectors } from "../search/connectors/index.js";
import { IPC, type IpcChannel, type IpcParsedRequest, type IpcResponse } from "../../shared/ipc.js";
import { AgentRuntimeService } from "../agents/agent-runtime-service.js";
import { ArchitectAgentService } from "../agents/architect-agent-service.js";
import type { AgentRuntimeEvent } from "../../shared/schemas/agents-runtime.js";
import { createArchitectAgentHandlers } from "./handlers/architect-agent-handlers.js";
import { createAgentRuntimeHandlers } from "./handlers/agent-runtime-handlers.js";
import { createAgentsHandlers } from "./handlers/agents-handlers.js";
import { createAuditHandlers } from "./handlers/audit-handlers.js";
import { createCasesHandlers } from "./handlers/cases-handlers.js";
import { createKeysHandlers } from "./handlers/keys-handlers.js";
import { createProvidersHandlers } from "./handlers/providers-handlers.js";
import { createReportsHandlers } from "./handlers/reports-handlers.js";
import { createSearchHandlers } from "./handlers/search-handlers.js";
import { createSettingsHandlers } from "./handlers/settings-handlers.js";
import { createSystemHandlers } from "./handlers/system-handlers.js";
import { executeIpcHandler } from "./transport.js";
import { createDocxRenderer } from "../reports/docx-renderer.js";
import { createPdfRenderer } from "../reports/pdf-renderer.js";
import { ReportService } from "../reports/report-service.js";

type HandlerMap = {
  readonly [TChannel in IpcChannel]: (
    request: IpcParsedRequest<TChannel>
  ) => IpcResponse<TChannel> | Promise<IpcResponse<TChannel>>;
};

export function registerIpcHandlers(db: ReacherDatabase, vaultCrypto: VaultCrypto): void {
  const auditRepository = new AuditRepository(db);
  const agentsRepository = new AgentsRepository(db);
  const agentRuntimeRepository = new AgentRuntimeRepository(db);
  const casesRepository = new CasesRepository(db);
  const reportsRepository = new ReportsRepository(db);
  const searchRepository = new SearchRepository(db);
  const settingsRepository = new SettingsRepository(db);
  const vaultRepository = new VaultRepository(db, vaultCrypto, auditRepository);
  const emitAgentEvents = (events: readonly AgentRuntimeEvent[]): void => {
    for (const webContents of BrowserWindow.getAllWindows().map((window) => window.webContents)) {
      webContents.send("agent:events", { events });
    }
  };
  const agentRuntimeService = new AgentRuntimeService(
    agentsRepository,
    agentRuntimeRepository,
    casesRepository,
    auditRepository,
    emitAgentEvents,
    app.getAppPath()
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
    { pdf: createPdfRenderer(), docx: createDocxRenderer() },
    path.join(app.getPath("userData"), "reports")
  );
  const handlers: HandlerMap = {
    ...createSystemHandlers(auditRepository),
    ...createSettingsHandlers(settingsRepository),
    ...createAuditHandlers(auditRepository),
    ...createCasesHandlers(casesRepository),
    ...createReportsHandlers(reportService, reportsRepository, (filePath) => shell.openPath(filePath)),
    ...createKeysHandlers(vaultRepository, auditRepository),
    ...createProvidersHandlers(vaultRepository),
    ...createAgentsHandlers(agentsRepository),
    ...createAgentRuntimeHandlers(agentRuntimeService, agentRuntimeRepository),
    ...createArchitectAgentHandlers(architectAgentService),
    ...createSearchHandlers(
      searchRepository,
      auditRepository,
      searchConnectors,
      () => BrowserWindow.getAllWindows().map((window) => window.webContents)
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
