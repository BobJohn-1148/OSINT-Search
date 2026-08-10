import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc";
import type { Result } from "../shared/result";
import type { Observation, SourceStatus } from "../shared/types/search";

interface SearchEventMap {
  readonly "search:source-returned": SourceStatus;
  readonly "search:observations": readonly Observation[];
}

declare global {
  interface Window {
    readonly reacher: {
      readonly channels: readonly IpcChannel[];
      invoke<TChannel extends IpcChannel>(
        channel: TChannel,
        request: IpcRequest<TChannel>
      ): Promise<Result<IpcResponse<TChannel>>>;
      onSearchEvent<TEvent extends keyof SearchEventMap>(
        event: TEvent,
        listener: (payload: SearchEventMap[TEvent]) => void
      ): () => void;
    };
  }
}
