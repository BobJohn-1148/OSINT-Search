# Phase 1 — API-key vault and provider config

**Goal:** encrypted-at-rest key store and AI provider/model configuration with
per-agent switching, all key reads audited.
**Depends on:** 0.
**Read first:** `CLAUDE.md`, `REACHER_PLAN.md` (Phase 1).

## Build
1. Vault: encrypt secrets at rest (Electron `safeStorage`, fallback libsodium).
   One read gate; every read writes an audit event.
2. Settings → API keys: add / test / revoke / list per source (sources from
   `API_CATALOG.md`).
3. Provider adapters: OpenAI, xAI (Grok), Anthropic, local Ollama / LM Studio —
   one chat interface, model switchable. Per-agent selection stored in `agents`.
4. Connection test per provider and per key.

## Data / migrations
`002-vault.ts`: `api_keys(id, source, ciphertext, created_ts, last_used_ts)`.
`003-agents.ts`: `agents(id, name, provider, model, prompt_path, approval_mode)`;
seed `osint-agent` and `architect-agent` rows.

## IPC channels
`keys:add|test|revoke|list`, `providers:list|test`, `agents:list|setModel`.

## Tests
- a stored key round-trips and is ciphertext at rest (plaintext never on disk).
- reading a key writes an audit event with sensitivity `sensitive`.
- provider adapter honours the per-agent model selection.
- revoke removes the key and future reads fail closed.

## Exit criteria (phase-audit 1)
Key store/test/revoke works (mechanism: vault repo; test: "round-trips a key
encrypted"); per-agent provider+model switch works (test: "selects model per
agent"); key reads audited (test above).

## Verify / Commit
As Phase 0, `phase-audit 1`; branch `phase/01-vault-providers`; reviewer PASS.
