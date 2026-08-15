# Agents tab — the 3D "ops den"

The Agents surface is a live 3D world rendered with Claw3D (an OpenClaw 3D engine:
https://github.com/iamlukethedev/Claw3D). Follow Claw3D's README for engine/scene/
entity setup; this doc is the Reacher-specific design on top of it.

## The world
A dim, cyber-security-themed den: server racks with blinking LEDs, monitors
scrolling logs, neon underglow, cable runs, a whiteboard of "targets." Dark
console palette + neon accents. One shared scene; agents live inside it.

## Agents as characters
Each agent (osint-agent, architect-agent, and any future ones) is a character
entity in the world. A billboarded label floats above each head showing its
status. Give them light personality: osint-agent wears the Reacher top hat;
architect-agent wears a hard hat.

## Status system (the point)
Each character's label is driven by the agent's live state:
- **working** -> the real task, e.g. "running Sherlock on jdoe", "correlating
  breach data", "pivoting on email". Character animates busy; accent glow + spinner ring.
- **idle** -> a random line from the idle joke pool, rotating every ~8-15s. Character
  slouches/wanders.
- **offline** -> "powered down." Character is dark/seated.
- **error** -> red glow, "spat out a stack trace."

Clicking a character selects that agent and opens its hub (run view, history,
shared memory, send-to-agent). A plain list view toggle stays for accessibility.

## Jokes
Idle lines live in `agent-status-lines.json` (editable). Each line has an `nsfw`
flag; a Settings toggle "clean idle statuses" filters to `nsfw:false` only.
Default OFF (this is a personal tool). Mix of cyber gags and crude ones.

## Performance (obeys planning/STABILITY.md)
- The 3D scene runs in the renderer but is capped (low-poly, target 30-60 fps,
  `requestAnimationFrame` paused when the tab is not visible).
- Agent job execution stays in the main process — the 3D loop never runs a tool
  or blocks on IPC. Status updates arrive as batched events and just update labels.
- If the GPU/scene is unavailable, fall back to the list view automatically.

## Wiring
Agents surface (Phase 5/6). Subscribe to `agent:step`/agent state events; map each
agent id to a character; set label text from state; rotate idle lines from the
pool on a timer. Keep the scene module isolated so a render failure can't take
down the agents feature.

## Navigation and look (match the Claw3D HQ demo)
Model the surface on Claw3D's HEADQUARTERS demo, cyber-themed:
- A navigable isometric office ("Reacher HQ") — a warm-lit makeshift office room
  with low-poly/voxel furniture, sitting inside the dark app chrome.
- Camera controls (as in the demo, shown as hints in a bottom status bar): drag =
  orbit/rotate, scroll = zoom, space+drag = pan, double-click a character = focus
  on it. Bottom bar also shows live counts: "connected · N working · N idle".
- Characters are dressed-up low-poly people, one per agent, each a distinct cyber
  outfit: osint = hoodie + top hat; architect = hi-vis + hard hat; scout =
  tactical vest + headset; analyst = lab coat + glasses. Name tag + status pill
  float above each (status = live task when working, idle joke otherwise).
- Right "HQ" panel mirrors the demo's Inbox / History / Playbooks. Playbooks are
  the agents' reusable scheduled runs — daily briefing, nightly recon digest,
  hourly health check, weekly progress, continuous monitor — wired to the scheduler.
- The office is furnishable/rearrangeable (desks, monitors, couch, server racks,
  plants). Still obeys STABILITY.md: capped fps, pause when tab hidden, jobs run
  in the main process, auto-fallback to list view if the 3D scene can't init.
