/**
 * The preload API is small on purpose because context isolation is only useful
 * when the renderer receives a narrow, typed bridge. If the whole ipcRenderer
 * leaked through, any route stub could call undeclared channels.
 */
import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc.js";
import type { Result } from "../shared/result.js";

export interface ReacherBridge {
  readonly channels: readonly IpcChannel[];
  invoke<TChannel extends IpcChannel>(
    channel: TChannel,
    request: IpcRequest<TChannel>
  ): Promise<Result<IpcResponse<TChannel>>>;
}

declare global {
  interface Window {
    readonly reacher: ReacherBridge;
  }
}
