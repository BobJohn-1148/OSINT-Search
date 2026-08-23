# Codex build instructions — AI Agents HQ voxel-art overhaul

Read `CLAUDE.md` first (invariants override everything), then this file. This is
not a new REACHER_PLAN phase — it's a full visual rebuild of the existing "AI
agents" 3D scene, scoped as its own branch and audit like any other change.

## Why this exists

`src/renderer/components/agents-hq-scene.tsx` (~615 lines) currently builds every
character and every room surface directly out of raw `boxGeometry`,
`cylinderGeometry`, `sphereGeometry`, and `planeGeometry` primitives with flat
`meshStandardMaterial`, hand-assembled inline in JSX. There is no texturing, no
real character detail, no environment craft — it reads as programmer art, not
designed art, and Jack has flagged it directly as low quality. This is a full
overhaul: room, lighting, camera, and every character model.

## Art direction — read this twice before writing any Three.js code

**Voxel-style 3D pixel art.** Think Minecraft, Crossy Road, Trove: real 3D
geometry built from many small, precisely placed cubes, rendered with a
disciplined, limited color palette so it reads unmistakably as pixel art while
still being a real 3D scene the camera can orbit around. This is NOT
photorealism, and it is NOT flat 2D sprites — it's crisp, chunky, intentional
voxel construction. It also already matches Reacher's own identity: the app's
mascot (`assets/brand/reacher-logo.svg` etc.) is a pixel-art top-hat gentleman.
Lean into that established look, don't invent a new one.

A useful gut check: if a screenshot could be mistaken for a AAA game render, it's
wrong. If it could be mistaken for a well-made voxel indie game, it's right.

## What to preserve — do not rebuild these, build on them

- **`src/renderer/agents/agent-personas.ts`** — the `AgentPersona`/`AgentOutfit`
  data model (callsign, role, tagline, accent, outfit colors, `HatShape`,
  `AccessoryShape`, quirks) is good architecture and already theme-token-safe.
  Every character you build must be *driven by* this data, not a parallel
  hardcoded design. If a persona's existing `hatShape`/`accessory` genuinely
  can't support a good voxel design, that's worth flagging back to Jack rather
  than silently reinterpreting it.
- **`src/renderer/agents/theme-palette.ts`** — colors come from CSS custom
  properties via `readHqPalette()`, never raw hex. This is a hard project
  invariant (CLAUDE.md: "never a raw hex or stock colour; everything resolves to
  a theme token") and it's already wired correctly here — keep it that way for
  every new material.
- **`src/renderer/agents/camera-controls.ts`** (`focusAgentCamera`,
  `CameraFocusTarget`) — the click-to-focus interaction should carry over into
  the rebuilt scene, adapted as needed for new camera framing, not thrown away.
- **The non-WebGL fallback** (`.agents-fallback` in `styles.css`, used when
  Canvas/WebGL isn't available — this is also what the test environment hits,
  see the `HTMLCanvasElement's getContext()` warnings in `npm test` output).
  Don't break this path; it's load-bearing for both real low-capability
  machines and the test suite.

## The six characters to design

Each needs to be genuinely distinguishable at a glance, not a palette-swapped
box-person. Use the existing `outfit`/`hatShape`/`accessory`/`tagline` as your
brief for each, and build real silhouette variety between them:

| Agent | Callsign | Direction |
|---|---|---|
| `osint` | The Gentleman | top hat, monocle, refined/tidy posture — "never states a thing he cannot cite" |
| `architect` | The Foreman | hard hat, clipboard, blueprint energy — measured, foundational |
| `scout` | Scout | headset, antenna, tactical/forward-leaning stance — always mid-stride |
| `ripper` | Ripper | hood, lockpick, scrappy mechanic — hands-on, a little grimy |
| `malware` | The Coroner | visor, monocle, clinical/mortuary — still, precise, unhurried |
| `analyst` | The Analyst | visor, monocle, deskbound — hunched over data, methodical |

`malware` and `analyst` currently share `hatShape`/`accessory` (visor + monocle)
— differentiate them through posture, body proportions, or a small unique detail
rather than making them look like twins.

## Room and lighting

The environment (floor, walls, any furniture/props) needs the same voxel
treatment as the characters — currently it's a couple of flat planes. Build a
proper "den" that reads as a security console / ops room, matching Reacher's
dark console theme (charcoal surfaces, blue accent, monospace-adjacent feel) —
again, tokens only, no raw hex. Light it for the voxel-pixel look specifically:
a clear key light plus soft fill reads much better on chunky voxel forms than a
default PBR three-point setup does; consider whether each agent's `accent` color
should show up as a subtle glow/rim light near their own character.

## Performance — read this before you write a loop that emits one `<mesh>` per voxel

A naive build (one React-Three-Fiber `<mesh>` per individual voxel cube, times
six characters, times a detailed room) will tank frame rate — each `<mesh>` is a
real Three.js `Object3D` with real overhead, and CLAUDE.md's stability invariant
is non-negotiable ("a search that floods thousands of results must throttle, not
crash" — the same principle applies to draw calls). Build each character (and
major room pieces) as **one merged geometry** (`BufferGeometryUtils.mergeGeometries`
or equivalent) or an `InstancedMesh` where cubes repeat, not as a forest of
individual meshes. Profile with the browser's performance tools before calling
this done, not just "it looks fine on my machine."

## Definition of done

- `npm run typecheck && npm run lint && npm test && npm run audit:security` all
  green; `node scripts/phase-audit.mjs 14` still passes (this overhaul doesn't
  change any exit criterion, so it must not regress one).
- Every color in the new scene resolves to a theme token — grep for raw hex in
  `agents-hq-scene.tsx` and anything new you add; there should be none.
- The fallback path still renders when Canvas is unavailable.
- Start the dev server and actually look at it — orbit the camera, click each of
  the six agents to confirm focus-camera still works, confirm they're
  distinguishable from across the room, not just up close.
- Module header on any new file explains *why* it's shaped that way, per house
  style — not what it does.
- If you hit a real ambiguity (a persona whose existing outfit data doesn't
  translate well, a performance tradeoff with no clean answer, whether a prop
  belongs in the room) — say so and ask, the way this brief itself was written
  after Jack was asked to resolve the "realistic vs. pixel art vs.
  three-dimensional" tension up front. Don't silently pick an interpretation on
  something that changes the outcome significantly.
