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
  architectApplyRequestSchema,
  architectApplyResponseSchema,
  architectAskRequestSchema,
  architectAskResponseSchema,
  architectProposePlanRequestSchema,
  architectProposePlanResponseSchema
} from "./schemas/architect-agent.js";
import {
  agentMemoryListRequestSchema,
  agentMemoryListResponseSchema,
  agentPlaybooksRequestSchema,
  agentPlaybooksResponseSchema,
  agentRunRequestSchema,
  agentRunResponseSchema,
  agentRunsRequestSchema,
  agentRunsResponseSchema,
  agentStatesRequestSchema,
  agentStatesResponseSchema
} from "./schemas/agents-runtime.js";
import {
  caseAddItemRequestSchema,
  caseAddItemResponseSchema,
  caseSearchRequestSchema,
  caseSearchResponseSchema,
  caseSummaryRequestSchema,
  caseSummaryResponseSchema,
  caseTimelineRequestSchema,
  caseTimelineResponseSchema,
  casesCreateRequestSchema,
  casesCreateResponseSchema,
  casesGetRequestSchema,
  casesGetResponseSchema,
  casesListRequestSchema,
  casesListResponseSchema,
  casesUpdateRequestSchema,
  casesUpdateResponseSchema
} from "./schemas/cases.js";
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
  reportGenerateRequestSchema,
  reportGenerateResponseSchema,
  reportListRequestSchema,
  reportListResponseSchema,
  reportOpenRequestSchema,
  reportOpenResponseSchema
} from "./schemas/reports.js";
import {
  searchGetRequestSchema,
  searchGetResponseSchema,
  searchCancelRequestSchema,
  searchCancelResponseSchema,
  searchPivotRequestSchema,
  searchPivotResponseSchema,
  searchRunRequestSchema,
  searchRunResponseSchema
} from "./schemas/search.js";
import {
  scanGetRequestSchema,
  scanGetResponseSchema,
  scanRunRequestSchema,
  scanRunResponseSchema,
  scanTopologyRequestSchema,
  scanTopologyResponseSchema
} from "./schemas/scans.js";
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
import {
  authCreateRequestSchema,
  authCreateResponseSchema,
  authListRequestSchema,
  authListResponseSchema,
  catalogAddRequestSchema,
  catalogAddResponseSchema,
  catalogUpdateRequestSchema,
  catalogUpdateResponseSchema,
  toolsDetectRequestSchema,
  toolsDetectResponseSchema,
  toolsLaunchRequestSchema,
  toolsLaunchResponseSchema,
  toolsListRequestSchema,
  toolsListResponseSchema
} from "./schemas/tools.js";

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
  }),
  "agent:run": defineChannel({
    request: agentRunRequestSchema,
    response: agentRunResponseSchema,
    capability: "agents.run",
    sensitivity: "medium",
    mutates: true,
    summary: "Runs one local agent job in the main process."
  }),
  "agent:runs": defineChannel({
    request: agentRunsRequestSchema,
    response: agentRunsResponseSchema,
    capability: "agents.readHistory",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists persisted agent run history."
  }),
  "agent:memory:list": defineChannel({
    request: agentMemoryListRequestSchema,
    response: agentMemoryListResponseSchema,
    capability: "agents.readMemory",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists shared cross-provider agent memory."
  }),
  "agent:states": defineChannel({
    request: agentStatesRequestSchema,
    response: agentStatesResponseSchema,
    capability: "agents.readState",
    sensitivity: "low",
    mutates: false,
    summary: "Lists live agent state for HQ labels."
  }),
  "agent:playbooks": defineChannel({
    request: agentPlaybooksRequestSchema,
    response: agentPlaybooksResponseSchema,
    capability: "agents.readPlaybooks",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists reusable scheduled agent playbooks."
  }),
  "agent:architect:ask": defineChannel({
    request: architectAskRequestSchema,
    response: architectAskResponseSchema,
    capability: "agents.architect.ask",
    sensitivity: "medium",
    mutates: true,
    summary: "Asks the architect agent a codebase question and audits the action."
  }),
  "agent:architect:proposePlan": defineChannel({
    request: architectProposePlanRequestSchema,
    response: architectProposePlanResponseSchema,
    capability: "agents.architect.plan",
    sensitivity: "medium",
    mutates: true,
    summary: "Drafts a cited feature plan from scoped repository reads."
  }),
  "agent:architect:apply": defineChannel({
    request: architectApplyRequestSchema,
    response: architectApplyResponseSchema,
    capability: "agents.architect.apply",
    sensitivity: "medium",
    mutates: true,
    summary: "Applies a drafted architect plan only after a main-process confirmation."
  }),
  "search:run": defineChannel({
    request: searchRunRequestSchema,
    response: searchRunResponseSchema,
    capability: "search.run",
    sensitivity: "medium",
    mutates: true,
    summary: "Runs a passive OSINT search and persists the correlated result."
  }),
  "search:pivot": defineChannel({
    request: searchPivotRequestSchema,
    response: searchPivotResponseSchema,
    capability: "search.run",
    sensitivity: "medium",
    mutates: true,
    summary: "Runs a passive OSINT search from an observation pivot seed."
  }),
  "search:get": defineChannel({
    request: searchGetRequestSchema,
    response: searchGetResponseSchema,
    capability: "search.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Reads one persisted correlated search run."
  }),
  "search:cancel": defineChannel({
    request: searchCancelRequestSchema,
    response: searchCancelResponseSchema,
    capability: "search.cancel",
    sensitivity: "medium",
    mutates: true,
    summary: "Cancels one active passive OSINT search run."
  }),
  "cases:create": defineChannel({
    request: casesCreateRequestSchema,
    response: casesCreateResponseSchema,
    capability: "cases.write",
    sensitivity: "medium",
    mutates: true,
    summary: "Creates a local investigation case."
  }),
  "cases:list": defineChannel({
    request: casesListRequestSchema,
    response: casesListResponseSchema,
    capability: "cases.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists local investigation cases."
  }),
  "cases:get": defineChannel({
    request: casesGetRequestSchema,
    response: casesGetResponseSchema,
    capability: "cases.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Reads one case with its saved evidence."
  }),
  "cases:update": defineChannel({
    request: casesUpdateRequestSchema,
    response: casesUpdateResponseSchema,
    capability: "cases.write",
    sensitivity: "medium",
    mutates: true,
    summary: "Updates case metadata, status, or tags."
  }),
  "case:addItem": defineChannel({
    request: caseAddItemRequestSchema,
    response: caseAddItemResponseSchema,
    capability: "cases.writeEvidence",
    sensitivity: "medium",
    mutates: true,
    summary: "Saves one evidence item to a case."
  }),
  "case:timeline": defineChannel({
    request: caseTimelineRequestSchema,
    response: caseTimelineResponseSchema,
    capability: "cases.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists case evidence in chronological order."
  }),
  "case:summary": defineChannel({
    request: caseSummaryRequestSchema,
    response: caseSummaryResponseSchema,
    capability: "cases.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Computes case evidence counts and key entities."
  }),
  "case:search": defineChannel({
    request: caseSearchRequestSchema,
    response: caseSearchResponseSchema,
    capability: "cases.search",
    sensitivity: "medium",
    mutates: false,
    summary: "Full-text searches saved evidence within a case."
  }),
  "report:generate": defineChannel({
    request: reportGenerateRequestSchema,
    response: reportGenerateResponseSchema,
    capability: "reports.generate",
    sensitivity: "medium",
    mutates: true,
    summary: "Generates a cited PDF or Word report from a case or scan."
  }),
  "report:list": defineChannel({
    request: reportListRequestSchema,
    response: reportListResponseSchema,
    capability: "reports.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists generated local report artifacts."
  }),
  "report:open": defineChannel({
    request: reportOpenRequestSchema,
    response: reportOpenResponseSchema,
    capability: "reports.open",
    sensitivity: "medium",
    mutates: true,
    summary: "Opens one generated report by local report id."
  }),
  "tools:list": defineChannel({
    request: toolsListRequestSchema,
    response: toolsListResponseSchema,
    capability: "tools.readCatalog",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists locally configured WSL tools."
  }),
  "tools:detect": defineChannel({
    request: toolsDetectRequestSchema,
    response: toolsDetectResponseSchema,
    capability: "tools.detect",
    sensitivity: "medium",
    mutates: true,
    summary: "Checks WSL for installed tool executables using fixed argv."
  }),
  "tools:launch": defineChannel({
    request: toolsLaunchRequestSchema,
    response: toolsLaunchResponseSchema,
    capability: "tools.launch",
    sensitivity: "medium",
    mutates: true,
    summary: "Launches one WSL tool, captures output, and applies the active authorization gate."
  }),
  "catalog:add": defineChannel({
    request: catalogAddRequestSchema,
    response: catalogAddResponseSchema,
    capability: "tools.writeCatalog",
    sensitivity: "medium",
    mutates: true,
    summary: "Adds one local WSL tool catalog entry."
  }),
  "catalog:update": defineChannel({
    request: catalogUpdateRequestSchema,
    response: catalogUpdateResponseSchema,
    capability: "tools.writeCatalog",
    sensitivity: "medium",
    mutates: true,
    summary: "Updates one local WSL tool catalog entry."
  }),
  "auth:create": defineChannel({
    request: authCreateRequestSchema,
    response: authCreateResponseSchema,
    capability: "tools.authorize",
    sensitivity: "medium",
    mutates: true,
    summary: "Creates an exact-target authorization for an active tool tier."
  }),
  "auth:list": defineChannel({
    request: authListRequestSchema,
    response: authListResponseSchema,
    capability: "tools.readAuthorizations",
    sensitivity: "medium",
    mutates: false,
    summary: "Lists local tool target authorizations."
  }),
  "scan:run": defineChannel({
    request: scanRunRequestSchema,
    response: scanRunResponseSchema,
    capability: "scans.run",
    sensitivity: "medium",
    mutates: true,
    summary: "Runs an authorized nmap scan through the WSL launcher and persists parsed topology."
  }),
  "scan:get": defineChannel({
    request: scanGetRequestSchema,
    response: scanGetResponseSchema,
    capability: "scans.read",
    sensitivity: "medium",
    mutates: false,
    summary: "Reads one persisted nmap scan with parsed hosts and ports."
  }),
  "scan:topology": defineChannel({
    request: scanTopologyRequestSchema,
    response: scanTopologyResponseSchema,
    capability: "scans.readTopology",
    sensitivity: "medium",
    mutates: false,
    summary: "Builds deterministic topology for one persisted scan."
  })
} as const;

export type IpcChannel = keyof typeof IPC;
export type IpcRequest<TChannel extends IpcChannel> = z.input<(typeof IPC)[TChannel]["request"]>;
export type IpcParsedRequest<TChannel extends IpcChannel> = z.infer<(typeof IPC)[TChannel]["request"]>;
export type IpcResponse<TChannel extends IpcChannel> = z.infer<(typeof IPC)[TChannel]["response"]>;
