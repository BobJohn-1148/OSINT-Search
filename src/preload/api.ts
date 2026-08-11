/**
 * The preload API is small on purpose because context isolation is only useful
 * when the renderer receives a narrow, typed bridge. If the whole ipcRenderer
 * leaked through, any route stub could call undeclared channels.
 */
import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc.js";
import type { Result } from "../shared/result.js";
import type { AgentRuntimeEventBatch } from "../shared/schemas/agents-runtime.js";
import type { Observation, SourceStatus } from "../shared/types/search.js";

export interface SearchEventMap {
  readonly "search:source-returned": SourceStatus;
  readonly "search:observations": readonly Observation[];
}

export interface AgentEventMap {
  readonly "agent:events": AgentRuntimeEventBatch;
}

export interface ReacherBridge {
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
}

declare global {
  interface Window {
    readonly reacher: ReacherBridge;
  }
}
