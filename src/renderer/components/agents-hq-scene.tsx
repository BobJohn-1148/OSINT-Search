/**
 * The HQ scene is isolated from IPC because Claw3D-style rendering should only
 * visualize state. If a mesh could start jobs or fetch memory, the animation
 * loop would become a hidden tool runner and violate STABILITY.md.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { AgentPresentation } from "../agents/agent-status";
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
      <ambientLight intensity={0.72} color={props.palette.raised} />
      <directionalLight position={[3, 8, 5]} intensity={2.2} color={props.palette.accentStrong} castShadow />
      <pointLight position={[-3, 2.5, -2]} intensity={1.4} color={props.palette.accent} />
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
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial color={palette.surface} roughness={0.9} />
      </mesh>
      <Wall position={[0, 1, -3]} scale={[9, 2, 0.16]} palette={palette} />
      <Wall position={[-4.5, 1, 0]} scale={[0.16, 2, 6]} palette={palette} />
      <Desk position={[-2.5, 0.35, -1.3]} palette={palette} />
      <Desk position={[0, 0.35, -1.3]} palette={palette} />
      <Desk position={[2.5, 0.35, -1.3]} palette={palette} />
      <ServerRack position={[3.7, 0.75, 1.7]} palette={palette} />
      <ServerRack position={[3.05, 0.75, 1.7]} palette={palette} />
      <Couch position={[-2.9, 0.28, 1.8]} palette={palette} />
      <Plant position={[-4, 0.35, 2.3]} palette={palette} />
      <Whiteboard position={[-3.4, 1.18, -2.9]} palette={palette} />
    </group>
  );
}

function Wall(props: { readonly position: [number, number, number]; readonly scale: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <mesh position={props.position} scale={props.scale} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={props.palette.raised} roughness={0.82} />
    </mesh>
  );
}

function Desk({ position, palette }: { readonly position: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow scale={[1.35, 0.16, 0.72]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.border} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.33, -0.18]} castShadow scale={[0.58, 0.36, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.app} emissive={palette.accent} emissiveIntensity={0.32} />
      </mesh>
      <mesh position={[0, 0.08, 0.18]} castShadow scale={[0.46, 0.05, 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.text} />
      </mesh>
    </group>
  );
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
        <meshStandardMaterial color={palette.accentStrong} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Whiteboard({ position, palette }: { readonly position: [number, number, number]; readonly palette: HqPalette }) {
  return (
    <mesh position={position} castShadow scale={[1.7, 0.72, 0.05]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={palette.text} emissive={palette.accent} emissiveIntensity={0.08} />
    </mesh>
  );
}

function AgentCharacter(props: {
  readonly agent: AgentPresentation;
  readonly index: number;
  readonly palette: HqPalette;
  readonly selected: boolean;
  readonly onFocus: (focus: CameraFocusTarget) => void;
  readonly onOpen: (agentId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const position = useMemo<[number, number, number]>(() => [(props.index % 3) * 2.1 - 2.1, 0.06, Math.floor(props.index / 3) * 2.1 - 0.8], [props.index]);
  const outfit = outfitForAgent(props.agent.agent.id, props.palette);
  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.rotation.y += props.agent.working ? delta * 0.9 : delta * 0.18;
  });
  return (
    <group
      ref={groupRef}
      position={position}
      onClick={() => props.onOpen(props.agent.agent.id)}
      onDoubleClick={() => props.onFocus(focusAgentCamera(props.agent, props.index))}
    >
      <mesh castShadow position={[0, 0.32, 0]} scale={[0.34, 0.58, 0.24]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={outfit.body}
          emissive={props.agent.working || props.selected ? props.palette.accent : props.palette.app}
          emissiveIntensity={props.agent.working ? 0.18 : props.selected ? 0.12 : 0.02}
        />
      </mesh>
      <mesh castShadow position={[0, 0.82, 0]} scale={[0.22, 0.22, 0.22]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={outfit.head} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0, 1.03, 0]} scale={outfit.hatScale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={outfit.hat} />
      </mesh>
      {outfit.extra ? (
        <mesh castShadow position={outfit.extra.position} scale={outfit.extra.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={outfit.extra.color} />
        </mesh>
      ) : null}
      {props.agent.working ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[0.58, 0.58, 0.58]}>
          <torusGeometry args={[0.5, 0.025, 8, 20]} />
          <meshStandardMaterial color={props.palette.accentStrong} emissive={props.palette.accentStrong} emissiveIntensity={0.85} />
        </mesh>
      ) : null}
      {props.selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} scale={[0.74, 0.74, 0.74]}>
          <torusGeometry args={[0.5, 0.02, 8, 20]} />
          <meshStandardMaterial color={props.palette.text} emissive={props.palette.accent} emissiveIntensity={0.35} />
        </mesh>
      ) : null}
      <Html position={[0, 1.35, 0]} center distanceFactor={7} transform>
        <div className="agent-hq-label">
          <span>{props.agent.label}</span>
          <strong>{props.agent.statusText}</strong>
        </div>
      </Html>
    </group>
  );
}

function outfitForAgent(agentId: string, palette: HqPalette) {
  if (agentId.includes("architect")) {
    return { body: palette.accentStrong, head: palette.text, hat: palette.border, hatScale: [0.32, 0.18, 0.32] as [number, number, number], extra: null };
  }
  if (agentId.includes("scout")) {
    return { body: palette.raised, head: palette.text, hat: palette.app, hatScale: [0.36, 0.12, 0.36] as [number, number, number], extra: { position: [0.24, 0.88, 0] as [number, number, number], scale: [0.08, 0.2, 0.3] as [number, number, number], color: palette.accentStrong } };
  }
  if (agentId.includes("byte")) {
    return { body: palette.text, head: palette.border, hat: palette.accent, hatScale: [0.28, 0.08, 0.28] as [number, number, number], extra: { position: [0, 0.84, -0.14] as [number, number, number], scale: [0.34, 0.05, 0.04] as [number, number, number], color: palette.app } };
  }
  if (agentId.includes("ripper")) {
    return { body: palette.app, head: palette.text, hat: palette.raised, hatScale: [0.34, 0.14, 0.34] as [number, number, number], extra: null };
  }
  return { body: palette.raised, head: palette.text, hat: palette.app, hatScale: [0.48, 0.26, 0.48] as [number, number, number], extra: null };
}
