/**
 * The transport turns handler failures into Result errors because renderer code
 * needs one uniform path for all IPC outcomes. If exceptions leaked through
 * Electron's invoke path, validation failures and thrown bugs would be reported
 * inconsistently and could crash route stubs.
 */
import type { z } from "zod";
import { err, ok, type Result } from "../../shared/result.js";

export async function executeIpcHandler<TRequestSchema extends z.ZodType, TResponseSchema extends z.ZodType>(
  requestSchema: TRequestSchema,
  responseSchema: TResponseSchema,
  rawRequest: unknown,
  handler: (request: z.infer<TRequestSchema>) => Promise<z.infer<TResponseSchema>> | z.infer<TResponseSchema>
): Promise<Result<z.infer<TResponseSchema>>> {
  try {
    const request = requestSchema.parse(rawRequest);
    const response = await handler(request);
    return ok(responseSchema.parse(response));
  } catch (error) {
    return err("IPC_HANDLER_ERROR", error instanceof Error ? error.message : "The IPC handler failed");
  }
}
