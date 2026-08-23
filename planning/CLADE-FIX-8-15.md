# Clade to fix — 8/15 redesign spec + progress

Parsed from Jack's Google Doc "Clade to fix 8/15" (the live queue). Workflow:
Jack adds items to that Doc; Claude reads it, builds, and **removes each finished
item from the Doc** so what remains is what's left. This file is Claude's durable
mirror for resuming across sessions. Status: [ ] todo, [~] in progress, [x] done.

Prime directive still applies: utmost quality, tests + audits, theme tokens only,
match house style. Verify each surface with `npm run typecheck && lint && test`.

---

# BATCH 2 — 8/16 reference-image reskins (NEW, big — in progress)

Jack sent annotated reference screenshots for six surfaces plus a major agents
overhaul, with two component specs (chain-of-thought, Cursor-style model picker).
KEY IMPLEMENTATION DECISION: those two components ship as shadcn/Tailwind/
framer-motion/radix. This app is **plain React + theme-token CSS (no Tailwind, no
shadcn)**; the no-raw-colors audit covers the renderer. So reimplement the same
look/behavior **natively** (theme tokens + existing `--duration-*/--ease-*` motion
tokens) instead of adding Tailwind — do NOT copy-paste those files verbatim.

Order of attack (Jack's list order, agents last as it is the largest): B1 Dashboard
→ B2 Search → B3 Network scan refine → B4 Tools → B5 Analyzers → B6 Agents.

## B1. Dashboard (ref: dark panel dashboard) — DONE
- [x] "Recent Activity" feed: icon-led rows (per seed-type mail/phone/globe/user, Bot for runs), title + `type / status / timestamp`; succeeded agent runs highlighted.
- [x] "Agent fleet monitor & usage": SVG donut gauge (working/total %), "Fleet: N", per-agent rows (status dot, Active/Idling, derived load bar from run counts).
- [x] "Watchlist alert age status": three bars — New (<1w) red, Aging (1w+) amber, Addressed (acknowledged) green — + big Total alerts number.
- [x] "Watchlist" table: Type, Target, Last check, "Check now", delete (add-watch toggle kept).
- [x] "Exposure alerts": red warning rows (message + timestamp + open-source link).
- [x] "Exposures" table: Source (monogram), First seen, Description. Masonry 3→2→1 col responsive. 203 tests green.

## B2. Search (ref: empty "Good Morning" + results intelligence board) — DONE
- [x] Empty state: centered time-based "Good {morning/afternoon/evening}, User." + "Ready when you are." + big box `Enter seed, image, or description… (Auto-detect active)` with detected-type pill + attach-image; Low/Standard/Deep depth segmented control.
- [x] Right rail: Cases (open cases), Data monitoring (watchlist entries "checked"), Agent plugins (name + provider/model, osint-agent highlighted). Loaded crash-safe via `asArray` against harness stubs.
- [x] Results: "Search intelligence summary" (Unique facts / Corroborated / Single source + "N observations: N returned / M failed"), computed in `computeBoard()`.
- [x] Cross-reference board (corroborated entities + source counts + band pill).
- [x] Person profile card (monogram avatar, subject, top facts, View source / Save record).
- [x] Source plugins list (green/red per-source dots + count). Corroborated Facts table (Fact type, Detail, Status). Verified Intelligence Feed (type, source, Confirmed/Observed).
- [x] Depth: Low hides cross-ref/feed, Standard shows all, Deep extends the feed. Correlation tree + node details kept for pivot/save/send-to-agent (test-critical). Route/pivot tests updated to the greeting heading. 203 tests green.

## B3. Network scan (ref: terminal topology) — DONE
- [x] Topology framed as a terminal panel (traffic-light dots + `local-nmap/topology` + `$ nmap …` command line derived from options + `# scan complete` comment) around the ring map.
- [x] Hosts as expandable rows (chevron rotates, platform glyph inferred from services, IP + hostname, status dot; expands to a ports table). Port summary string kept visible for tests.
- [x] Builder toggles kept; Output terminal kept. 203 tests green.

## CONSOLIDATION (2026-08-16): two diverged copies → Downloads canonical — DONE
- [x] Root cause of "my changes don't show up": a frozen packaged `Reacher.exe` (9:56 AM build) was the "Reacher" shortcut target while the live source was current. Repointed ALL four shortcuts (Desktop + Start Menu, "Reacher" and "Reacher (live)") to `Launch-Reacher.vbs` → `npm start` from the canonical Downloads copy.
- [x] Discovered the Desktop copy is a *diverged Codex branch* (git `phase/15-passive-osint-extras`), not a duplicate. Jack chose Downloads canonical.
- [x] Ported Codex's unique tool catalogs into canonical as migrations 022 (3uTools), 023 (iOS-mobile: idevicebackup2/mvt-ios/iLEAPP/pymobiledevice3/ifuse/…), 024 (RevShells lab). Registered + test-covered in migrations.test.ts.
- [x] Methodology map already present in canonical (superset — has methodology-resources.ts Codex lacks); nothing to re-port.
- [x] Desktop copy marked RETIRED via marker file (kept for its git history; can be deleted on Jack's say-so). Frozen `release/win-unpacked` no longer launched by any shortcut.

## B4. Tools (ref: MITRE-style category columns + running output) — DONE
- [x] MITRE-style category board: `toolColumns` groups the filtered catalog into one scrolling column per category (`prettyCategory` labels: Reconnaissance, Execution, Credential access, Forensics, Privilege escalation, Mobile, Lab, …). Each card = tier dot + name + id, selected/running/installed states.
- [x] Launch a tool → docked "Running tool output: <tool>" terminal pinned to the bottom, with minimize / expand / close controls; card shows a spinning Loader2 while running.
- [x] Kept the showcase (Launch tool, target/case, install/link) + catalog add/edit + Detect. Now surfaces the ported 3uTools / iOS-mobile / RevShells catalog rows. 203 tests green.
- Note: authorization/target section not removed (the active-scan gate is a legal invariant per CLAUDE.md §7); target field kept for launch scope.

## B5. Analyzers (ref: teal-glow console) — DONE
- [x] Mode tabs now teal-glow pills (accent border + box-shadow glow on hover/selected); auto-fit grid for all 8 modes incl. Email/phishing.
- [x] Drop zones glow teal on hover/drag (inset + outer accent shadow). File Upload zone kept (FileDropField).
- [x] Findings render as INFO/WARN/CRIT cards (severity icon + colored left border + `LEVEL: title | analyzer` + source) in an "Analysis stream — findings" column.
- [x] Bottom console status bar with a live status light (green idle / pulsing amber busy) + "Console ready." 203 tests green (dork finding test updated to the card format).

## B6. AI agents (ref: pixel office + per-agent cards + CoT + model picker) — DONE (increment 1)
- [x] Per-agent **card deck** (`agent-cards.tsx` → AgentCardDeck): provider-logo avatar, name, callsign, role/tagline, status light, provider/model + effort badges, **Test API** button (providers:test), **Chat** + expand actions. Additive above the console; den + fallback + persona tests untouched.
- [x] Click a card / Chat / expand → **AgentModal**: talk to the agent (textarea → `agent:run` with an inferred seed), model switcher (`agents:setModel` over provider.availableModels), effort switcher (`agents:setEffort`), Test API, saved memory (by sourceAgent), and the prompt path + approval mode.
- [x] **Chain-of-thought** (`chain-of-thought.tsx`): native collapsible timeline of the agent's `agent:step` events (queued/running/complete/error + summary + sources) — reimplemented on theme tokens, no Tailwind/Radix.
- [x] **Provider logos** (`provider-logo.tsx`): inline SVG marks for anthropic/openai/xai/ollama/lm-studio, tinted via `currentColor` + `.provider-<id>` theme tokens (no raw colors, no trademark art).
- [x] Model switcher done as a native select (Cursor-style flyout not reproduced — functional model+effort switching covers the intent). 2 new deck tests; 205 tests green.
- DEFERRED (polish): hand-drawn pixel-sprite characters / Star-Office pixel room (the 3D den + card avatars stand in for now); the fancy Cursor-style side-panel model flyout.

## 1. Dashboard — DONE
- [x] Removed the "Active cases" panel.
- [x] Removed the username quick-lookup.
- [x] "Add watch" is a toggle button that reveals the form as a dropdown; closes on save.
- [x] Exposures + alerts now render as cards with a monogram "logo" tile + external link.
- [x] Replaced active-cases area with agent connection statuses (per-agent light + task) and online counts.

## 2. Search
- [x] Greeting says "good evening" (time-based) — already present.
- [x] Auto-detect seed type (dropdown removed; `detectSeedType` infers; pill shows result).
- [x] Seed input blank by default (no example.com); placeholder guides.
- [x] "Run Ocean agent" button added (runs osint-agent on the current seed).
- [x] Reverse image: field/buttons removed; one Paperclip attach icon picks + reverse-searches.
- [x] Remove username sweep from Search.
- [ ] Collapsible: let the cases/side sections collapse away entirely. (DEFERRED)
- [ ] Website preview: default zoomed-out to desktop view; add external-link open. (DEFERRED — need to locate/confirm the preview component)
- [ ] Auto-pivot: observations auto-run the scraper recursively. (DEFERRED — large feature)
- [ ] Cross-source match: linkage graph across sites. (DEFERRED — large feature)

## 3. Cases — DONE
- [x] VS Code-style file tree in the explorer rail: Documents / Evidence / Reports as collapsible folders (chevron + count) under the case root, above the editor.
- [x] View any node in the central pane: documents open the editor; evidence opens a read-only viewer (title, timestamp, full text, metadata table); reports open a viewer (path + createdTs + Open).
- [x] Edit documents in the Cases tab (editor kept: name/scope/dates/body + Save/New). Case tools (evidence filter + report generation) moved to the side stack. 205 tests green (evidence/report tests now click-to-view).

## 4. AI agents (Jack was explicitly frustrated here — get it right) — DONE
- [x] Name tag on each agent's desk: every agent now has its OWN desk (with monitor) and a screen-space name plate at desk height, accent-bordered per agent.
- [x] Each agent dressed differently: 6 distinct personas (hat shape + accessory + body colour); characters gained arms + a base so they read as figures, not floating boxes.
- [x] Brighter room: added a hemisphere fill light, raised ambient, a key light with shadows, and two accent point lights; floor rug + palette greens.
- [x] Textured / decorated background: four wall posters (GitHub, VS Code, Kali, Reacher) drawn to an offscreen canvas at runtime (no external asset, CSP-safe), framed and emissive-lit.
- [x] Hover: the old always-on transformed labels (which staggered) are replaced by a small always-on name plate + a rich hover/selected card that cross-fades via CSS.
- [x] Click an agent → the workbench is now an iOS-app-style panel (rounded-square avatar "app icon" with a live status dot, accent-tinted header) showing THAT agent's persona, controls, its own runs, and its own playbooks.
- [x] Removed the "AI agents" page title; the den is now the full-bleed hero (74vh).
- Verified: typecheck/lint/203 tests green (agents-view fallback + persona tests still pass; route test updated to anchor on the "Roster" heading).

## 5. Network scan — DONE
- [x] Target field kept clean; ports/scan-type/argv/checkmarks kept.
- [x] Topology as a connected nmap-style ring (circular host badges, highlighted target hub, animated spokes).
- [x] "Save scan to report" button, hidden until a scan is done.
- [x] Animated sweep progress bar while a scan runs; Run disabled during.

## 11. Taskbar shortcut → npm start (NEW) — DONE
- [x] `Launch-Reacher.vbs` runs `npm start` hidden; "Reacher (live)" Desktop + Start-menu shortcuts point at it. User should pin that and unpin the old exe.

## 12. Settings API diagnostics lights (NEW) — DONE
- [x] Green (test ok) / amber (error) / red (required + no key) / grey (untested) light on each API key row and provider row; set by keys:test / providers:test.

## 13. Phishing email analyzer (NEW, big — do not cut corners) — DONE
- [x] New "Email / phishing" analyzer mode: paste raw headers → offline parse.
- [x] Received hop chain reconstructed origin → recipient (each server + inferred org + timestamp + per-hop delay + total transit); origin IP/host surfaced.
- [x] SPF / DKIM / DMARC read from Authentication-Results and shown as green/amber/red/grey lights.
- [x] Sender identity: From / Return-Path / Reply-To with domains; every mismatch flagged as a spoofing indicator; sender domain + origin IP pivot into Search.
- [x] Additive, named phishing risk score (0–100) with each contributing reason listed.
- [x] Saved to case as findings + audited (`analyzer.email.headers`). Parser is in-process, no network, no execution.
- [x] Tests: 7 parser unit tests + 1 service integration test; typecheck/lint/verify/security all green (203 tests).

## 6. Tools
- [ ] Seamless: find any tool (Linux/Windows); Linux tools launch via WSL on click.
- [ ] Save tool outputs from the app.
- [ ] Remove the authorization/target section entirely.
- [ ] Restore category catalogs.
- [ ] No manual "is it installed" friction.
- [ ] (System) install WSL + all tools so all launch from the app. NOTE: full auto-install of WSL + dozens of tools needs admin + large downloads + is risky; do app-side redesign, then handle install carefully/interactively with Jack.

## 7. Analyzers — DONE
- [x] Drag-and-drop + browse zones for PCAP and event-log import (FileDropField).
- [x] Dork generator expanded from 5 to 22 categories, with per-line copy + "copy all" to clipboard.
- [x] Vulnerabilities: product datalist dropdown (22 common products) + version.
- [x] Cleaner import controls (drop zones replace bare path fields).

## 8. Mobile
- [ ] Connected-device UI: modern iPhone image; show collected/failed/data-collected + status.
- [ ] Status light: green=connected, yellow=error, red=none; refresh button.
- [ ] Auto-collect on plug-in; format iPhone data readably for OSINT; add more mobile tools.
- [ ] If possible, show the phone's wallpaper on the app's phone screen.

## 9. Social analyzer — DONE
- [x] Username blank by default.
- [x] Center-input search UX (type username → Analyze), results below.
- [x] Compact username→sites tree with status lights (verified=green, candidate=amber, absent=red). Legend + filter kept. (Note: catalog only emits "candidate" today, so all show amber until verification data flows in.)

## 10. Methodology map — DONE
- [x] Better colors (theme tokens, richer phase cards — no washed-out white).
- [x] Per phase: guides + YouTube videos + tools + resources via `resourcesForPhase()` (recon includes fake-name generators, temp-mail, burner numbers; vuln analysis has its own set). ResourceGroup component renders them.
