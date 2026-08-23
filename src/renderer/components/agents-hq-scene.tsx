/**
 * The HQ scene is isolated from IPC because Claw3D-style rendering should only
 * visualize state. If a mesh could start jobs or fetch memory, the animation
 * loop would become a hidden tool runner and violate STABILITY.md.
 *
 * The room is deliberately bright and decorated (wall posters, per-desk name
 * plates, a hover card that fades in) because the den is the first thing Jack
 * sees on this route: a dim box of grey cubes read as broken, not stylish. Every
 * color still comes from the theme palette, and the posters are drawn to an
 * offscreen canvas at runtime so nothing external is fetched.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { AgentPresentation } from "../agents/agent-status";
import type { AccessoryShape, HatShape } from "../agents/agent-personas";
import { focusAgentCamera, type CameraFocusTarget } from "../agents/camera-controls";
import type { HqPalette } from "../agents/theme-palette";

export function AgentsHqScene(props: {
  readonly agents: readonly AgentPresentation[];
  readonly palette: HqPalette;
  readonly visible: boolean;
  readonly spacePan: boolean;
  readonly focused: CameraFocusTarget | null;
  readonly selectedAgentId: string | null;
  readonly onFocusedChange: (focus: CameraFocusTarget) => void;
  readonly onAgentOpen: (agentId: string) => void;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const mouseButtons = useMemo(
    () => ({
      LEFT: props.spacePan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    }),
    [props.spacePan]
  );

  return (
    <Canvas
      className="agents-hq-canvas"
      frameloop="demand"
      camera={{ position: [5.5, 5.2, 6.5], fov: 45, near: 0.1, far: 80 }}
      shadows
      dpr={[1, 1.5]}
    >
      <CappedInvalidator visible={props.visible} fps={30} />
      <color attach="background" args={[props.palette.app]} />
      {/* Brighter, layered lighting: a hemisphere fill lifts every surface off
          black, a key light throws readable shadows, and two accent points give
          the room its console glow. */}
      <hemisphereLight args={[props.palette.accentStrong, props.palette.surface, 0.9]} />
      <ambientLight intensity={0.85} color={props.palette.raised} />
      <directionalLight position={[4, 9, 5]} intensity={2.4} color={props.palette.text} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 3, -2]} intensity={1.6} color={props.palette.accent} />
      <pointLight position={[3.5, 2.6, 2.5]} intensity={1.1} color={props.palette.reference} />
      <CameraFocus focused={props.focused} controls={controls} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.09}
        enablePan={props.spacePan}
        mouseButtons={mouseButtons}
      />
      <OfficeRoom palette={props.palette} />
      {props.agents.map((agent, index) => (
        <AgentCharacter
          key={agent.agent.id}
          agent={agent}
          index={index}
          palette={props.palette}
          selected={props.selectedAgentId === agent.agent.id}
          onFocus={(focus) => props.onFocusedChange(focus)}
          onOpen={props.onAgentOpen}
        />
      ))}
    </Canvas>
  );
}

function CappedInvalidator({ visible, fps }: { readonly visible: boolean; readonly fps: number }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    const delay = Math.max(16, Math.round(1000 / fps));
    const tick = () => {
      if (cancelled) {
        return;
      }
      invalidate();
      window.setTimeout(tick, delay);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [fps, invalidate, visible]);
  return null;
}

function CameraFocus({
  focused,
  controls
}: {
  readonly focused: CameraFocusTarget | null;
  readonly controls: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    if (!focused || !controls.current) {
      return;
    }
    camera.position.lerp(new THREE.Vector3(...focused.position), 0.08);
    controls.current.target.lerp(new THREE.Vector3(...focused.target), 0.08);
    controls.current.update();
  });
  return null;
}

function OfficeRoom({ palette }: { readonly palette: HqPalette }) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial color={palette.surface} roughness={0.92} />
      </mesh>
      {/* A rug of accent tone marks the lounge corner and keeps the floor from
          reading as one flat grey slab. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-2.9, 0.01, 1.9]}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshStandardMaterial color={palette.accent} roughness={0.95} transparent opacity={0.16} />
      </mesh>
      <Wall position={[0, 1.35, -3.2]} scale={[10, 2.7, 0.16]} palette={palette} />
      <Wall position={[-4.9, 1.35, 0]} scale={[0.16, 2.7, 7]} palette={palette} />
      <LogoWall palette={palette} />
      <ServerRack position={[3.9, 0.75, 2.1]} palette={palette} />
      <ServerRack position={[3.25, 0.75, 2.1]} palette={palette} />
      <Couch position={[-2.9, 0.28, 1.9]} palette={palette} />
      <Plant position={[-4.3, 0.35, 2.6]} palette={palette} />
    </group>
  );
}

function Wall(props: { readonly position: [number, number, number]; readonly scale: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <mesh position={props.position} scale={props.scale} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={props.palette.raised} roughness={0.85} />
    </mesh>
  );
}

/**
 * Four brand posters give the back wall its "hacker HQ" texture. They are drawn
 * to a canvas at runtime (no external image, per the CSP) and each renders as an
 * emissive-lit panel so the wall never looks empty.
 */
function LogoWall({ palette }: { readonly palette: HqPalette }) {
  const posters = useMemo(
    () => [
      { key: "github", label: "GitHub", motif: "github" as const, tint: palette.text, x: -3.4 },
      { key: "vscode", label: "VS Code", motif: "vscode" as const, tint: palette.accent, x: -1.15 },
      { key: "kali", label: "Kali", motif: "kali" as const, tint: palette.reference, x: 1.1 },
      { key: "reacher", label: "Reacher", motif: "reacher" as const, tint: palette.accentStrong, x: 3.35 }
    ],
    [palette]
  );
  return (
    <group position={[0, 1.7, -3.11]}>
      {posters.map((poster) => (
        <LogoPoster key={poster.key} label={poster.label} motif={poster.motif} tint={poster.tint} palette={palette} position={[poster.x, 0, 0]} />
      ))}
    </group>
  );
}

function LogoPoster(props: {
  readonly label: string;
  readonly motif: PosterMotif;
  readonly tint: string;
  readonly palette: HqPalette;
  readonly position: [number, number, number];
}) {
  const texture = useMemo(() => makePosterTexture(props.label, props.motif, props.tint, props.palette), [props.label, props.motif, props.palette, props.tint]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <group position={props.position}>
      {/* Frame slightly larger than the poster so it reads as a mounted print. */}
      <mesh position={[0, 0, -0.02]} scale={[1.5, 1.5, 0.04]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={props.palette.border} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.36, 1.36]} />
        {texture ? (
          <meshStandardMaterial map={texture} emissive={props.tint} emissiveMap={texture} emissiveIntensity={0.35} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={props.palette.app} />
        )}
      </mesh>
    </group>
  );
}

type PosterMotif = "github" | "vscode" | "kali" | "reacher";

/**
 * Draws a poster to an offscreen canvas: a tinted mark plus the brand name. The
 * marks are simplified so they read at a glance without shipping trademarked art.
 */
function makePosterTexture(label: string, motif: PosterMotif, tint: string, palette: HqPalette): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = palette.raised;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = tint;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 232, 232);
  ctx.fillStyle = tint;
  ctx.strokeStyle = tint;
  ctx.lineWidth = 10;
  drawMotif(ctx, motif, palette);
  ctx.fillStyle = palette.text;
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), 128, 205);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function drawMotif(ctx: CanvasRenderingContext2D, motif: PosterMotif, palette: HqPalette): void {
  ctx.save();
  ctx.translate(128, 110);
  if (motif === "github") {
    // Rounded "cat" head silhouette.
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-40, -30);
    ctx.lineTo(-20, -58);
    ctx.lineTo(-6, -34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, -30);
    ctx.lineTo(20, -58);
    ctx.lineTo(6, -34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.raised;
    ctx.beginPath();
    ctx.arc(-16, 2, 8, 0, Math.PI * 2);
    ctx.arc(16, 2, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (motif === "vscode") {
    ctx.font = "bold 92px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("</>", 0, 0);
  } else if (motif === "kali") {
    // Dragon-tail "K": a bar plus two sweeping strokes.
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-30, -46);
    ctx.lineTo(-30, 46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 4);
    ctx.quadraticCurveTo(24, -20, 40, -50);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 4);
    ctx.quadraticCurveTo(30, 22, 44, 52);
    ctx.stroke();
  } else {
    // Reacher: the top-hat mascot.
    ctx.fillRect(-44, 34, 88, 12);
    ctx.fillRect(-26, -46, 52, 82);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(-26, 16, 52, 12);
  }
  ctx.restore();
}

function ServerRack({ position, palette }: { readonly position: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <mesh castShadow scale={[0.45, 1.5, 0.48]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.app} roughness={0.55} />
      </mesh>
      {[0.34, 0.06, -0.22].map((y) => (
        <mesh key={y} position={[0, y, -0.25]} scale={[0.32, 0.04, 0.03]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.accentStrong} emissive={palette.accentStrong} emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Couch({ position, palette }: { readonly position: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <mesh castShadow scale={[1.4, 0.34, 0.55]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.26, -0.25]} castShadow scale={[1.45, 0.5, 0.16]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Plant({ position, palette }: { readonly position: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <mesh castShadow scale={[0.34, 0.28, 0.34]}>
        <cylinderGeometry args={[0.32, 0.24, 0.5, 6]} />
        <meshStandardMaterial color={palette.border} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow scale={[0.44, 0.44, 0.44]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.positive} roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * Every agent gets its own desk and a standing name plate, so the tag always
 * matches the character no matter how many agents exist. The desk stays still
 * while only the character bobs and turns — that separation is why the plate
 * reads cleanly instead of spinning with a working agent.
 */
function AgentCharacter(props: {
  readonly agent: AgentPresentation;
  readonly index: number;
  readonly palette: HqPalette;
  readonly selected: boolean;
  readonly onFocus: (focus: CameraFocusTarget) => void;
  readonly onOpen: (agentId: string) => void;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const position = useMemo<[number, number, number]>(() => [(props.index % 3) * 2.1 - 2.1, 0.06, Math.floor(props.index / 3) * 2.1 - 0.8], [props.index]);
  const persona = props.agent.persona;
  const outfit = persona.outfit;
  const accent = props.palette[persona.accent];

  // Working agents bob and turn briskly; idle ones drift and sag a little. The
  // motion is the tell, so status reads from across the room without the label.
  useFrame((clock, delta) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }
    const elapsed = clock.clock.elapsedTime + props.index;
    if (props.agent.working) {
      body.rotation.y += delta * 0.9;
      body.position.y = Math.abs(Math.sin(elapsed * 3.4)) * 0.07;
    } else if (props.agent.state.status === "offline") {
      body.rotation.y = Math.PI * 0.25;
      body.position.y = -0.04;
    } else {
      body.rotation.y += delta * 0.18;
      body.position.y = Math.sin(elapsed * 0.9) * 0.02;
    }
  });

  const setPointer = (isOver: boolean) => {
    setHovered(isOver);
    document.body.style.cursor = isOver ? "pointer" : "";
  };

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        props.onOpen(props.agent.agent.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        props.onFocus(focusAgentCamera(props.agent, props.index));
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setPointer(true);
      }}
      onPointerOut={() => setPointer(false)}
    >
      <AgentDesk palette={props.palette} accent={accent} lit={props.agent.working} />

      {/* The character bobs/rotates inside this inner group; the desk and plate
          around it stay fixed. */}
      <group ref={bodyRef} position={[0, 0, 0]}>
        <mesh castShadow position={[0, 0.32, 0]} scale={[0.34, 0.58, 0.24]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={props.palette[outfit.body]}
            emissive={props.agent.working || props.selected || hovered ? accent : props.palette.app}
            emissiveIntensity={props.agent.working ? 0.24 : props.selected ? 0.16 : hovered ? 0.1 : 0.02}
          />
        </mesh>
        {/* Arms give the body a silhouette instead of a bare box. */}
        <mesh castShadow position={[-0.22, 0.34, 0]} scale={[0.08, 0.4, 0.14]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={props.palette[outfit.body]} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0.22, 0.34, 0]} scale={[0.08, 0.4, 0.14]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={props.palette[outfit.body]} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.82, 0]} scale={[0.22, 0.22, 0.22]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={props.palette[outfit.head]} roughness={0.65} />
        </mesh>
        <AgentHat shape={outfit.hatShape} color={props.palette[outfit.hat]} accent={accent} />
        <AgentAccessory shape={outfit.accessory} accent={accent} body={props.palette[outfit.body]} />
        {props.agent.working ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[0.58, 0.58, 0.58]}>
            <torusGeometry args={[0.5, 0.025, 8, 20]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.85} />
          </mesh>
        ) : null}
      </group>

      {props.selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} scale={[0.8, 0.8, 0.8]}>
          <torusGeometry args={[0.5, 0.02, 8, 24]} />
          <meshStandardMaterial color={props.palette.text} emissive={accent} emissiveIntensity={0.4} />
        </mesh>
      ) : null}

      {/* Always-on desk name plate: small, screen-space, and low so plates do not
          pile up over the characters. */}
      <Html position={[0, 0.12, 0.66]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div className="agent-desk-nameplate" style={{ borderColor: accent }}>
          {props.agent.agent.name}
        </div>
      </Html>

      {/* Rich hover/selected card fades in via CSS so switching agents no longer
          staggers a stack of transformed labels. */}
      <Html position={[0, 1.55, 0]} center zIndexRange={[40, 10]} pointerEvents="none">
        <div className={`agent-hover-card${hovered || props.selected ? " is-visible" : ""}`} style={{ borderColor: accent }}>
          <span className="agent-hover-callsign" style={{ color: accent }}>
            {persona.callsign}
          </span>
          <strong>{props.agent.agent.name}</strong>
          <em>{props.agent.statusText}</em>
        </div>
      </Html>
    </group>
  );
}

function AgentDesk({ palette, accent, lit }: { readonly palette: HqPalette; readonly accent: string; readonly lit: boolean }) {
  return (
    <group position={[0, 0, 0.5]}>
      {/* Desktop surface. */}
      <mesh castShadow receiveShadow position={[0, 0.32, 0]} scale={[1.1, 0.08, 0.56]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.border} roughness={0.7} />
      </mesh>
      {/* Two legs. */}
      <mesh castShadow position={[-0.42, 0.16, 0]} scale={[0.06, 0.32, 0.4]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.app} />
      </mesh>
      <mesh castShadow position={[0.42, 0.16, 0]} scale={[0.06, 0.32, 0.4]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.app} />
      </mesh>
      {/* Monitor with a glowing screen that brightens while the agent works. */}
      <mesh castShadow position={[0, 0.58, -0.12]} scale={[0.5, 0.32, 0.05]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.app} emissive={accent} emissiveIntensity={lit ? 0.55 : 0.22} />
      </mesh>
      <mesh position={[0, 0.4, -0.12]} scale={[0.08, 0.08, 0.05]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.border} />
      </mesh>
    </group>
  );
}

function AgentHat({ shape, color, accent }: { readonly shape: HatShape; readonly color: string; readonly accent: string }) {
  if (shape === "top-hat") {
    return (
      <group position={[0, 0.95, 0]}>
        <mesh castShadow position={[0, 0, 0]} scale={[0.3, 0.02, 0.3]}>
          <cylinderGeometry args={[1, 1, 1, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh castShadow position={[0, 0.12, 0]} scale={[0.19, 0.22, 0.19]}>
          <cylinderGeometry args={[1, 1, 1, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 0.04, 0]} scale={[0.2, 0.03, 0.2]}>
          <cylinderGeometry args={[1, 1, 1, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }
  if (shape === "hard-hat") {
    return (
      <group position={[0, 0.94, 0]}>
        <mesh castShadow scale={[0.16, 0.14, 0.16]}>
          <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.3} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.06]} scale={[0.17, 0.02, 0.1]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }
  if (shape === "headset") {
    return (
      <group position={[0, 0.9, 0]}>
        <mesh castShadow scale={[0.15, 0.15, 0.02]}>
          <torusGeometry args={[1, 0.12, 6, 16, Math.PI]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh castShadow position={[0.13, 0, 0]} scale={[0.04, 0.06, 0.05]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
        <mesh castShadow position={[-0.13, 0, 0]} scale={[0.04, 0.06, 0.05]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
      </group>
    );
  }
  if (shape === "visor") {
    return (
      <mesh castShadow position={[0, 0.85, 0.1]} scale={[0.24, 0.06, 0.04]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.75} />
      </mesh>
    );
  }
  return (
    <mesh castShadow position={[0, 0.93, -0.02]} scale={[0.26, 0.16, 0.26]}>
      <sphereGeometry args={[1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function AgentAccessory({ shape, accent, body }: { readonly shape: AccessoryShape; readonly accent: string; readonly body: string }) {
  if (shape === "monocle") {
    return (
      <mesh position={[0.07, 0.84, 0.12]} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 0.05, 0.05]}>
        <torusGeometry args={[1, 0.22, 6, 14]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} />
      </mesh>
    );
  }
  if (shape === "clipboard") {
    return (
      <mesh castShadow position={[0.24, 0.4, 0.1]} rotation={[0, 0, -0.35]} scale={[0.14, 0.19, 0.02]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.2} />
      </mesh>
    );
  }
  if (shape === "antenna") {
    return (
      <group position={[0.12, 1.0, -0.05]}>
        <mesh castShadow scale={[0.012, 0.22, 0.012]}>
          <cylinderGeometry args={[1, 1, 1, 6]} />
          <meshStandardMaterial color={body} />
        </mesh>
        <mesh position={[0, 0.14, 0]} scale={[0.032, 0.032, 0.032]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
        </mesh>
      </group>
    );
  }
  if (shape === "lockpick") {
    return (
      <mesh castShadow position={[-0.24, 0.36, 0.08]} rotation={[0, 0, 0.5]} scale={[0.02, 0.22, 0.02]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
      </mesh>
    );
  }
  return null;
}
