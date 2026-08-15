/**
 * Tool handlers keep WSL actions behind typed IPC so the renderer can request a
 * launch without gaining process access. If this layer accepted loose payloads,
 * argv safety and authorization metadata would drift from the central registry.
 */
import type {
  AuthCreateRequest,
  AuthCreateResponse,
  AuthListResponse,
  CatalogAddRequest,
  CatalogAddResponse,
  CatalogUpdateRequest,
  CatalogUpdateResponse,
  ToolsDetectRequest,
  ToolsDetectResponse,
  ToolsLaunchRequest,
  ToolsLaunchResponse,
  ToolsListResponse
} from "../../../shared/schemas/tools.js";
import type { ToolsService } from "../../tools/tools-service.js";

export function createToolsHandlers(toolsService: ToolsService) {
  return {
    "tools:list": (): ToolsListResponse => ({
      tools: toolsService.listCatalog()
    }),
    "tools:detect": async (request: ToolsDetectRequest): Promise<ToolsDetectResponse> => ({
      installed: await toolsService.detect(request.wslDistro)
    }),
    "tools:launch": async (request: ToolsLaunchRequest): Promise<ToolsLaunchResponse> => ({
      run: await toolsService.launch(request)
    }),
    "catalog:add": (request: CatalogAddRequest): CatalogAddResponse => ({
      tool: toolsService.addCatalog(request)
    }),
    "catalog:update": (request: CatalogUpdateRequest): CatalogUpdateResponse => ({
      tool: toolsService.updateCatalog(request)
    }),
    "auth:create": (request: AuthCreateRequest): AuthCreateResponse => ({
      authorization: toolsService.createAuthorization(request)
    }),
    "auth:list": (): AuthListResponse => ({
      authorizations: toolsService.listAuthorizations()
    })
  };
}
