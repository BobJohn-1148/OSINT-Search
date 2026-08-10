/**
 * Renderer IPC calls pass through this client so components cannot reach around
 * preload isolation. If route stubs called window.reacher directly everywhere,
 * later hooks would duplicate error handling and make audits harder to trace.
 */
import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc";
import type { Result } from "../shared/result";

export function invokeReacher<TChannel extends IpcChannel>(
  channel: TChannel,
  request: IpcRequest<TChannel>
): Promise<Result<IpcResponse<TChannel>>> {
  return window.reacher.invoke(channel, request);
}
