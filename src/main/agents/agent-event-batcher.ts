/**
 * Agent event batching mirrors search batching so renderer labels update in
 * chunks instead of one IPC send per step. If the runtime emitted every line
 * immediately, a chatty provider could freeze the 3D HQ.
 */
import type { AgentRuntimeEvent } from "../../shared/schemas/agents-runtime.js";

export class AgentEventBatcher {
  private readonly buffer: AgentRuntimeEvent[] = [];
  private timeout: NodeJS.Timeout | null = null;

  public constructor(
    private readonly emit: (events: readonly AgentRuntimeEvent[]) => void,
    private readonly maxItems = 20,
    private readonly flushMs = 100
  ) {}

  public push(event: AgentRuntimeEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxItems) {
      this.flush();
      return;
    }
    this.timeout ??= setTimeout(() => this.flush(), this.flushMs);
  }

  public flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.buffer.length === 0) {
      return;
    }
    const batch = this.buffer.splice(0, this.buffer.length);
    this.emit(batch);
  }
}
