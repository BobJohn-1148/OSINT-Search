/**
 * Transport tests pin failure wrapping at the main-process boundary because
 * renderer routes must receive Result errors instead of Electron exceptions. If
 * this behavior regresses, sensitive handlers can fail before UI gets a stable
 * audit-friendly outcome.
 */
import { z } from "zod";
import { executeIpcHandler } from "../../src/main/ipc/transport";

it("the IPC transport wraps a thrown handler error as a Result error, not a crash", async () => {
  const result = await executeIpcHandler(z.object({ id: z.string() }), z.object({ ok: z.literal(true) }), { id: "x" }, () => {
    throw new Error("handler failed");
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: "IPC_HANDLER_ERROR",
      message: "handler failed"
    }
  });
});
