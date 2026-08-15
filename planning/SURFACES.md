# Remaining surfaces — design spec

Dark console theme, collapsible sidebar, everything save-to-case, obeys
STABILITY.md. These five complete the nav.

## Dashboard (home)
At-a-glance landing. Cards: active cases (count + latest), recent searches/agent
runs, agent status summary (N working / N idle, link to the ops den), watchlist
exposure alerts, WSL + provider health, and the most recent audit events. A quick
search box at top routes into Search. Every card click-throughs to its surface.

## Analyzers (hub of in-app parsers/generators; each saves to a case/report)
Left list selects the analyzer; main pane is its input + results.
- Event log analyzer: import `.evtx` via `wevtutil.exe` (fixed argv); filter by
  level / event id / source; timeline; save findings.
- PCAP analyzer: import `.pcap/.pcapng` via `tshark` (file import only, no live
  capture); protocol breakdown, conversations, notable flags.
- Google dork generator: target + category -> a query set; copy / open each.
- MAC lookup: OUI -> vendor (bundled IEEE DB offline + macvendors fallback).
- Vulnerability lookup: product + version -> CVEs via NVD; show severity + EPSS;
  save. Example: "Cisco Catalyst 3750-E".

## Settings
- API-key vault: add / test / revoke per source; reads audited.
- AI providers: pick provider + model per agent (OpenAI, xAI Grok, Anthropic,
  Ollama, LM Studio); connection test. Shared-memory config.
- WSL: choose distro; detect installed tools.
- Authorizations: manage active-scan target records + expiry.
- Appearance + behaviour: theme, "clean idle statuses" toggle, concurrency/perf
  caps (STABILITY.md defaults, editable).
- Data: database location, export / backup.

## Reports
List of generated reports (per case or scan) with format + date; generate from a
case/scan; template preview; open / export. Template = cited observations +
derived summary, topology, host table, findings. Generation is audited.

## Audit log
Append-only event viewer. Filter by type / date / target / sensitivity; free-text
search. Columns: time, actor, action, object, sensitivity, detail. Read-only;
exportable. Never rewrites history.
