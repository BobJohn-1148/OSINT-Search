/**
 * Case handlers keep evidence saving on the typed IPC path so every productive
 * surface can save without learning SQL. If search saved observations through a
 * shortcut, later timelines and reports would miss audit-friendly provenance.
 */
import type { CasesRepository } from "../../../db/repositories/cases-repository.js";
import type {
  CaseDocumentsListRequest,
  CaseDocumentsListResponse,
  CaseDocumentUpsertRequest,
  CaseDocumentUpsertResponse,
  CaseAddItemRequest,
  CaseAddItemResponse,
  CaseSearchRequest,
  CaseSearchResponse,
  CaseSummaryRequest,
  CaseSummaryResponse,
  CaseTimelineRequest,
  CaseTimelineResponse,
  CasesCreateRequest,
  CasesCreateResponse,
  CasesGetRequest,
  CasesGetResponse,
  CasesListResponse,
  CasesUpdateRequest,
  CasesUpdateResponse
} from "../../../shared/schemas/cases.js";

export function createCasesHandlers(casesRepository: CasesRepository) {
  return {
    "cases:create": (request: CasesCreateRequest): CasesCreateResponse => ({
      case: casesRepository.create(request.title, request.tags)
    }),
    "cases:list": (): CasesListResponse => ({
      cases: casesRepository.list()
    }),
    "cases:get": (request: CasesGetRequest): CasesGetResponse => casesRepository.get(request.caseId),
    "cases:update": (request: CasesUpdateRequest): CasesUpdateResponse => ({
      case: casesRepository.update(request)
    }),
    "case:addItem": (request: CaseAddItemRequest): CaseAddItemResponse => ({
      item: casesRepository.addItem({
        caseId: request.caseId,
        itemType: request.itemType,
        refId: request.refId,
        title: request.title,
        text: request.text,
        sourceTs: request.sourceTs,
        metadata: request.metadata
      })
    }),
    "case:timeline": (request: CaseTimelineRequest): CaseTimelineResponse => ({
      items: casesRepository.timeline(request.caseId)
    }),
    "case:summary": (request: CaseSummaryRequest): CaseSummaryResponse => ({
      summary: casesRepository.summary(request.caseId)
    }),
    "case:search": (request: CaseSearchRequest): CaseSearchResponse => ({
      items: casesRepository.search(request.caseId, request.query)
    }),
    "case:documents:list": (request: CaseDocumentsListRequest): CaseDocumentsListResponse => ({
      documents: casesRepository.listDocuments(request.caseId)
    }),
    "case:document:upsert": (request: CaseDocumentUpsertRequest): CaseDocumentUpsertResponse => ({
      document: casesRepository.upsertDocument(request)
    })
  };
}
