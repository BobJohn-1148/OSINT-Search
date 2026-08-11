# Reacher — phased build plan

Every phase is **independently pushable and auditable**. A phase is done only when
its exit criteria each pin to a real mechanism in `src/` and a named test, and its
`phase-audit` block passes. Phases list their dependencies; independent phases can
run in parallel.

This plan is the backbone. `CLAUDE.md` holds the invariants; `API_CATALOG.md`
holds the data sources each phase wires.

## Stack decision

Electron + React + TypeScript, SQLite (better-sqlite3, STRICT tables, numbered
migrations), IPC with zod schemas and `Result<T>`. Rationale: lets us salvage
Dark Horse code directly, is the right fit for a Windows desktop app that shells
out to WSL, and keeps everything local-first with no server.

## Data model (grows by phase)

- `cases`, `case_items` (polymorphic: observation | scan | tool_run | agent_run | note | report)
- `observations` (entity, type, value, source, run_id, confidence) + `entity_links` (corroboration)
- `sources` (connector registry: id, category, tier passive|active, key_required)
- `scans` (nmap), `hosts`, `ports`
- `tool_runs` (catalog_id, argv, wsl_distro, stdout_ref, status, authorization_id)
- `agents`, `agent_runs`, `agent_steps`, `agent_memory` (shared, cross-provider)
- `api_keys` (encrypted at rest), `authorizations` (target exact-match, tier, expiry)
- `audit_events` (append-only via trigger), `watchlist` (credential monitoring), `reports`

## Security / authorization model

Passive OSINT is ungated. Active actions (port scans, active recon tools,
exploitation) require an `authorizations` row whose `target` matches the target
string exactly (no CIDR widening — scanning `192.168.1.0/24` needs an auth for
that literal string). Every sensitive action writes an `audit_events` row by
trigger. Keys are read only through the vault gate.

## Phases

| # | Phase | Depends on |
|---|---|---|
| 0 | Foundation and app shell | — |
| 1 | API-key vault and provider config | 0 |
| 2 | Search core and correlation engine (passive) | 1 |
| 3 | Cases and evidence system | 2 |
| 4 | Report system (PDF and Word) | 3 |
| 5 | AI agent hub — OSINT agent + shared memory | 2, 3 |
| 6 | Architect agent (Codex) | 5 |
| 7 | Tools hub and WSL launcher | 1 |
| 8 | Network scan and topology (nmap) | 7, 4 |
| 9 | Analyzers (evtx, pcap, dork, MAC, vuln) | 4 |
| 10 | Credential monitoring and scraping | 2, 3 |
| 11 | Reverse image and username depth | 2, 5, 7 |
| 12 | Dashboard, audit review, packaging | all |

---

### Phase 0 — Foundation and app shell
Scaffold Electron + React + TS; SQLite + migration runner; IPC transport with
`Result<T>` and zod; settings store; dark console theme + Reacher branding/icon;
collapsible sidebar and all routes as stubs; append-only `audit_events` skeleton.
**Exit:** app boots and navigates; a stub action writes an audit event; theme
tokens resolve; typecheck/lint/tests green; `phase-audit 0` passes.

### Phase 1 — API-key vault and provider config
Encrypted-at-rest key store; Settings → API keys (add/test/revoke per source);
AI providers (OpenAI, xAI, Anthropic, Ollama/LM Studio) with per-agent model
selection and connection tests. Key reads audited.
**Exit:** store/test/revoke a key; select provider+model per agent; sensitive
reads produce audit rows; tests for vault + provider adapters.

### Phase 2 — Search core and correlation engine (passive)
Seed types (email, IP, phone, username, domain, business, MAC; image deferred to
11). Connector framework; parallel fan-out emitting live per-source arrival
events; correlation tree model; entity extraction; cross-reference + strength
scoring by corroboration count; clickable data points; "search further" pivots;
time-of-day greeting and loading animation. Wire first free sources from the
catalog (WHOIS/RDAP, DNS, crt.sh, ipinfo/InternetDB, AbuseIPDB, XposedOrNot,
Holehe, theHarvester, macvendors, NVD).
**Exit:** run a search, sources stream in, tree builds, overlaps score, nodes
save; connector interface documented; tests for correlation merge + scoring.

### Phase 3 — Cases and evidence system
Case CRUD; save any item to a case; evidence timeline; case summary (counts + key
entities by strength); tags; FTS across a case.
**Exit:** create case, save from search, timeline renders, summary computes,
full-text search works; tests.

### Phase 4 — Report system (PDF and Word)
Generate PDF and Word (docx) from a case or a scan, templated (findings, cited
observations + derived summary, topology, hosts). Reports list; generation
audited.
**Exit:** produce PDF and Word from a case; report row saved + audited;
deterministic template tests.

### Phase 5 — AI agent hub (OSINT agent) + shared memory
Agent runtime (job queue / state machine); load `osint-agent` prompt from
`planning/agent-prompts`; provider/model switch; run view (live steps, cited
findings, loading animation); run history; send-to-agent from search; shared
`agent_memory` (cross-provider); cited-observations rule enforced (claims need
sources, grade derived).
**Exit:** run the OSINT agent on a seed; steps stream; findings cited and saved to
case + memory; another agent reads the memory; tests for step format + memory
sharing.

### Phase 6 — Architect agent (Codex)
`architect-agent` wired to ChatGPT Codex; reads codebase + plan; answers codebase
questions and drafts/implements features behind confirm dialogs; shares memory.
**Exit:** architect answers a codebase question and drafts a feature plan;
provider switch works; actions audited.

### Phase 7 — Tools hub and WSL launcher
Tool catalog (name, description, install command, official link, category, tier);
curated entries (reconftw, Argus, Maigret, Blackbird, Photon, theHarvester, nmap
+ a Kali set); install-command display/copy; **Launch in WSL** via `wsl.exe` with
fixed argv and `shell: false`; output captured to a run and attachable to a case;
detect installed tools; active tools require an authorization.
**Exit:** launch a passive tool in WSL and capture output to a case; add/edit a
catalog entry; active tools blocked without authorization; tests for launcher argv
+ gate.

### Phase 8 — Network scan and topology (nmap)
Scan builder (types, options, timing); nmap via the WSL launcher with `-oX -`
(XML on stdout); XML parser → hosts/ports; host table; deterministic topology
(hop distance as ring index, seeded by a hash of the address); export into a
report; CIDR authorization by exact-match string.
**Exit:** scan an authorized target, parse hosts, render topology, export a
report; tests for XML parser + layout determinism + authorization.

### Phase 9 — Analyzers
9a Windows Event Log analyzer (`.evtx` via `wevtutil.exe`, fixed argv);
9b PCAP analyzer (tshark via launcher, file import only — no live capture);
9c Google dork generator; 9d MAC OUI lookup; 9e Vulnerability lookup (NVD/CVE by
product + version, e.g. "Cisco Catalyst 3750-E"). Each saves findings to a
case/report.
**Exit:** each analyzer imports/parses and saves; vuln lookup maps a product to
CVEs; tests per analyzer.

### Phase 10 — Credential monitoring and scraping
Breach/credential checks (XposedOrNot free; HIBP, LeakCheck, DeHashed as paid
key slots); watchlist of emails/domains with scheduled rechecks; paste/stealer
monitoring where free; exposure alerts; save to case.
**Exit:** add a watch target, run a check, alert on exposure, save; scheduled
recheck fires; tests.

### Phase 11 — Reverse image and username depth
Reverse image (upload → sources; browser-driven where no free API exists);
deep username cross-referencing (Maigret/Blackbird + OSINT agent); image/face
pivots into the correlation tree.
**Exit:** upload an image → results into tree/case; username sweep corroborates
across sites; tests.

### Phase 12 — Dashboard, audit review, packaging
Dashboard (recent activity, active cases, quick search, agent status, watch
alerts); audit log viewer with filters; settings polish; Windows installer with
the Reacher icon; performance pass.
**Exit:** dashboard live; audit filterable; packaged signed-or-unsigned build
runs; final full audit passes.

## Notes

- 1→2→3→4 is the spine. 5 needs 2+3. 7 unlocks 8 and feeds 11. 9 is largely
  independent after 4. 10 needs 2+3.
- Reverse image has no free official API (Google Lens/Images are browser-only), so
  Phase 11 leans on browser automation or freemium keys in the vault.
- HIBP's API is paid (from ~$4.39/mo); the free spine uses XposedOrNot + Holehe,
  with paid keys slotting into the vault later.
