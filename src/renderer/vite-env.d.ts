import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc";
import type { Result } from "../shared/result";
import type { AgentRuntimeEventBatch } from "../shared/schemas/agents-runtime";
import type { Observation, SourceStatus } from "../shared/types/search";

interface SearchEventMap {
  readonly "search:source-returned": SourceStatus;
  readonly "search:observations": readonly Observation[];
}

interface AgentEventMap {
  readonly "agent:events": AgentRuntimeEventBatch;
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
      onAgentEvent<TEvent extends keyof AgentEventMap>(
        event: TEvent,
        listener: (payload: AgentEventMap[TEvent]) => void
      ): () => void;
    };
  }
}
