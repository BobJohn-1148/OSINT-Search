/**
 * Handler registration joins the metadata registry to concrete main-process
 * functions in one place. If channels were registered ad hoc, Object.keys(IPC)
 * in preload could expose a channel that main never validates or handles.
 */
import { BrowserWindow, ipcMain } from "electron";
import type { ReacherDatabase } from "../../db/database.js";
import { AgentsRepository } from "../../db/repositories/agents-repository.js";
import { AuditRepository } from "../../db/repositories/audit-repository.js";
import { SettingsRepository } from "../../db/repositories/settings-repository.js";
import { VaultRepository } from "../../db/repositories/vault-repository.js";
import { SearchRepository } from "../../db/repositories/search-repository.js";
import type { VaultCrypto } from "../security/vault-crypto.js";
import { searchConnectors } from "../search/connectors/index.js";
import { IPC, type IpcChannel, type IpcParsedRequest, type IpcResponse } from "../../shared/ipc.js";
import { createAgentsHandlers } from "./handlers/agents-handlers.js";
import { createAuditHandlers } from "./handlers/audit-handlers.js";
import { createKeysHandlers } from "./handlers/keys-handlers.js";
import { createProvidersHandlers } from "./handlers/providers-handlers.js";
import { createSearchHandlers } from "./handlers/search-handlers.js";
import { createSettingsHandlers } from "./handlers/settings-handlers.js";
import { createSystemHandlers } from "./handlers/system-handlers.js";
import { executeIpcHandler } from "./transport.js";

type HandlerMap = {
  readonly [TChannel in IpcChannel]: (
    request: IpcParsedRequest<TChannel>
  ) => IpcResponse<TChannel> | Promise<IpcResponse<TChannel>>;
};

export function registerIpcHandlers(db: ReacherDatabase, vaultCrypto: VaultCrypto): void {
  const auditRepository = new AuditRepository(db);
  const agentsRepository = new AgentsRepository(db);
  const searchRepository = new SearchRepository(db);
  const settingsRepository = new SettingsRepository(db);
  const vaultRepository = new VaultRepository(db, vaultCrypto, auditRepository);
  const handlers: HandlerMap = {
    ...createSystemHandlers(auditRepository),
    ...createSettingsHandlers(settingsRepository),
    ...createAuditHandlers(auditRepository),
    ...createKeysHandlers(vaultRepository, auditRepository),
    ...createProvidersHandlers(vaultRepository),
    ...createAgentsHandlers(agentsRepository),
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
