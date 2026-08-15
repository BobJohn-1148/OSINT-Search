# Phase 11 — Reverse image and username depth

**Goal:** reverse-image search from an upload and deep username cross-referencing,
both feeding the correlation tree and cases.
**Depends on:** 2, 5, 7.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 11), `API_CATALOG.md`
(Reverse image, Username).

## Build
1. Reverse image: upload an image -> results. No free official API, so drive
   Google Lens / Yandex via browser automation; optional freemium API keys
   (OpenWeb Ninja, Bright Data) slot into the vault.
2. Username depth: orchestrate Maigret + Blackbird via the Phase 7 launcher plus
   the OSINT agent; corroborate accounts across sites into the strength model.
3. Image and username results become observations in the tree; save to case.

## Data / migrations
`014-images.ts`: `image_searches(id, path, source, result_ref, ts)`.

## IPC channels
`search:image` (upload), `search:usernameSweep`.

## Tests
- an uploaded image produces results into the tree/case.
- a username sweep corroborates the same account across sources.
- with no image API key, the browser path is used (no crash).

## Exit criteria (phase-audit 11)
Upload an image -> results into tree/case (mechanism: image service; test:
"adds image results as observations"); username sweep corroborates across sites.

## Verify / Commit
`phase-audit 11`; branch `phase/11-image-username`; reviewer PASS.
