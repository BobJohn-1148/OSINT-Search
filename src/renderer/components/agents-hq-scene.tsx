/**
 * The HQ scene is isolated from IPC because Claw3D-style rendering should only
 * visualize state. If a mesh could start jobs or fetch memory, the animation
 * loop would become a hidden tool runner and violate STABILITY.md.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { forwardRef, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { AgentPresentation } from "../agents/agent-status";
import { focusAgentCamera, type CameraFocusTarget } from "../agents/camera-controls";
import type { HqPalette } from "../agents/theme-palette";
import type { AgentMemoryRecord, AgentRunRecord } from "../../shared/schemas/agents-runtime";

type Vec3 = [number, number, number];

interface PixelBlockSpec {
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly color: string;
  readonly emissive?: string;
  readonly opacity?: number;
}

interface AgentOutfit {
  readonly body: string;
  readonly vest: string;
  readonly head: string;
  readonly hair: string;
  readonly accent: string;
  readonly secondary: string;
  readonly personality: string;
  readonly tool: "case-file" | "scanner" | "terminal" | "wrench" | "beacon";
  readonly hatBlocks: readonly PixelBlockSpec[];
  readonly deskToy: "magnifier" | "blueprint" | "antenna" | "coffee" | "lock";
}

interface AgentSceneContext {
  readonly recentRun: string;
  readonly previousRun: string;
  readonly memoryCount: number;
  readonly sharedMemoryCount: number;
  readonly estimatedSpend: string;
}

export function AgentsHqScene(props: {
  readonly agents: readonly AgentPresentation[];
  readonly palette: HqPalette;
  readonly visible: boolean;
  readonly spacePan: boolean;
  readonly focused: CameraFocusTarget | null;
  readonly selectedAgentId: string | null;
  readonly runs: readonly AgentRunRecord[];
  readonly memory: readonly AgentMemoryRecord[];
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
      orthographic
      camera={{ position: [7.2, 5.8, 7.2], zoom: 58, near: 0.1, far: 90 }}
      dpr={[1, 1]}
      gl={{ antialias: false }}
    >
      <CappedInvalidator visible={props.visible} fps={30} />
      <color attach="background" args={[props.palette.app]} />
      <ambientLight intensity={0.72} color={props.palette.surface} />
      <directionalLight position={[4, 8, 6]} intensity={1.45} color={props.palette.text} />
      <pointLight position={[-3.8, 2.8, 1.8]} intensity={0.9} color={props.palette.accentStrong} />
      <pointLight position={[3.2, 2.2, -2.2]} intensity={0.64} color={props.palette.accent} />
      <CameraFocus focused={props.focused} controls={controls} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.09}
        enablePan={props.spacePan}
        maxDistance={12}
        minDistance={4}
        maxPolarAngle={Math.PI / 2.05}
        mouseButtons={mouseButtons}
      />
      <PixelOpsRoom palette={props.palette} />
      {props.agents.map((agent, index) => (
        <VoxelAgent
          key={agent.agent.id}
          agent={agent}
          index={index}
          palette={props.palette}
          context={buildAgentSceneContext(agent.agent.id, props.runs, props.memory)}
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

function PixelOpsRoom({ palette }: { readonly palette: HqPalette }) {
  return (
    <group>
      <VoxelFloor palette={palette} />
      <PixelWall position={[0, 1.05, -3.25]} scale={[9.8, 2.3, 0.16]} palette={palette} />
      <PixelWall position={[-4.9, 1.05, 0]} scale={[0.16, 2.3, 6.6]} palette={palette} />
      <EvidenceWall position={[-3.22, 1.3, -3.36]} palette={palette} />
      <OpsScreen position={[1.18, 1.38, -3.38]} palette={palette} />
      <CommandTable position={[0, 0.32, 0.1]} palette={palette} />
      <ServerStack position={[3.9, 0.82, 1.55]} palette={palette} active />
      <ServerStack position={[3.25, 0.82, 1.55]} palette={palette} active />
      <ServerStack position={[4.55, 0.82, 1.55]} palette={palette} />
      <SignalMast position={[4.2, 0.8, -2.1]} palette={palette} />
      <CaseCrates position={[-3.84, 0.3, 1.88]} palette={palette} />
      <PixelPlant position={[-4.18, 0.35, 2.54]} palette={palette} />
      <WallArt position={[-4.98, 1.35, -1.7]} palette={palette} />
      <WallArt position={[-4.98, 1.2, 0.95]} palette={palette} compact />
      <FloorCable from={[-2.85, 0.04, -1.02]} to={[0, 0.04, -0.1]} palette={palette} />
      <FloorCable from={[3.55, 0.04, 1.28]} to={[0.78, 0.04, 0.14]} palette={palette} />
    </group>
  );
}

function VoxelFloor({ palette }: { readonly palette: HqPalette }) {
  const tiles = useMemo(
    () =>
      Array.from({ length: 11 }, (_, x) =>
        Array.from({ length: 8 }, (_unused, z) => ({
          x: x - 5,
          z: z - 3.5,
          variant: (x * 3 + z * 5) % 6
        }))
      ).flat(),
    []
  );

  return (
    <group>
      {tiles.map((tile) => (
        <PixelBlock
          key={`${tile.x}-${tile.z}`}
          position={[tile.x, -0.04, tile.z]}
          scale={[0.96, 0.08, 0.96]}
          color={tile.variant === 0 ? palette.raised : tile.variant % 2 === 0 ? palette.surface : palette.app}
        />
      ))}
      {[-5.5, 5.5].map((x) => (
        <PixelBlock key={`floor-rail-x-${x}`} position={[x, 0.01, 0]} scale={[0.08, 0.08, 8.2]} color={palette.border} />
      ))}
      {[-4.03, 4.03].map((z) => (
        <PixelBlock key={`floor-rail-z-${z}`} position={[0, 0.01, z]} scale={[11.1, 0.08, 0.08]} color={palette.border} />
      ))}
      {[-2.4, 0, 2.4].map((x) => (
        <PixelBlock key={`floor-path-${x}`} position={[x, 0.025, 0.06]} scale={[0.74, 0.035, 0.16]} color={palette.accentStrong} emissive={palette.accentStrong} opacity={0.78} />
      ))}
    </group>
  );
}

function PixelWall(props: {
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly palette: HqPalette;
}) {
  return (
    <group>
      <PixelBlock position={props.position} scale={props.scale} color={props.palette.raised} />
      <PixelBlock
        position={[props.position[0], props.position[1] + props.scale[1] / 2 - 0.08, props.position[2] + 0.02]}
        scale={[props.scale[0], 0.08, props.scale[2] + 0.04]}
        color={props.palette.border}
      />
    </group>
  );
}

function EvidenceWall({ position, palette }: { readonly position: Vec3; readonly palette: HqPalette }) {
  const pins: readonly PixelBlockSpec[] = [
    { position: [-0.62, 0.16, 0.04], scale: [0.32, 0.22, 0.05], color: palette.text },
    { position: [-0.08, 0.24, 0.04], scale: [0.38, 0.18, 0.05], color: palette.surface },
    { position: [0.5, 0.12, 0.04], scale: [0.3, 0.28, 0.05], color: palette.text },
    { position: [-0.38, -0.18, 0.04], scale: [0.26, 0.18, 0.05], color: palette.accent },
    { position: [0.24, -0.18, 0.04], scale: [0.42, 0.12, 0.05], color: palette.surface }
  ];
  const strings: readonly PixelBlockSpec[] = [
    { position: [-0.35, 0.2, 0.08], scale: [0.5, 0.025, 0.025], color: palette.accentStrong, emissive: palette.accentStrong },
    { position: [0.24, 0.18, 0.08], scale: [0.44, 0.025, 0.025], color: palette.accentStrong, emissive: palette.accentStrong },
    { position: [-0.06, -0.03, 0.08], scale: [0.72, 0.025, 0.025], color: palette.accent, emissive: palette.accent }
  ];
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[1.9, 1.1, 0.08]} color={palette.app} />
      <PixelBlock position={[0, 0.58, 0.04]} scale={[2.04, 0.08, 0.1]} color={palette.border} />
      <PixelBlock position={[0, -0.58, 0.04]} scale={[2.04, 0.08, 0.1]} color={palette.border} />
      <PixelBlock position={[-1.02, 0, 0.04]} scale={[0.08, 1.16, 0.1]} color={palette.border} />
      <PixelBlock position={[1.02, 0, 0.04]} scale={[0.08, 1.16, 0.1]} color={palette.border} />
      {strings.map((block, index) => (
        <PixelBlock key={`string-${index}`} {...block} />
      ))}
      {pins.map((block, index) => (
        <PixelBlock key={`pin-${index}`} {...block} />
      ))}
    </group>
  );
}

function OpsScreen({ position, palette }: { readonly position: Vec3; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[2.5, 1.22, 0.08]} color={palette.app} />
      <PixelBlock position={[0, 0.64, 0.04]} scale={[2.64, 0.08, 0.1]} color={palette.border} />
      <PixelBlock position={[0, -0.64, 0.04]} scale={[2.64, 0.08, 0.1]} color={palette.border} />
      {[-0.76, -0.24, 0.28, 0.78].map((x, index) => (
        <PixelBlock
          key={`screen-bar-${x}`}
          position={[x, 0.1 - index * 0.13, 0.08]}
          scale={[0.36 + index * 0.12, 0.045, 0.04]}
          color={index % 2 === 0 ? palette.accentStrong : palette.accent}
          emissive={index % 2 === 0 ? palette.accentStrong : palette.accent}
        />
      ))}
      {[-0.9, 0, 0.9].map((x) => (
        <PixelBlock key={`screen-node-${x}`} position={[x, -0.36, 0.08]} scale={[0.13, 0.13, 0.04]} color={palette.text} emissive={palette.accent} />
      ))}
    </group>
  );
}

function Workstation({
  position,
  palette,
  labelPixels,
  accent
}: {
  readonly position: Vec3;
  readonly palette: HqPalette;
  readonly labelPixels: number;
  readonly accent?: string;
}) {
  const glow = accent ?? palette.accentStrong;
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[1.34, 0.18, 0.72]} color={palette.border} />
      <PixelBlock position={[0, 0.12, -0.36]} scale={[1.46, 0.08, 0.08]} color={palette.raised} />
      <PixelBlock position={[0, 0.38, -0.22]} scale={[0.62, 0.42, 0.08]} color={palette.app} emissive={palette.accent} />
      <PixelBlock position={[0, 0.38, -0.165]} scale={[0.48, 0.29, 0.03]} color={glow} emissive={glow} opacity={0.82} />
      {Array.from({ length: labelPixels }, (_, index) => (
        <PixelBlock
          key={`terminal-pixel-${index}`}
          position={[-0.19 + index * 0.1, 0.42 - (index % 2) * 0.1, -0.13]}
          scale={[0.045, 0.045, 0.025]}
          color={palette.text}
          emissive={palette.text}
        />
      ))}
      <PixelBlock position={[0, 0.12, 0.16]} scale={[0.48, 0.05, 0.18]} color={palette.text} />
      <PixelBlock position={[-0.52, -0.22, -0.17]} scale={[0.08, 0.44, 0.08]} color={palette.border} />
      <PixelBlock position={[0.52, -0.22, -0.17]} scale={[0.08, 0.44, 0.08]} color={palette.border} />
    </group>
  );
}

function CommandTable({ position, palette }: { readonly position: Vec3; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[1.9, 0.24, 1.12]} color={palette.border} />
      <PixelBlock position={[0, 0.16, 0]} scale={[1.68, 0.08, 0.9]} color={palette.surface} />
      <PixelBlock position={[0, 0.24, 0]} scale={[1.18, 0.04, 0.58]} color={palette.accentStrong} emissive={palette.accentStrong} opacity={0.78} />
      <PixelBlock position={[-0.32, 0.36, -0.02]} scale={[0.18, 0.18, 0.18]} color={palette.text} emissive={palette.accent} />
      <PixelBlock position={[0.28, 0.42, 0.1]} scale={[0.14, 0.28, 0.14]} color={palette.accent} emissive={palette.accent} />
      <PixelBlock position={[0.06, 0.54, -0.16]} scale={[0.36, 0.035, 0.035]} color={palette.text} emissive={palette.text} />
      <PixelBlock position={[-0.72, -0.32, -0.4]} scale={[0.1, 0.52, 0.1]} color={palette.border} />
      <PixelBlock position={[0.72, -0.32, -0.4]} scale={[0.1, 0.52, 0.1]} color={palette.border} />
      <PixelBlock position={[-0.72, -0.32, 0.4]} scale={[0.1, 0.52, 0.1]} color={palette.border} />
      <PixelBlock position={[0.72, -0.32, 0.4]} scale={[0.1, 0.52, 0.1]} color={palette.border} />
    </group>
  );
}

function ServerStack({
  position,
  palette,
  active = false
}: {
  readonly position: Vec3;
  readonly palette: HqPalette;
  readonly active?: boolean;
}) {
  const blinkColor = active ? palette.accentStrong : palette.accent;
  const pulseRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!pulseRef.current) {
      return;
    }
    pulseRef.current.visible = Math.floor(clock.elapsedTime * 3) % 2 === 0;
  });
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[0.5, 1.58, 0.5]} color={palette.app} />
      <PixelBlock position={[0, 0.82, -0.26]} scale={[0.54, 0.08, 0.06]} color={palette.border} />
      {[-0.42, -0.16, 0.1, 0.36].map((y, index) => (
        <group key={`server-row-${y}`}>
          <PixelBlock position={[0, y, -0.28]} scale={[0.38, 0.045, 0.035]} color={index % 2 === 0 ? blinkColor : palette.surface} emissive={index % 2 === 0 ? blinkColor : undefined} />
          <PixelBlock position={[-0.17, y + 0.08, -0.29]} scale={[0.035, 0.035, 0.025]} color={palette.text} emissive={palette.text} />
          <PixelBlock position={[0.17, y + 0.08, -0.29]} scale={[0.035, 0.035, 0.025]} color={blinkColor} emissive={blinkColor} />
        </group>
      ))}
      <group ref={pulseRef}>
        <PixelBlock position={[0, 0.64, -0.3]} scale={[0.08, 0.08, 0.03]} color={palette.positive} emissive={palette.positive} />
      </group>
    </group>
  );
}

function SignalMast({ position, palette }: { readonly position: Vec3; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[0.42, 0.18, 0.42]} color={palette.border} />
      <PixelBlock position={[0, 0.58, 0]} scale={[0.08, 1.08, 0.08]} color={palette.text} />
      <PixelBlock position={[0, 1.14, 0]} scale={[0.32, 0.08, 0.08]} color={palette.accentStrong} emissive={palette.accentStrong} />
      <PixelBlock position={[0, 1.3, 0]} scale={[0.58, 0.035, 0.035]} color={palette.accent} emissive={palette.accent} />
      {[0.42, 0.7, 0.98].map((width, index) => (
        <PixelBlock
          key={`signal-ring-${width}`}
          position={[0, 1.48 + index * 0.18, 0]}
          scale={[width, 0.035, 0.035]}
          color={palette.accentStrong}
          emissive={palette.accentStrong}
          opacity={0.66 - index * 0.14}
        />
      ))}
    </group>
  );
}

function CaseCrates({ position, palette }: { readonly position: Vec3; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[0.82, 0.42, 0.62]} color={palette.border} />
      <PixelBlock position={[0.12, 0.34, -0.08]} scale={[0.68, 0.28, 0.5]} color={palette.surface} />
      <PixelBlock position={[0.12, 0.53, -0.08]} scale={[0.36, 0.055, 0.055]} color={palette.accentStrong} emissive={palette.accentStrong} />
      <PixelBlock position={[-0.3, 0.33, -0.4]} scale={[0.12, 0.12, 0.05]} color={palette.text} />
      <PixelBlock position={[0.08, 0.33, -0.4]} scale={[0.12, 0.12, 0.05]} color={palette.text} />
    </group>
  );
}

function PixelPlant({ position, palette }: { readonly position: Vec3; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <PixelBlock position={[0, 0, 0]} scale={[0.38, 0.34, 0.38]} color={palette.border} />
      <PixelBlock position={[0, 0.42, 0]} scale={[0.16, 0.44, 0.16]} color={palette.accent} />
      <PixelBlock position={[-0.18, 0.72, 0]} scale={[0.36, 0.18, 0.18]} color={palette.accentStrong} />
      <PixelBlock position={[0.18, 0.86, 0.02]} scale={[0.34, 0.18, 0.18]} color={palette.accentStrong} />
      <PixelBlock position={[0, 1, -0.04]} scale={[0.26, 0.22, 0.22]} color={palette.accentStrong} />
    </group>
  );
}

function WallArt({
  position,
  palette,
  compact = false
}: {
  readonly position: Vec3;
  readonly palette: HqPalette;
  readonly compact?: boolean;
}) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <PixelBlock position={[0, 0, 0]} scale={[compact ? 0.76 : 1.1, compact ? 0.5 : 0.68, 0.06]} color={palette.app} />
      <PixelBlock position={[-0.24, 0.12, 0.04]} scale={[0.16, 0.16, 0.035]} color={palette.accentStrong} emissive={palette.accentStrong} />
      <PixelBlock position={[0.02, -0.05, 0.04]} scale={[0.38, 0.04, 0.035]} color={palette.text} />
      <PixelBlock position={[0.26, 0.13, 0.04]} scale={[0.2, 0.04, 0.035]} color={palette.warning} emissive={palette.warning} />
    </group>
  );
}

function FloorCable({ from, to, palette }: { readonly from: Vec3; readonly to: Vec3; readonly palette: HqPalette }) {
  const midpoint: Vec3 = [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2];
  const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const angle = Math.atan2(to[0] - from[0], to[2] - from[2]);
  return (
    <group position={midpoint} rotation={[0, angle, 0]}>
      <PixelBlock position={[0, 0, 0]} scale={[0.055, 0.055, length]} color={palette.accent} emissive={palette.accent} opacity={0.72} />
    </group>
  );
}

function VoxelAgent(props: {
  readonly agent: AgentPresentation;
  readonly index: number;
  readonly palette: HqPalette;
  readonly context: AgentSceneContext;
  readonly selected: boolean;
  readonly onFocus: (focus: CameraFocusTarget) => void;
  readonly onOpen: (agentId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const position = useMemo<Vec3>(() => agentDeskPosition(props.index), [props.index]);
  const outfit = outfitForAgent(props.agent.agent.id, props.palette);
  const statusColor = statusLightColor(props.agent.state.status, props.palette);
  useFrame(({ clock }) => {
    const typing = props.agent.working ? Math.sin(clock.elapsedTime * 14 + props.index) * 0.035 : Math.sin(clock.elapsedTime * 2 + props.index) * 0.012;
    if (leftHandRef.current) {
      leftHandRef.current.position.y = 0.2 + typing;
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.y = 0.2 - typing;
    }
  });
  return (
    <group
      ref={groupRef}
      position={position}
      onClick={() => props.onOpen(props.agent.agent.id)}
      onDoubleClick={() => props.onFocus(focusAgentCamera(props.agent, props.index))}
    >
      <AgentDesk palette={props.palette} outfit={outfit} working={props.agent.working} />
      <AgentBase selected={props.selected} working={props.agent.working} palette={props.palette} />
      <PixelBlock position={[0, 0.27, 0.09]} scale={[0.43, 0.42, 0.27]} color={outfit.body} emissive={props.agent.working ? props.palette.accent : undefined} />
      <PixelBlock position={[0, 0.4, 0.24]} scale={[0.28, 0.22, 0.045]} color={outfit.vest} />
      <PixelBlock position={[0, 0.24, 0.27]} scale={[0.34, 0.055, 0.05]} color={props.palette.border} />
      <PixelBlock position={[-0.1, 0.29, 0.3]} scale={[0.055, 0.055, 0.035]} color={outfit.accent} emissive={outfit.accent} />
      <PixelBlock position={[0.11, 0.29, 0.3]} scale={[0.08, 0.04, 0.035]} color={props.palette.text} emissive={props.palette.text} />
      <PixelBlock position={[0, 0.75, 0.05]} scale={[0.28, 0.26, 0.24]} color={outfit.head} />
      <PixelBlock position={[0, 0.9, 0.04]} scale={[0.33, 0.13, 0.28]} color={outfit.hair} />
      {outfit.hatBlocks.map((block, index) => (
        <PixelBlock key={`hat-${index}`} {...block} />
      ))}
      <PixelBlock position={[-0.075, 0.79, 0.185]} scale={[0.045, 0.045, 0.03]} color={props.palette.app} />
      <PixelBlock position={[0.075, 0.79, 0.185]} scale={[0.045, 0.045, 0.03]} color={props.palette.app} />
      <PixelBlock position={[0, 0.73, 0.195]} scale={[0.08, 0.025, 0.028]} color={props.palette.border} />
      <PixelBlock position={[-0.2, 0.78, 0.04]} scale={[0.055, 0.18, 0.08]} color={props.palette.border} />
      <PixelBlock position={[0.2, 0.78, 0.04]} scale={[0.055, 0.18, 0.08]} color={props.palette.border} />
      <PixelBlock position={[0.28, 0.73, 0.18]} scale={[0.18, 0.035, 0.035]} color={outfit.accent} emissive={outfit.accent} />
      <PixelBlock position={[-0.26, 0.36, 0.13]} scale={[0.09, 0.26, 0.09]} color={outfit.body} />
      <PixelBlock position={[0.26, 0.36, 0.13]} scale={[0.09, 0.26, 0.09]} color={outfit.body} />
      <PixelBlock ref={leftHandRef} position={[-0.28, 0.2, 0.28]} scale={[0.1, 0.1, 0.08]} color={outfit.head} />
      <PixelBlock ref={rightHandRef} position={[0.28, 0.2, 0.28]} scale={[0.1, 0.1, 0.08]} color={outfit.head} />
      <PixelBlock position={[-0.14, 0.04, 0.08]} scale={[0.14, 0.18, 0.22]} color={props.palette.border} />
      <PixelBlock position={[0.14, 0.04, 0.08]} scale={[0.14, 0.18, 0.22]} color={props.palette.border} />
      <PixelBlock position={[0, 0.42, -0.16]} scale={[0.34, 0.36, 0.08]} color={props.palette.border} />
      <PixelBlock position={[0.17, 0.7, -0.22]} scale={[0.04, 0.36, 0.04]} color={outfit.accent} emissive={outfit.accent} />
      <PixelBlock position={[-0.7, 0.64, -0.35]} scale={[0.13, 0.13, 0.05]} color={statusColor} emissive={statusColor} />
      <AgentTool tool={outfit.tool} palette={props.palette} accent={outfit.accent} />
      {props.agent.working ? <WorkingPixels palette={props.palette} /> : null}
      <Html position={[0, 1.38, 0]} center distanceFactor={7} transform>
        <div className={`agent-hq-label agent-hq-label--${props.agent.state.status}`} tabIndex={0}>
          <div className="agent-hq-card-head">
            <span className={`agent-hq-status-dot agent-hq-status-dot--${props.agent.state.status}`} />
            <span className="agent-hq-label__name">{props.agent.label}</span>
          </div>
          <div className="agent-hq-card-details">
            <strong>{props.agent.state.task ?? props.agent.statusText}</strong>
            <span>{outfit.personality}</span>
            <dl>
              <div><dt>Recent</dt><dd>{props.context.recentRun}</dd></div>
              <div><dt>Previous</dt><dd>{props.context.previousRun}</dd></div>
              <div><dt>Memory</dt><dd>{props.context.memoryCount} saved / {props.context.sharedMemoryCount} shared</dd></div>
              <div><dt>Spend</dt><dd>{props.context.estimatedSpend}</dd></div>
            </dl>
          </div>
        </div>
      </Html>
    </group>
  );
}

function AgentDesk({
  palette,
  outfit,
  working
}: {
  readonly palette: HqPalette;
  readonly outfit: AgentOutfit;
  readonly working: boolean;
}) {
  return (
    <group>
      <Workstation position={[0, 0.31, 0.62]} palette={palette} labelPixels={working ? 6 : 3} accent={outfit.accent} />
      <PixelBlock position={[0, 0.05, -0.05]} scale={[0.58, 0.22, 0.5]} color={palette.raised} />
      <PixelBlock position={[0, 0.28, -0.2]} scale={[0.52, 0.52, 0.12]} color={palette.border} />
      <DeskToy toy={outfit.deskToy} palette={palette} accent={outfit.secondary} />
    </group>
  );
}

function DeskToy({ toy, palette, accent }: { readonly toy: AgentOutfit["deskToy"]; readonly palette: HqPalette; readonly accent: string }) {
  if (toy === "magnifier") {
    return (
      <group>
        <PixelBlock position={[-0.48, 0.55, 0.75]} scale={[0.14, 0.14, 0.04]} color={accent} emissive={accent} />
        <PixelBlock position={[-0.4, 0.46, 0.75]} scale={[0.04, 0.18, 0.04]} color={palette.text} />
      </group>
    );
  }
  if (toy === "blueprint") {
    return <PixelBlock position={[-0.45, 0.48, 0.82]} scale={[0.36, 0.035, 0.22]} color={accent} emissive={accent} opacity={0.8} />;
  }
  if (toy === "antenna") {
    return (
      <group>
        <PixelBlock position={[-0.45, 0.52, 0.75]} scale={[0.08, 0.08, 0.08]} color={palette.app} />
        <PixelBlock position={[-0.45, 0.68, 0.75]} scale={[0.035, 0.3, 0.035]} color={accent} emissive={accent} />
      </group>
    );
  }
  if (toy === "coffee") {
    return <PixelBlock position={[-0.45, 0.52, 0.78]} scale={[0.12, 0.16, 0.12]} color={accent} emissive={accent} />;
  }
  return (
    <group>
      <PixelBlock position={[-0.45, 0.5, 0.78]} scale={[0.16, 0.12, 0.08]} color={palette.warning} emissive={palette.warning} />
      <PixelBlock position={[-0.45, 0.6, 0.78]} scale={[0.1, 0.1, 0.05]} color={accent} />
    </group>
  );
}

function AgentBase({
  selected,
  working,
  palette
}: {
  readonly selected: boolean;
  readonly working: boolean;
  readonly palette: HqPalette;
}) {
  const color = selected ? palette.text : working ? palette.accentStrong : palette.border;
  return (
    <group>
      <PixelBlock position={[0, 0, 0.38]} scale={[0.72, 0.035, 0.08]} color={color} emissive={working || selected ? color : undefined} />
      <PixelBlock position={[0, 0, -0.38]} scale={[0.72, 0.035, 0.08]} color={color} emissive={working || selected ? color : undefined} />
      <PixelBlock position={[-0.38, 0, 0]} scale={[0.08, 0.035, 0.72]} color={color} emissive={working || selected ? color : undefined} />
      <PixelBlock position={[0.38, 0, 0]} scale={[0.08, 0.035, 0.72]} color={color} emissive={working || selected ? color : undefined} />
    </group>
  );
}

function AgentTool({
  tool,
  palette,
  accent
}: {
  readonly tool: AgentOutfit["tool"];
  readonly palette: HqPalette;
  readonly accent: string;
}) {
  if (tool === "scanner") {
    return (
      <group>
        <PixelBlock position={[-0.39, 0.2, 0.22]} scale={[0.2, 0.12, 0.08]} color={palette.app} />
        <PixelBlock position={[-0.5, 0.2, 0.22]} scale={[0.08, 0.08, 0.08]} color={accent} emissive={accent} />
      </group>
    );
  }
  if (tool === "terminal") {
    return (
      <group>
        <PixelBlock position={[0.4, 0.18, 0.22]} scale={[0.26, 0.17, 0.055]} color={palette.app} />
        <PixelBlock position={[0.4, 0.2, 0.255]} scale={[0.18, 0.1, 0.025]} color={accent} emissive={accent} />
      </group>
    );
  }
  if (tool === "wrench") {
    return (
      <group>
        <PixelBlock position={[0.42, 0.19, 0.19]} scale={[0.055, 0.28, 0.055]} color={palette.text} />
        <PixelBlock position={[0.42, 0.32, 0.19]} scale={[0.18, 0.055, 0.055]} color={accent} emissive={accent} />
      </group>
    );
  }
  if (tool === "beacon") {
    return (
      <group>
        <PixelBlock position={[0.4, 0.2, 0.2]} scale={[0.14, 0.16, 0.14]} color={palette.app} />
        <PixelBlock position={[0.4, 0.34, 0.2]} scale={[0.08, 0.08, 0.08]} color={accent} emissive={accent} />
      </group>
    );
  }
  return (
    <group>
      <PixelBlock position={[-0.4, 0.18, 0.2]} scale={[0.22, 0.16, 0.04]} color={palette.text} />
      <PixelBlock position={[-0.4, 0.24, 0.225]} scale={[0.16, 0.035, 0.025]} color={accent} emissive={accent} />
    </group>
  );
}

function WorkingPixels({ palette }: { readonly palette: HqPalette }) {
  return (
    <group>
      {[0.55, 0.75, 0.95].map((height, index) => (
        <PixelBlock
          key={`working-ping-${height}`}
          position={[-0.48 + index * 0.48, height, -0.28]}
          scale={[0.08, 0.08, 0.08]}
          color={index % 2 === 0 ? palette.accentStrong : palette.text}
          emissive={index % 2 === 0 ? palette.accentStrong : palette.text}
          opacity={0.9 - index * 0.14}
        />
      ))}
    </group>
  );
}

const PixelBlock = forwardRef<THREE.Mesh, PixelBlockSpec>(function PixelBlockWithRef(props, ref) {
  const isTransparent = props.opacity !== undefined && props.opacity < 1;
  return (
    <mesh ref={ref} position={props.position} scale={props.scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={props.color}
        emissive={props.emissive ?? "black"}
        emissiveIntensity={props.emissive ? 0.42 : 0}
        flatShading
        metalness={0}
        opacity={props.opacity ?? 1}
        roughness={1}
        transparent={isTransparent}
      />
    </mesh>
  );
});

function outfitForAgent(agentId: string, palette: HqPalette): AgentOutfit {
  if (agentId.includes("architect")) {
    return {
      body: palette.accentStrong,
      vest: palette.app,
      head: palette.text,
      hair: palette.border,
      accent: palette.accent,
      secondary: palette.warning,
      personality: "Blueprint brain",
      tool: "case-file",
      deskToy: "blueprint",
      hatBlocks: [
        { position: [0, 1.02, 0], scale: [0.38, 0.12, 0.32], color: palette.border },
        { position: [0, 1.1, 0.04], scale: [0.26, 0.06, 0.22], color: palette.accentStrong, emissive: palette.accentStrong }
      ]
    };
  }
  if (agentId.includes("scout")) {
    return {
      body: palette.raised,
      vest: palette.accentStrong,
      head: palette.text,
      hair: palette.app,
      accent: palette.accentStrong,
      secondary: palette.positive,
      personality: "Forward recon",
      tool: "scanner",
      deskToy: "antenna",
      hatBlocks: [
        { position: [0, 1, 0.02], scale: [0.42, 0.09, 0.34], color: palette.app },
        { position: [0.24, 1.03, 0.02], scale: [0.08, 0.22, 0.08], color: palette.accentStrong, emissive: palette.accentStrong }
      ]
    };
  }
  if (agentId.includes("byte")) {
    return {
      body: palette.text,
      vest: palette.accent,
      head: palette.border,
      hair: palette.accent,
      accent: palette.accentStrong,
      secondary: palette.text,
      personality: "Terminal gremlin",
      tool: "terminal",
      deskToy: "coffee",
      hatBlocks: [
        { position: [0, 0.99, 0], scale: [0.34, 0.06, 0.3], color: palette.accent },
        { position: [0, 0.85, -0.17], scale: [0.38, 0.045, 0.045], color: palette.app }
      ]
    };
  }
  if (agentId.includes("ripper")) {
    return {
      body: palette.app,
      vest: palette.text,
      head: palette.text,
      hair: palette.raised,
      accent: palette.accentStrong,
      secondary: palette.danger,
      personality: "Signal mechanic",
      tool: "wrench",
      deskToy: "lock",
      hatBlocks: [
        { position: [0, 1.02, 0], scale: [0.4, 0.1, 0.32], color: palette.raised },
        { position: [-0.2, 1.05, 0.06], scale: [0.12, 0.08, 0.18], color: palette.text }
      ]
    };
  }
  return {
    body: palette.raised,
    vest: palette.app,
    head: palette.text,
    hair: palette.app,
    accent: palette.accentStrong,
    secondary: palette.accent,
    personality: "Lead OSINT operator",
    tool: "beacon",
    deskToy: "magnifier",
    hatBlocks: [
      { position: [0, 1.03, 0], scale: [0.5, 0.12, 0.36], color: palette.app },
      { position: [0, 1.13, 0], scale: [0.28, 0.12, 0.24], color: palette.border }
    ]
  };
}

function agentDeskPosition(index: number): Vec3 {
  const positions: readonly Vec3[] = [
    [-2.8, 0.06, -1.35],
    [-0.9, 0.06, -1.55],
    [1.0, 0.06, -1.35],
    [-1.9, 0.06, 1.25],
    [1.8, 0.06, 1.25]
  ];
  return positions[index % positions.length] ?? [0, 0.06, 0];
}

function statusLightColor(status: AgentPresentation["state"]["status"], palette: HqPalette): string {
  if (status === "working") {
    return palette.positive;
  }
  if (status === "error" || status === "offline") {
    return palette.danger;
  }
  return palette.accentStrong;
}

function buildAgentSceneContext(
  agentId: string,
  runs: readonly AgentRunRecord[],
  memory: readonly AgentMemoryRecord[]
): AgentSceneContext {
  const agentRuns = runs.filter((run) => run.agentId === agentId);
  const agentMemory = memory.filter((item) => item.sourceAgent === agentId);
  const sharedMemory = memory.filter((item) => item.scope === "global");
  return {
    recentRun: formatRun(agentRuns[0]),
    previousRun: formatRun(agentRuns[1]),
    memoryCount: agentMemory.length,
    sharedMemoryCount: sharedMemory.length,
    estimatedSpend: estimateSceneSpend(agentRuns)
  };
}

function formatRun(run: AgentRunRecord | undefined): string {
  return run ? `${run.seed.type}:${run.seed.value}` : "none";
}

function estimateSceneSpend(runs: readonly AgentRunRecord[]): string {
  const estimate = runs.reduce((total, run) => total + (run.provider === "openai" ? 0.018 : run.provider === "xai" ? 0.014 : 0.004), 0);
  return `$${estimate.toFixed(3)}`;
}
