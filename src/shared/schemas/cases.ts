/**
 * Case schemas are shared so search, cases, and later reports save the same
 * evidence shape. If each surface invented its own save payload, the invariant
 * that everything can be saved to a case would fracture immediately.
 */
import { z } from "zod";
import { caseItemTypeValues, caseStatusValues } from "../types/cases.js";

export const caseRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(caseStatusValues),
  createdTs: z.string().min(1),
  updatedTs: z.string().min(1),
  tags: z.array(z.string().min(1))
});

export const caseItemSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  itemType: z.enum(caseItemTypeValues),
  refId: z.string().nullable(),
  title: z.string().min(1),
  text: z.string().min(1),
  sourceTs: z.string().min(1),
  metadata: z.record(z.string(), z.unknown())
});

export const caseSummarySchema = z.object({
  caseId: z.string().min(1),
  counts: z.record(z.string(), z.number().int().min(0)),
  keyEntities: z.array(z.object({
    entity: z.string().min(1),
    strength: z.number().int().min(1),
    count: z.number().int().min(1)
  }))
});

export const caseDocumentSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  name: z.string().min(1),
  scope: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  body: z.string(),
  createdTs: z.string().min(1),
  updatedTs: z.string().min(1)
});

export const casesCreateRequestSchema = z.object({
  title: z.string().min(1),
  tags: z.array(z.string().min(1)).default([])
});
export const casesCreateResponseSchema = z.object({ case: caseRecordSchema });

export const casesListRequestSchema = z.object({});
export const casesListResponseSchema = z.object({ cases: z.array(caseRecordSchema) });

export const casesGetRequestSchema = z.object({ caseId: z.string().min(1) });
export const casesGetResponseSchema = z.object({
  case: caseRecordSchema.nullable(),
  items: z.array(caseItemSchema)
});

export const casesUpdateRequestSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().min(1).optional(),
  status: z.enum(caseStatusValues).optional(),
  tags: z.array(z.string().min(1)).optional()
});
export const casesUpdateResponseSchema = z.object({ case: caseRecordSchema });

export const caseAddItemRequestSchema = z.object({
  caseId: z.string().min(1),
  itemType: z.enum(caseItemTypeValues),
  refId: z.string().nullable().optional(),
  title: z.string().min(1),
  text: z.string().min(1),
  sourceTs: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});
export const caseAddItemResponseSchema = z.object({ item: caseItemSchema });

export const caseTimelineRequestSchema = z.object({ caseId: z.string().min(1) });
export const caseTimelineResponseSchema = z.object({ items: z.array(caseItemSchema) });

export const caseSummaryRequestSchema = z.object({ caseId: z.string().min(1) });
export const caseSummaryResponseSchema = z.object({ summary: caseSummarySchema });

export const caseSearchRequestSchema = z.object({
  caseId: z.string().min(1),
  query: z.string().min(1)
});
export const caseSearchResponseSchema = z.object({ items: z.array(caseItemSchema) });

export const caseDocumentsListRequestSchema = z.object({ caseId: z.string().min(1) });
export const caseDocumentsListResponseSchema = z.object({ documents: z.array(caseDocumentSchema) });

export const caseDocumentUpsertRequestSchema = z.object({
  documentId: z.string().min(1).optional(),
  caseId: z.string().min(1),
  name: z.string().min(1),
  scope: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  body: z.string().default("")
});
export const caseDocumentUpsertResponseSchema = z.object({ document: caseDocumentSchema });

export type CaseRecord = z.infer<typeof caseRecordSchema>;
export type CaseItem = z.infer<typeof caseItemSchema>;
export type CaseSummary = z.infer<typeof caseSummarySchema>;
export type CaseDocument = z.infer<typeof caseDocumentSchema>;
export type CasesCreateRequest = z.infer<typeof casesCreateRequestSchema>;
export type CasesCreateResponse = z.infer<typeof casesCreateResponseSchema>;
export type CasesListResponse = z.infer<typeof casesListResponseSchema>;
export type CasesGetRequest = z.infer<typeof casesGetRequestSchema>;
export type CasesGetResponse = z.infer<typeof casesGetResponseSchema>;
export type CasesUpdateRequest = z.infer<typeof casesUpdateRequestSchema>;
export type CasesUpdateResponse = z.infer<typeof casesUpdateResponseSchema>;
export type CaseAddItemRequest = z.infer<typeof caseAddItemRequestSchema>;
export type CaseAddItemResponse = z.infer<typeof caseAddItemResponseSchema>;
export type CaseTimelineRequest = z.infer<typeof caseTimelineRequestSchema>;
export type CaseTimelineResponse = z.infer<typeof caseTimelineResponseSchema>;
export type CaseSummaryRequest = z.infer<typeof caseSummaryRequestSchema>;
export type CaseSummaryResponse = z.infer<typeof caseSummaryResponseSchema>;
export type CaseSearchRequest = z.infer<typeof caseSearchRequestSchema>;
export type CaseSearchResponse = z.infer<typeof caseSearchResponseSchema>;
export type CaseDocumentsListRequest = z.infer<typeof caseDocumentsListRequestSchema>;
export type CaseDocumentsListResponse = z.infer<typeof caseDocumentsListResponseSchema>;
export type CaseDocumentUpsertRequest = z.infer<typeof caseDocumentUpsertRequestSchema>;
export type CaseDocumentUpsertResponse = z.infer<typeof caseDocumentUpsertResponseSchema>;
