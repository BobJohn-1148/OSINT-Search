import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc";
import type { Result } from "../shared/result";

declare global {
  interface Window {
    readonly reacher: {
      readonly channels: readonly IpcChannel[];
      invoke<TChannel extends IpcChannel>(
        channel: TChannel,
        request: IpcRequest<TChannel>
      ): Promise<Result<IpcResponse<TChannel>>>;
    };
  }
}
