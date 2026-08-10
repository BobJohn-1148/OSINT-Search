/**
 * IPC is a registry instead of scattered string constants because capabilities,
 * sensitivity, mutation status, and schemas must move together. If a channel can
 * be added without this metadata, the preload bridge and audit review would no
 * longer describe the same security boundary.
 */
import type { z } from "zod";
import {
  agentsListRequestSchema,
  agentsListResponseSchema,
  agentsSetModelRequestSchema,
  agentsSetModelResponseSchema
} from "./schemas/agents.js";
import {
  auditListRequestSchema,
  auditListResponseSchema
} from "./schemas/audit.js";
import {
  keysAddRequestSchema,
  keysAddResponseSchema,
  keysListRequestSchema,
  keysListResponseSchema,
  keysRevokeRequestSchema,
  keysRevokeResponseSchema,
  keysTestRequestSchema,
  keysTestResponseSchema
} from "./schemas/keys.js";
import {
  providersListRequestSchema,
  providersListResponseSchema,
  providersTestRequestSchema,
  providersTestResponseSchema
} from "./schemas/providers.js";
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

export type IpcSensitivity = "low" | "medium" | "high" | "sensitive";

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
  }),
  "keys:add": defineChannel({
    request: keysAddRequestSchema,
    response: keysAddResponseSchema,
    capability: "keys.write",
    sensitivity: "sensitive",
    mutates: true,
    summary: "Encrypts and stores one API key for a source."
  }),
  "keys:test": defineChannel({
    request: keysTestRequestSchema,
    response: keysTestResponseSchema,
    capability: "keys.read",
    sensitivity: "sensitive",
    mutates: true,
    summary: "Reads one encrypted API key through the vault gate and validates it."
  }),
  "keys:revoke": defineChannel({
    request: keysRevokeRequestSchema,
    response: keysRevokeResponseSchema,
    capability: "keys.write",
    sensitivity: "sensitive",
    mutates: true,
    summary: "Removes one stored API key for a source."
  }),
  "keys:list": defineChannel({
    request: keysListRequestSchema,
    response: keysListResponseSchema,
    capability: "keys.readMetadata",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists API key metadata without returning secrets."
  }),
  "providers:list": defineChannel({
    request: providersListRequestSchema,
    response: providersListResponseSchema,
    capability: "providers.read",
    sensitivity: "low",
    mutates: false,
    summary: "Lists supported AI providers and local configuration status."
  }),
  "providers:test": defineChannel({
    request: providersTestRequestSchema,
    response: providersTestResponseSchema,
    capability: "providers.test",
    sensitivity: "sensitive",
    mutates: true,
    summary: "Tests one provider using the vault gate when a key is required."
  }),
  "agents:list": defineChannel({
    request: agentsListRequestSchema,
    response: agentsListResponseSchema,
    capability: "agents.read",
    sensitivity: "low",
    mutates: false,
    summary: "Lists local agents and their selected provider models."
  }),
  "agents:setModel": defineChannel({
    request: agentsSetModelRequestSchema,
    response: agentsSetModelResponseSchema,
    capability: "agents.write",
    sensitivity: "medium",
    mutates: true,
    summary: "Stores one agent provider and model selection."
  })
} as const;

export type IpcChannel = keyof typeof IPC;
export type IpcRequest<TChannel extends IpcChannel> = z.input<(typeof IPC)[TChannel]["request"]>;
export type IpcParsedRequest<TChannel extends IpcChannel> = z.infer<(typeof IPC)[TChannel]["request"]>;
export type IpcResponse<TChannel extends IpcChannel> = z.infer<(typeof IPC)[TChannel]["response"]>;
