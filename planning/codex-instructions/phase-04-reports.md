# Phase 4 — Report system (PDF and Word)

**Goal:** generate a polished PDF and Word report from a case or a scan.
**Depends on:** 3.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 4).

## Build
1. Report template: header, cited observations + derived summary (summary
   references only cited observations), scans/topology section, host list.
2. PDF renderer (pdfkit or headless-render-to-PDF) and Word (docx). **Parallelize:
   one sub-agent for PDF, one for Word, shared template model.**
3. Reports list surface; generation writes an audit event.

## Data / migrations
`008-reports.ts`: `reports(id, case_id, format, path, created_ts)`.

## IPC channels
`report:generate` (case_id|scan_id, format), `report:list`, `report:open`.

## Tests
- PDF and DOCX are produced from a case fixture.
- the report includes each finding's cited source.
- generation writes an audit event.
- output is deterministic for a fixed fixture (stable ordering).

## Exit criteria (phase-audit 4)
Produce PDF and Word from a case (mechanism: report service; test: "renders a PDF
and a DOCX from a case fixture"); citations present; generation audited.

## Verify / Commit
`phase-audit 4`; branch `phase/04-reports`; reviewer PASS.
