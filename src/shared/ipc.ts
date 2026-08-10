/**
 * IPC is a registry instead of scattered string constants because capabilities,
 * sensitivity, mutation status, and schemas must move together. If a channel can
 * be added without this metadata, the preload bridge and audit review would no
 * longer describe the same security boundary.
 */
import type { z } from "zod";
import {
  auditListRequestSchema,
  auditListResponseSchema
} from "./schemas/audit.js";
import {
  settingsGetRequestSchema,
  settingsGetResponseSchema,
  settingsSetRequestSchema,
  settingsSetResponseSchema
} from "./schemas/settings.js";
import {
  systemPingRequestSchema,
  systemPingResponseSchema
} from "./schemas/system.js";

export type IpcSensitivity = "low" | "medium" | "high";

export interface IpcChannelDefinition<TRequest extends z.ZodType, TResponse extends z.ZodType> {
  readonly request: TRequest;
  readonly response: TResponse;
  readonly capability: string;
  readonly sensitivity: IpcSensitivity;
  readonly mutates: boolean;
  readonly summary: string;
}

function defineChannel<TRequest extends z.ZodType, TResponse extends z.ZodType>(
  definition: IpcChannelDefinition<TRequest, TResponse>
): IpcChannelDefinition<TRequest, TResponse> {
  return definition;
}

export const IPC = {
  "system:ping": defineChannel({
    request: systemPingRequestSchema,
    response: systemPingResponseSchema,
    capability: "system.health",
    sensitivity: "low",
    mutates: true,
    summary: "Records a local app heartbeat and returns a pong."
  }),
  "settings:get": defineChannel({
    request: settingsGetRequestSchema,
    response: settingsGetResponseSchema,
    capability: "settings.read",
    sensitivity: "low",
    mutates: false,
    summary: "Reads one local setting by key."
  }),
  "settings:set": defineChannel({
    request: settingsSetRequestSchema,
    response: settingsSetResponseSchema,
    capability: "settings.write",
    sensitivity: "medium",
    mutates: true,
    summary: "Writes one local setting by key."
  }),
  "audit:list": defineChannel({
    request: auditListRequestSchema,
    response: auditListResponseSchema,
    capability: "audit.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists recent append-only audit events."
  })
} as const;

export type IpcChannel = keyof typeof IPC;
export type IpcRequest<TChannel extends IpcChannel> = z.input<(typeof IPC)[TChannel]["request"]>;
export type IpcParsedRequest<TChannel extends IpcChannel> = z.infer<(typeof IPC)[TChannel]["request"]>;
export type IpcResponse<TChannel extends IpcChannel> = z.infer<(typeof IPC)[TChannel]["response"]>;
