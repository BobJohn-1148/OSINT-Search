/**
 * Handler registration joins the metadata registry to concrete main-process
 * functions in one place. If channels were registered ad hoc, Object.keys(IPC)
 * in preload could expose a channel that main never validates or handles.
 */
import { ipcMain } from "electron";
import type { ReacherDatabase } from "../../db/database.js";
import { AuditRepository } from "../../db/repositories/audit-repository.js";
import { SettingsRepository } from "../../db/repositories/settings-repository.js";
import { IPC, type IpcChannel, type IpcParsedRequest, type IpcResponse } from "../../shared/ipc.js";
import { createAuditHandlers } from "./handlers/audit-handlers.js";
import { createSettingsHandlers } from "./handlers/settings-handlers.js";
import { createSystemHandlers } from "./handlers/system-handlers.js";
import { executeIpcHandler } from "./transport.js";

type HandlerMap = {
  readonly [TChannel in IpcChannel]: (
    request: IpcParsedRequest<TChannel>
  ) => IpcResponse<TChannel> | Promise<IpcResponse<TChannel>>;
};

export function registerIpcHandlers(db: ReacherDatabase): void {
  const auditRepository = new AuditRepository(db);
  const settingsRepository = new SettingsRepository(db);
  const handlers: HandlerMap = {
    ...createSystemHandlers(auditRepository),
    ...createSettingsHandlers(settingsRepository),
    ...createAuditHandlers(auditRepository)
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
