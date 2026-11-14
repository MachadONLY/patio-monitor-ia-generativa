import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BusFront } from "lucide-react";
import {
  Component,
  Suspense,
  type ComponentRef,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Shape,
  Vector2,
  Vector3,
} from "three";
import type { Vehicle } from "./fleet";
import { localPoint, type Area } from "./observations";
import { Scenery } from "./scenery";
import { Pedestrians } from "./scene-pedestrians";
import { sampleSimulation } from "./simulation";
import { TERMINAL_GATE } from "./terminal-layout";

const MODEL = "/models/sp-standard-bus.glb";
const DEFAULT_TARGET = new Vector3(0, 0.6, 0);
const TERMINAL_TARGET = new Vector3(2, 0.6, -2);
const DEFAULT_VIEW = new Vector3(38, 38, 59);
const DISTRICT_TARGET = new Vector3(7, 0, -14);
const DISTRICT_VIEW = new Vector3(75, 56, 90);
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export type CameraAction = {
  type: "home" | "district" | "focus" | "follow" | "profile" | "top";
  vehicle?: Vehicle;
};

export type CameraZoom = { factor: number };

type SceneSimulation = {
  animate: boolean;
  readTime: () => number;
  elapsed: { current: number };
};

function SimulationClock({ simulation }: { simulation?: SceneSimulation }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    if (!simulation || simulation.animate) return;
    const timer = window.setInterval(() => invalidate(), 1000);
    return () => window.clearInterval(timer);
  }, [invalidate, simulation]);

  useFrame(() => {
    if (!simulation) return;
    simulation.elapsed.current = simulation.readTime();
    if (simulation.animate) invalidate();
  }, -2);
  return null;
}

function CameraRig({
  action,
  zoom,
  extent,
  demo,
  elapsed,
}: {
  action: CameraAction;
  zoom?: CameraZoom;
  extent: number;
  demo: boolean;
  elapsed?: SceneSimulation["elapsed"];
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousPose = useRef(new Vector3());
  const { camera, invalidate, size } = useThree();
  const base =
    (Math.min(size.width / (size.width < 620 ? 40 : 53), size.height / 35) *
      27) /
    extent;
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !(camera instanceof OrthographicCamera)) return;
    if (action.type === "home") {
      orbit.target.copy(demo ? TERMINAL_TARGET : DEFAULT_TARGET);
      camera.position
        .copy(DEFAULT_VIEW)
        .multiplyScalar(Math.max(1, extent / 27));
      if (demo) camera.position.add(new Vector3(TERMINAL_TARGET.x, 0, TERMINAL_TARGET.z));
      camera.zoom = base;
    } else if (action.type === "district") {
      orbit.target.copy(DISTRICT_TARGET);
      camera.position.copy(DISTRICT_TARGET).add(DISTRICT_VIEW);
      camera.zoom = base * 0.74;
    } else if (action.vehicle) {
      const pose = elapsed
        ? sampleSimulation(action.vehicle, elapsed.current)
        : action.vehicle;
      const unavailable = "visible" in pose && !pose.visible;
      const target = unavailable ? TERMINAL_GATE : pose;
      orbit.target.set(target.x, 1.3, target.z);
      previousPose.current.copy(orbit.target);
      const offset =
        action.type === "top"
          ? new Vector3(0.01, 44, 0.01)
          : action.type === "profile"
            ? new Vector3(42, 5, 0.01)
            : new Vector3(28, 21, 38);
      camera.position.copy(orbit.target).add(offset);
      camera.zoom = clamp(base * (action.type === "follow" ? 1.65 : 2.12), 9, 68);
    }
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [action, base, camera, demo, elapsed, extent, invalidate]);
  useEffect(() => {
    if (!zoom || !(camera instanceof OrthographicCamera)) return;
    camera.zoom = clamp(camera.zoom * zoom.factor, 0.08, 68);
    camera.updateProjectionMatrix();
    invalidate();
  }, [zoom, camera, invalidate]);

  useFrame(() => {
    const orbit = controls.current;
    if (action.type !== "follow" || !action.vehicle || !elapsed || !orbit) return;
    const pose = sampleSimulation(action.vehicle, elapsed.current);
    // Keep the camera at the gate while the vehicle is outside the modeled area.
    const target = pose.visible ? pose : TERMINAL_GATE;
    const previous = previousPose.current;
    const dx = target.x - previous.x;
    const dz = target.z - previous.z;
    if (dx === 0 && dz === 0) return;
    previous.set(target.x, 1.3, target.z);
    orbit.target.x += dx;
    orbit.target.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
    orbit.update();
  }, -1);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minZoom={0.08}
      maxZoom={68}
      minPolarAngle={0.06}
      maxPolarAngle={1.43}
      enableDamping={false}
      enablePan={action.type !== "follow"}
    />
  );
}

function Bus({
  vehicle,
  selected,
  onSelect,
  showTag,
  elapsed,
}: {
  vehicle: Vehicle;
  selected: boolean;
  onSelect: (id: string) => void;
  showTag: boolean;
  elapsed?: SceneSimulation["elapsed"];
}) {
  const { scene } = useGLTF(MODEL);
  const { gl, invalidate } = useThree();
  const group = useRef<Group>(null);
  const tag = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  useEffect(
    () => () => {
      if (hovering.current) document.body.style.cursor = "";
    },
    [],
  );
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, vehicle.x, vehicle.z]);
  // Apply the pose before the default-priority Html overlay projects its tag.
  useFrame(() => {
    const bus = group.current;
    if (!bus) return;
    const pose = elapsed
      ? sampleSimulation(vehicle, elapsed.current)
      : { x: vehicle.x, z: vehicle.z, heading: 0, visible: true };
    if (
      bus.position.x !== pose.x ||
      bus.position.z !== pose.z ||
      bus.rotation.y !== pose.heading
    ) {
      bus.position.set(pose.x, 0.018, pose.z);
      bus.rotation.y = pose.heading;
      bus.updateMatrixWorld(true);
      gl.shadowMap.needsUpdate = true;
    }
    if (bus.visible !== pose.visible) {
      bus.visible = pose.visible;
      gl.shadowMap.needsUpdate = true;
    }
    // Drei's HTML overlays are rendered outside the WebGL scene.
    if (tag.current && tag.current.hidden === pose.visible) {
      tag.current.hidden = !pose.visible;
      tag.current.style.display = pose.visible ? "" : "none";
    }
    if (!pose.visible && hovering.current) {
      document.body.style.cursor = "";
      hovering.current = false;
    }
  }, -1);
  const paint = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: new Color(vehicle.paint),
      metalness: 0.16,
      roughness: 0.35,
    });
    material.name = "Livery";
    return material;
  }, [vehicle.paint]);
  useEffect(() => () => paint.dispose(), [paint]);
  const object = useMemo(() => {
    const instance = scene.clone(true);
    instance.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material.name === "Livery") child.material = paint;
      }
    });
    return instance;
  }, [scene, paint]);
  return (
    <group ref={group} position={[vehicle.x, 0.018, vehicle.z]}>
      <primitive
        object={object}
        onClick={(event: { stopPropagation: () => void }) => {
          if (group.current?.visible === false) return;
          event.stopPropagation();
          onSelect(vehicle.id);
        }}
        onPointerOver={(event: { stopPropagation: () => void }) => {
          if (group.current?.visible === false) return;
          event.stopPropagation();
          hovering.current = true;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (!hovering.current) return;
          hovering.current = false;
          document.body.style.cursor = "";
        }}
      />
      {selected && (
        <>
          <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.48, 12.8]} />
            <meshBasicMaterial
              color="#3cf0bc"
              opacity={0.24}
              transparent
              depthWrite={false}
            />
          </mesh>
          {(
            [
              [0, 0.054, 6.45, 3.57, 0.065],
              [0, 0.054, -6.45, 3.57, 0.065],
              [-1.78, 0.054, 0, 0.065, 12.96],
              [1.78, 0.054, 0, 0.065, 12.96],
            ] as const
          ).map(([x, y, z, w, d], i) => (
            <mesh key={i} position={[x, y, z]}>
              <boxGeometry args={[w, 0.028, d]} />
              <meshBasicMaterial color="#69ffcf" toneMapped={false} />
            </mesh>
          ))}
          {showTag && (
            <Html
              position={[0, 3.7, 0]}
              center
              zIndexRange={[12, 0]}
              style={{ pointerEvents: "none" }}
            >
              <div className="bus-tag" ref={tag} data-vehicle-id={vehicle.id}>
                <BusFront size={18} />
                <strong>{vehicle.id}</strong>
                <span>{vehicle.line}</span>
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const { gl: renderer, invalidate } = useThree();
  useEffect(() => {
    if (!renderer.getContext().isContextLost()) {
      renderer.shadowMap.needsUpdate = true;
      invalidate();
      onReady();
    }
  }, [renderer, invalidate, onReady]);
  return null;
}

class SceneError extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  componentDidCatch() {
    this.props.onFailure();
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ObservedTerrain({
  ring,
  extent,
}: {
  ring: [number, number][];
  extent: number;
}) {
  const outline = useMemo(
    () =>
      ring.length
        ? new Shape(ring.map(([x, z]) => new Vector2(x, -z)))
        : new Shape(),
    [ring],
  );
  return (
    <>
      <mesh
        position={[0, -0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[extent * 6, extent * 6]} />
        <meshStandardMaterial color="#bec8bb" />
      </mesh>
      {ring.length > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[outline]} />
          <meshStandardMaterial color="#819e92" side={2} />
        </mesh>
      )}
    </>
  );
}

export function Scene({
  vehicles,
  selected,
  onSelect,
  action,
  zoom,
  onReady,
  onFailure,
  demo,
  area,
  simulation,
}: {
  vehicles: Vehicle[];
  selected: string | null;
  onSelect: (id: string) => void;
  action: CameraAction;
  zoom?: CameraZoom;
  onReady: () => void;
  onFailure: () => void;
  demo: boolean;
  area?: Area;
  simulation?: SceneSimulation;
}) {
  const demoSimulation = demo ? simulation : undefined;
  const ring = useMemo(
    () =>
      area ? area.ring.map((point) => localPoint(area.origin, point)) : [],
    [area],
  );
  const extent = Math.max(
    demo ? 64 : 27,
    ...ring.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))),
  );

  const fallback = (
    <div className="canvas-notice">
      Cena 3D indisponível. A lista de veículos continua acessível.
    </div>
  );
  return (
    <SceneError fallback={fallback} onFailure={onFailure}>
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.4]}
        frameloop="demand"
        fallback={fallback}
        camera={{
          position: DEFAULT_VIEW.toArray(),
          zoom: 18,
          near: 0.1,
          far: 22000,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
        aria-label="Pátio de ônibus em 3D"
      >
        <color attach="background" args={["#c8dce9"]} />
        {demo && <fog attach="fog" args={["#c8dce9", 196, 295]} />}
        <hemisphereLight
          color="#e0efff"
          groundColor="#968b73"
          intensity={1.38}
        />
        <directionalLight
          color="#fff4dd"
          intensity={2.85}
          position={[-43, 80, 45]}
          castShadow
          shadow-mapSize={[1536, 1536]}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={68}
          shadow-camera-bottom={-64}
          shadow-camera-far={215}
          shadow-normalBias={0.025}
          shadow-bias={-0.00015}
        />
        <CameraRig
          action={action}
          zoom={zoom}
          extent={extent}
          demo={demo}
          elapsed={demoSimulation?.elapsed}
        />
        <Suspense fallback={null}>
          <SimulationClock simulation={demoSimulation} />
          {demo ? <Scenery /> : <ObservedTerrain ring={ring} extent={extent} />}
          {demoSimulation && <Pedestrians elapsed={demoSimulation.elapsed} />}
          {!demo && extent > 200 && action.type === "home" && vehicles.map((vehicle) => (
            <mesh
              key={`position:${vehicle.id}`}
              position={[vehicle.x, 2, vehicle.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(vehicle.id);
              }}
            >
              <ringGeometry args={[extent / 75, extent / 50, 24]} />
              <meshBasicMaterial color={selected === vehicle.id ? "#18583e" : "#286e58"} />
            </mesh>
          ))}
          {vehicles.map((vehicle) => (
            <Bus
              key={`${demo ? "demo" : "observed"}:${vehicle.id}`}
              vehicle={vehicle}
              selected={selected === vehicle.id}
              onSelect={onSelect}
              showTag={action.type !== "top" && action.type !== "profile"}
              elapsed={demoSimulation?.elapsed}
            />
          ))}
          <Ready key={demo ? "demo" : "observed"} onReady={onReady} />
        </Suspense>
      </Canvas>
    </SceneError>
  );
}
