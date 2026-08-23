/**
 * Audit listing is read-only but still schema-bound because the UI must never
 * infer audit shape from SQLite rows. If audit review accepted loose objects,
 * later filters could hide or mislabel sensitive history.
 */
import type { AuditRepository } from "../../../db/repositories/audit-repository.js";
import type {
  AuditListRequest,
  AuditListResponse,
  AuditQueryRequest,
  AuditQueryResponse
} from "../../../shared/schemas/audit.js";

export function createAuditHandlers(auditRepository: AuditRepository) {
  return {
    "audit:list": (request: AuditListRequest): AuditListResponse => ({
      events: auditRepository.list(request.limit)
    }),
    "audit:query": (request: AuditQueryRequest): AuditQueryResponse => ({
      events: auditRepository.query(request)
    })
  };
}
