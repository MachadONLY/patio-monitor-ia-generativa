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
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Shape,
  Vector2,
  Vector3,
} from "three";
import type { Vehicle } from "./fleet";
import { sampleObservedMotion, updateObservedMotion, type ObservedMotion } from "./observed-motion";
import { localPoint, type Area } from "./observations";
import { AlvoradaStreetDetail } from "./alvorada-street-detail";
import { useAmbientMotion } from "./alvorada-ambience";
import { alvoradaSun } from "./alvorada-sun";
import { AlvoradaArchitecture } from "./alvorada-architecture";
import { pathAlongAlvoradaRoad, projectAlvoradaRoads } from "./alvorada-road-path";
import { AlvoradaCartography } from "./alvorada-cartography";
import { Scenery } from "./scenery";
import { Pedestrians } from "./scene-pedestrians";
import { sampleSimulation } from "./simulation";
import { TERMINAL_GATE } from "./terminal-layout";

const MODEL = "/models/sp-standard-bus.glb";
const DEFAULT_TARGET = new Vector3(0, 0.6, 0);
const TERMINAL_TARGET = new Vector3(2, 0.6, -2);
const DEFAULT_VIEW = new Vector3(38, 43, 59);
export const ALVORADA_TERMINAL: [number, number] = [-43.366102, -23.001922];
const DISTRICT_TARGET = new Vector3(7, 0, -14);
const DISTRICT_VIEW = new Vector3(75, 56, 90);
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export type CameraAction = {
  type: "home" | "terminal" | "district" | "focus" | "follow" | "profile" | "top";
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
  area,
  vehicleGroups,
}: {
  area?: Area;
  vehicleGroups: Map<string, Group>;
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
    } else if (action.type === "terminal" && area) {
      const [x, z] = localPoint(area.origin, ALVORADA_TERMINAL);
      orbit.target.set(x, 1, z);
      camera.position.copy(orbit.target).add(new Vector3(395, 650, 580));
      camera.zoom = Math.min(size.width / 620, size.height / 520);
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
      const rendered = !demo ? vehicleGroups.get(action.vehicle.id)?.position : undefined;
      orbit.target.set(rendered?.x ?? target.x, 1.3, rendered?.z ?? target.z);
      previousPose.current.copy(orbit.target);
      const offset =
        action.type === "top"
          ? new Vector3(0.01, 44, 0.01)
          : action.type === "profile"
            ? new Vector3(42, 8, 0.01)
            : new Vector3(28, 21, 38);
      // Orthographic distance preserves framing while keeping the front clip plane above the terrain.
      offset.setLength(demo ? 550 : Math.max(3000, extent * 2));
      camera.position.copy(orbit.target).add(offset);
      camera.zoom = clamp(base * (action.type === "follow" ? 1.65 : 2.12), 9, 68);
    }
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [action, area?.origin[0], area?.origin[1], base, camera, demo, elapsed, extent, invalidate, size.height, size.width, vehicleGroups]);
  useEffect(() => {
    if (!zoom || !(camera instanceof OrthographicCamera)) return;
    camera.zoom = clamp(camera.zoom * zoom.factor, 0.08, 68);
    camera.updateProjectionMatrix();
    invalidate();
  }, [zoom, camera, invalidate]);

  useFrame(() => {
    const orbit = controls.current;
    if (!action.vehicle || !orbit) return;
    const simulated = action.type === "follow" && elapsed
      ? sampleSimulation(action.vehicle, elapsed.current)
      : undefined;
    const target = simulated
      ? simulated.visible ? simulated : TERMINAL_GATE
      : !demo ? vehicleGroups.get(action.vehicle.id)?.position : undefined;
    if (!target) return;
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
  }, -0.5);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minZoom={0.08}
      maxZoom={68}
      minPolarAngle={0.06}
      maxPolarAngle={1.37}
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
  pinHeight,
  groundHeight,
  roads,
  elapsed,
  vehicleGroups,
}: {
  vehicle: Vehicle;
  selected: boolean;
  onSelect: (id: string) => void;
  showTag: boolean;
  pinHeight?: number;
  groundHeight: number;
  roads?: ReturnType<typeof projectAlvoradaRoads>;
  vehicleGroups: Map<string, Group>;
  elapsed?: SceneSimulation["elapsed"];
}) {
  const { scene } = useGLTF(MODEL);
  const { gl, invalidate } = useThree();
  const group = useRef<Group>(null);
  const motion = useRef<ObservedMotion>(undefined);
  const wheelPivots = useRef<Object3D[]>([]);
  const wheelAngle = useRef(0);
  const lastShadowUpdate = useRef(-Infinity);
  const gpsTime = Date.parse(vehicle.observation?.observedAt ?? "");
  useEffect(() => {
    const bus = group.current;
    if (!bus) return;
    vehicleGroups.set(vehicle.id, bus);
    return () => { vehicleGroups.delete(vehicle.id); };
  }, [vehicle.id, vehicleGroups]);
  useEffect(() => {
    motion.current = updateObservedMotion(motion.current,
      { x: vehicle.x, z: vehicle.z, time: gpsTime }, performance.now(),
      roads ? (from, to) => pathAlongAlvoradaRoad(roads, from, to) : undefined);
    invalidate();
  }, [vehicle.x, vehicle.z, gpsTime, roads, invalidate]);
  const tag = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const initialPosition = useRef<[number, number, number]>([vehicle.x, groundHeight, vehicle.z]);
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
    const now = performance.now();
    const observed = motion.current;
    const pose = elapsed
      ? sampleSimulation(vehicle, elapsed.current)
      : { ...(observed ? sampleObservedMotion(observed, now) : { x: vehicle.x, z: vehicle.z, heading: 0 }), visible: true };
    if (observed && now < observed.startsAt + observed.duration) invalidate();
    if (
      bus.position.y !== groundHeight ||
      bus.position.x !== pose.x ||
      bus.position.z !== pose.z ||
      bus.rotation.y !== pose.heading
    ) {
      const meters = Math.hypot(pose.x - bus.position.x, pose.z - bus.position.z);
      if ((elapsed || observed?.duration) && meters < 16) {
        wheelAngle.current = (wheelAngle.current + meters / 0.505) % (Math.PI * 2);
        for (const wheel of wheelPivots.current) wheel.rotation.x = wheelAngle.current;
      }
      bus.position.set(pose.x, groundHeight, pose.z);
      bus.rotation.y = pose.heading;
      bus.updateMatrixWorld(true);
      if (now - lastShadowUpdate.current >= 250) {
        gl.shadowMap.needsUpdate = true;
        lastShadowUpdate.current = now;
      }
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
  useEffect(() => {
    const wheels: Object3D[] = [];
    object.traverse((child) => {
      if (child.name.startsWith("Wheels") && child.name.endsWith("pivot")) wheels.push(child);
    });
    wheelPivots.current = wheels;
  }, [object]);
  return (
    <group ref={group} position={initialPosition.current}>
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
      {pinHeight !== undefined && (
        <Html position={[0, pinHeight, 0]} center zIndexRange={[10, 4]}>
          <button type="button" className={pinHeight === 16 ? "live-bus-pin terminal-bus-pin" : "live-bus-pin"}
            aria-label={`Localizar ônibus ${vehicle.id}`} aria-pressed={selected} onClick={() => onSelect(vehicle.id)}>
            <BusFront size={16} aria-hidden="true" />
          </button>
        </Html>
      )}
      {selected && (
        <>
          <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.48, 12.8]} />
            <meshBasicMaterial
              color="#3cf0bc"
              opacity={0.19}
              transparent
              depthWrite={false}
            />
          </mesh>
          {(
            [
              [0, 0.13, 6.45, 3.57, 0.065],
              [0, 0.13, -6.45, 3.57, 0.065],
              [-1.78, 0.13, 0, 0.065, 12.96],
              [1.78, 0.13, 0, 0.065, 12.96],
            ] as const
          ).map(([x, y, z, w, d], i) => (
            <mesh key={i} position={[x, y, z]}>
              <boxGeometry args={[w, 0.028, d]} />
              <meshBasicMaterial color="#6cffc8" toneMapped={false} />
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

function AlvoradaBasemap({ area, animate }: { area: Area; animate: boolean }) {
  const active = useAmbientMotion() && animate;
  return (
    <>
      <AlvoradaCartography origin={area.origin} active={active} />
      <AlvoradaArchitecture area={area} />
      <AlvoradaStreetDetail area={area} active={active} />
    </>
  );
}

export function hasAlvoradaMap(area?: Area) {
  return Boolean(area && Math.abs(area.origin[0] + 43.360556) < 0.008 &&
    Math.abs(area.origin[1] + 22.995833) < 0.008);
}

function ObservedTerrain({
  ring,
  extent,
  area,
  animate,
}: {
  area?: Area;
  ring: [number, number][];
  animate: boolean;
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <shapeGeometry args={[outline]} />
          <meshStandardMaterial color={hasAlvoradaMap(area) ? "#bec5a6" : "#819e92"} side={2} />
        </mesh>
      )}
      {area && hasAlvoradaMap(area) && <AlvoradaBasemap area={area} animate={animate} />}
    </>
  );
}

function TerminalSun({ area }: { area?: Area }) {
  const light = useRef<DirectionalLight>(null);
  const { gl, invalidate } = useThree();
  const isAlvorada = hasAlvoradaMap(area);
  const [x, z] = area && isAlvorada ? localPoint(area.origin, ALVORADA_TERMINAL) : [0, 0];
  const span = isAlvorada ? 410 : 75;

  useEffect(() => {
    const sun = light.current;
    if (!sun) return;
    function updateLight() {
      if (!sun) return;
      const [east, elevation, south] = alvoradaSun(new Date());
      if (isAlvorada) {
        // Low-fill lighting keeps the operational view readable after sunset.
        sun.position.set(x + east * 660, Math.max(0.25, elevation) * 660, z + south * 660);
        sun.intensity = elevation > 0 ? 1.88 + Math.min(1, elevation * 2) * 0.92 : 1.15;
        sun.color.set(elevation > 0.35 ? "#fff2dc" : elevation > 0 ? "#ffdfbc" : "#d2e0fb");
      }
      sun.target.position.set(x, 0, z);
      sun.target.updateMatrixWorld();
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.needsUpdate = true;
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }
    updateLight();
    if (!isAlvorada) return;
    const timer = window.setInterval(updateLight, 60_000);
    return () => window.clearInterval(timer);
  }, [x, z, gl, invalidate, isAlvorada]);

  return <directionalLight ref={light} color="#fff0d6" intensity={isAlvorada ? 2.5 : 2.85}
    position={isAlvorada ? [x - 320, 485, z + 245] : [-43, 80, 45]} castShadow
    shadow-mapSize={isAlvorada ? [1536, 1536] : [1024, 1024]}
    shadow-camera-left={-span} shadow-camera-right={span}
    shadow-camera-top={span} shadow-camera-bottom={-span}
    shadow-camera-near={1} shadow-camera-far={isAlvorada ? 1300 : 215}
    shadow-normalBias={isAlvorada ? 0.55 : 0.025} shadow-bias={-0.00015} />;
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
  animateAmbience = true,
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
  animateAmbience?: boolean;
}) {
  const demoSimulation = demo ? simulation : undefined;
  const vehicleGroups = useRef(new Map<string, Group>()).current;
  const ring = useMemo(
    () =>
      area ? area.ring.map((point) => localPoint(area.origin, point)) : [],
    [area],
  );
  const east = area?.origin[0];
  const north = area?.origin[1];
  const roads = useMemo(() => east !== undefined && north !== undefined && hasAlvoradaMap(area)
    ? projectAlvoradaRoads([east, north]) : undefined, [east, north]);
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
        dpr={[1, 1.25]}
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
        <hemisphereLight color="#e0efff" groundColor="#a99e88" intensity={demo ? 1.38 : 1.05} />
        <TerminalSun area={demo ? undefined : area} />
        <CameraRig
          action={action}
          zoom={zoom}
          extent={extent}
          area={area}
          demo={demo}
          elapsed={demoSimulation?.elapsed}
          vehicleGroups={vehicleGroups}
        />
        <Suspense fallback={null}>
          <SimulationClock simulation={demoSimulation} />
          {demo ? <Scenery /> : <ObservedTerrain ring={ring} extent={extent} area={area} animate={animateAmbience} />}
          {demoSimulation && <Pedestrians elapsed={demoSimulation.elapsed} />}
          {vehicles.map((vehicle) => (
            <Bus
              key={`${demo ? "demo" : "observed"}:${vehicle.id}`}
              vehicle={vehicle}
              selected={selected === vehicle.id}
              onSelect={onSelect}
              vehicleGroups={vehicleGroups}
              roads={roads}
              groundHeight={!demo && hasAlvoradaMap(area) ? 0.27 : 0.018}
              pinHeight={!demo && (action.type === "home" || action.type === "terminal")
                ? action.type === "terminal" ? 16 : 8
                : undefined}
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
