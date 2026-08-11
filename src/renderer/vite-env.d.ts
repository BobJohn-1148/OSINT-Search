import type { IpcChannel, IpcRequest, IpcResponse } from "../shared/ipc";
import type { Result } from "../shared/result";
import type { AgentRuntimeEventBatch } from "../shared/schemas/agents-runtime";
import type { ScanOutputEvent } from "../shared/schemas/scans";
import type { ToolOutputEvent } from "../shared/schemas/tools";
import type { Observation, SourceStatus } from "../shared/types/search";

interface SearchEventMap {
  readonly "search:source-returned": SourceStatus;
  readonly "search:observations": readonly Observation[];
}

interface AgentEventMap {
  readonly "agent:events": AgentRuntimeEventBatch;
}

interface ToolEventMap {
  readonly "tools:output": ToolOutputEvent;
}

interface ScanEventMap {
  readonly "scan:output": ScanOutputEvent;
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
      onToolEvent<TEvent extends keyof ToolEventMap>(
        event: TEvent,
        listener: (payload: ToolEventMap[TEvent]) => void
      ): () => void;
      onScanEvent<TEvent extends keyof ScanEventMap>(
        event: TEvent,
        listener: (payload: ScanEventMap[TEvent]) => void
      ): () => void;
    };
  }
}
