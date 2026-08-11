# Stability and performance — background execution, throttling, no crashes

Reacher fans out to many tools and APIs at once and can stream huge result sets.
It must never block the UI or exhaust memory. These are build invariants.

## 1. Never block the UI
All process/tool execution and API fan-out runs in the main process (or a worker),
streamed to the renderer over IPC events. The renderer only renders — it never
runs a tool or a blocking call.

## 2. Bounded concurrency (the flood control)
A job queue governs how many connectors/tools/API calls run at once. Fan-out
ENQUEUES work; it does not spawn everything simultaneously. Defaults (configurable
in Settings):
- `maxConcurrentConnectors = 5`
- `maxConcurrentProcesses = 4` (app-wide cap on WSL/child processes)
- everything else waits in the queue.

## 3. Backpressure on streamed output
- **Batch renderer updates.** Buffer incoming observations and flush once every
  ~100 ms OR every ~50 items in a single IPC message — never one IPC message per
  line. Thousands of tiny messages will freeze the renderer. `ctx.emit` in the
  connectors is a batched emitter; connectors may emit freely and the orchestrator
  coalesces.
- **Pause fast producers.** Read child stdout as a paused stream; if the parse/DB
  queue grows past a high-water mark, `pause()` the stream until it drains, then
  `resume()`.

## 4. Cap resource use per run
- Max captured output per tool run (e.g. 5 MB); beyond that, spill to a temp file
  and keep a ring buffer in memory — never accumulate an unbounded string.
- Per-connector timeout (default 60 s). On timeout or cancel, kill the child
  process tree (not just the parent).

## 5. Incremental persistence
Write observations to SQLite in batched transactions as they arrive (e.g. every
50 rows or 100 ms). Do not hold the full result set in memory before saving.

## 6. Rate-limit API connectors
Token-bucket per source, set to that source's free-tier limit (see
`API_CATALOG.md`), so we neither exceed quotas nor hammer a host.

## 7. Virtualize the renderer
The correlation tree and any long list render only visible nodes (windowed /
virtualized). A 10,000-node result must not put 10,000 nodes in the DOM.

## 8. Cancellable
Every search/agent/tool run is cancellable. Cancel stops the queue and kills
running children immediately.

## Where this lands
- Phase 2: the fan-out queue, batched IPC emit, incremental DB writes, virtualized tree.
- Phase 5: the agent runtime uses the same queue and batched step/finding events.
- Phase 7: the WSL launcher streams (paused/resumed), caps output, enforces
  timeout, and kills the process tree on cancel.
