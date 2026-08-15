# Reacher — agent hub

Reacher's AI is a **hub**, not a swarm. Agents are defined here as versioned
prompt files. Each agent has its own provider/model, but they all share one
memory. Today there are two:

| Agent | Job | Default model |
|---|---|---|
| `osint-agent` | Runs general OSINT searches and pivots; corroborates and scores findings | switchable (OpenAI / xAI Grok / local Ollama-LM Studio) |
| `architect-agent` | Knows the whole codebase; turns feature requests into built, tested, pushed features | ChatGPT **Codex** |

## Switching models / providers
Every agent's provider and model are chosen at runtime in Settings → Agents.
Supported providers to wire: OpenAI, xAI (Grok), Anthropic, and local via
Ollama / LM Studio. The prompt file is provider-agnostic — only the adapter
changes. Store per-agent selection in the `agents` table; never hardcode a model
inside a prompt.

## Shared memory (all providers, one brain)
Every agent reads and writes a single shared store, regardless of which company's
model is running it. Design for Reacher: a local SQLite table
`agent_memory(scope, key, value, source_agent, cited_run, confidence, ts)` that
every agent queries on start and appends to on finish. This mirrors the
cross-provider shared-memory setup from the Dark Horse repo — confirm the exact
mechanism (the GitHub-app-backed memory you added) once we have read access to
that repo, then port it rather than reinventing.

## Prompts as files
Prompts live here as `.md` so they're versioned and diffable. The app loads the
active prompt per agent at run time. Edit the file, commit, and the agent's
behaviour changes — no code change.

## Scope
These prompts are written lean, without generic model refusals, so the OSINT
agent actually investigates. The one operating constraint kept in the prompt is
lawful, open-source collection on targets you own or are authorized to assess.
Active/offensive actions (scanning, tool launches) stay behind the app's
target-authorization record — that gate is your legal protection, not an AI
guardrail, and it's configurable per phase.
