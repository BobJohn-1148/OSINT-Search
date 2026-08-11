# Integration — Sherlock-style CLI tools (username, email, phone)

CLI tools that take a seed, run in WSL, and print parseable results, so each wraps
as a `SourceConnector` like Sherlock: fixed argv, `shell:false`, seed as its own
argv element (injection-inert), stdout parsed into observations that stream into
the tree, passive tier. Each hit is single-source until the merger corroborates it.
All of these run through the Phase 7 launcher and obey `STABILITY.md` (bounded
concurrency, batched emit, killable, output-capped).

## Username seed
| Tool | Install (WSL) | Run | Parse |
|---|---|---|---|
| Sherlock | `pipx install sherlock-project` | `sherlock <user> --print-found --csv --folderoutput <dir>` | `^\[\+\]\s+(.+?):\s+(https?://\S+)$` |
| Maigret | `pipx install maigret` | `maigret <user> --json simple --folderoutput <dir>` | JSON report |
| Blackbird | `git clone …/blackbird && pip install -r requirements.txt` | `python blackbird.py -u <user> --json` | JSON file |

## Email seed
| Tool | Install (WSL) | Run | Parse |
|---|---|---|---|
| Holehe | `pipx install holehe` | `holehe --only-used --no-color <email>` | `^\[\+\]\s+(\S+)` |
| Mosint | `go install github.com/alpkeskin/mosint/v3/cmd/mosint@latest` | `mosint <email> -o out.json -s` | JSON (some modules need keys) |
| h8mail | `pipx install h8mail` | `h8mail -t <email> --json out.json` | JSON; breach + password hunting |
| GHunt | `pipx install ghunt` | `ghunt email <email> --json out.json` | JSON; needs one-time cookie auth |

## Phone seed
| Tool | Install (WSL) | Run | Parse |
|---|---|---|---|
| ignorant | `pipx install ignorant` | `ignorant --no-color <cc> <national>` | `^\[\+\]\s+(\S+)` |
| PhoneInfoga | Go build / docker | `phoneinfoga scan -n "<e164>"` | scanner output/JSON; stable but unmaintained |

## Connectors already stubbed
`src/tools/sherlock.ts` (username), `src/tools/holehe.ts` (email),
`src/tools/ignorant.ts` (phone). Maigret/Blackbird/Mosint/h8mail/GHunt/PhoneInfoga
follow the same pattern — prefer each tool's `--json`/`--csv` when it has one.

## Fan-out (Phase 2)
- username -> sherlock + maigret + blackbird
- email    -> holehe (+ mosint / h8mail / ghunt when keys/auth present)
- phone    -> ignorant (+ phoneinfoga)
Run in parallel with the HTTP sources under the STABILITY.md concurrency cap.
