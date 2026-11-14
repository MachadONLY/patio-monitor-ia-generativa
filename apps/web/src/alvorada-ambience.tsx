import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, DynamicDrawUsage, Object3D, type InstancedMesh } from "three";
import routes from "./alvorada-ambient-paths.json";
import { localPoint, type Area } from "./observations";
import { seeded, type XYZ } from "./scenery-kit";

type Point = [number, number];
type Kind = "driver" | "walker";
type Route = { points: Point[]; distances: number[]; length: number; kind: Kind; height: number };
type Actor = { route: Route; offset: number; phase: number; direction: number; width: number; scale: number; speed: number; tint: string };
type Part = { at: XYZ; size: XYZ; color: string; swing?: number; geometry: "box" | "head" | "wheel" | "shadow" };

export function useAmbientMotion() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setActive(!document.hidden && !preference.matches);
    update();
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return active;
}

function surveyedRoute(origin: Area["origin"], points: number[][], kind: Kind, height: number): Route {
  const projected = points.map((coordinates) => localPoint(origin, coordinates as Point));
  const distinct = projected.filter(([x, z], index) => !index ||
    Math.hypot(x - projected[index - 1][0], z - projected[index - 1][1]) > 0.02);
  const distances = [0];
  for (let index = 1; index < distinct.length; index++) {
    const [x, z] = distinct[index];
    const [previousX, previousZ] = distinct[index - 1];
    distances.push(distances[index - 1] + Math.hypot(x - previousX, z - previousZ));
  }
  return { points: distinct, distances, length: distances.at(-1) ?? 0, kind, height };
}

function pointAt(route: Route, distance: number): Point {
  const target = Math.max(0, Math.min(route.length, distance));
  let segment = 1;
  while (segment < route.distances.length - 1 && route.distances[segment] < target) segment++;
  const from = route.points[segment - 1];
  const to = route.points[segment];
  const progress = (target - route.distances[segment - 1]) / (route.distances[segment] - route.distances[segment - 1]);
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

const colors = ["#f2ebe0", "#345d76", "#d1b49b", "#aa3a36", "#4a5457", "#b9cacf"];
const clothes = ["#156f9a", "#d06145", "#d7ac38", "#56725a", "#dcd4bf", "#825499"];
const carParts: Part[] = [
  { at: [0, 0.51, 0], size: [1.78, 0.48, 4.25], color: "paint", geometry: "box" },
  { at: [0, 0.39, 0], size: [1.72, 0.25, 4.28], color: "#2b3336", geometry: "box" },
  { at: [0, 0.94, -0.27], size: [1.44, 0.52, 2.14], color: "#314e5c", geometry: "box" },
  { at: [0, 1.22, -0.32], size: [1.4, 0.12, 1.71], color: "paint", geometry: "box" },
  { at: [0, 0.04, 0], size: [2.3, 1, 4.9], color: "#101917", geometry: "shadow" },
  ...[-1, 1].flatMap((side): Part[] => [
    { at: [side * 0.88, 0.32, -1.26], size: [0.26, 0.65, 0.65], color: "#202427", geometry: "wheel" },
    { at: [side * 0.88, 0.32, 1.27], size: [0.26, 0.65, 0.65], color: "#202427", geometry: "wheel" },
    { at: [side * 0.63, 0.62, 2.14], size: [0.39, 0.14, 0.07], color: "#fff4d6", geometry: "box" },
    { at: [side * 0.63, 0.56, -2.14], size: [0.4, 0.14, 0.07], color: "#f24a32", geometry: "box" },
  ]),
];

const personParts: Part[] = [
  { at: [0, 1.18, 0], size: [0.39, 0.55, 0.26], color: "paint", geometry: "box" },
  { at: [0, 1.61, 0.035], size: [0.23, 0.27, 0.24], color: "#b98567", geometry: "head" },
  { at: [0, 1.71, 0.016], size: [0.22, 0.10, 0.21], color: "#382d2b", geometry: "head" },
  { at: [0, 0.04, 0], size: [0.60, 1, 0.81], color: "#202320", geometry: "shadow" },
  ...[-1, 1].flatMap((side): Part[] => [
    { at: [side * 0.11, 0.45, 0], size: [0.15, 0.73, 0.17], color: "#37454f", swing: side, geometry: "box" },
    { at: [side * 0.25, 1.10, 0.015], size: [0.115, 0.49, 0.13], color: "paint", swing: -side * 0.67, geometry: "box" },
    { at: [side * 0.11, 0.11, 0.04], size: [0.16, 0.13, 0.27], color: "#35312d", swing: side, geometry: "box" },
  ]),
];

export function AlvoradaAmbience({ origin, platforms, active }: {
  origin: Area["origin"];
  platforms: Point[][];
  active: boolean;
}) {
  const actors = useMemo(() => {
    const random = seeded(831044);
    const vehicles = routes.roads.flatMap((path, routeIndex) => {
      const route = surveyedRoute(origin, path, "driver", 0.235);
      const count = Math.min(15, Math.max(5, Math.floor(route.length / 95)));
      return Array.from({ length: count }, (_, slot): Actor => ({
        route, offset: (slot + 0.22) * route.length / count,
        phase: random(), direction: 1, width: (slot % 2 ? 1 : -1) * 1.55,
        scale: 0.9 + random() * 0.22, speed: routeIndex < 2 ? 12 : 14,
        tint: colors[Math.floor(random() * colors.length)],
      }));
    });
    const pedestrians = [...platforms.map((path) => ({ path, height: 0.83, count: 9 })),
      ...routes.walks.map((path) => ({ path, height: 0.285, count: 3 }))].flatMap(({ path, height, count }) => {
      const route = surveyedRoute(origin, path, "walker", height);
      return Array.from({ length: count }, (_, slot): Actor => ({
        route, offset: (slot + 0.44) * route.length / count, phase: random() * 6, direction: slot % 2 ? -1 : 1,
        width: (slot % 2 ? 1 : -1) * (0.43 + random() * 0.54),
        scale: 0.88 + random() * 0.2, speed: 1.05 + random() * 0.52,
        tint: clothes[Math.floor(random() * clothes.length)],
      }));
    });
    return [...vehicles, ...pedestrians];
  }, [origin[0], origin[1], platforms]);
  const batches = useMemo(() => {
    const shapes = ["box", "head", "wheel", "shadow"] as const;
    return Object.fromEntries(shapes.map((geometry) => [geometry, actors.flatMap((actor, index) =>
      (actor.route.kind === "driver" ? carParts : personParts).filter((part) => part.geometry === geometry)
        .map((part) => ({ index, part })))])) as Record<typeof shapes[number], { index: number; part: Part }[]>;
  }, [actors]);
  const meshes = useRef<Partial<Record<keyof typeof batches, InstancedMesh>>>({});
  const root = useMemo(() => new Object3D(), []);
  const actorPose = useMemo(() => actors.map(() => new Object3D()), [actors]);
  const time = useRef(0);
  const pendingFrame = useRef(0);
  const invalidate = useThree((state) => state.invalidate);

  function renderActors(seconds: number) {
    actors.forEach((actor, index) => {
      const { route, offset, direction, width, phase, speed, scale } = actor;
      const isCar = route.kind === "driver";
      const cycle = isCar ? route.length : route.length * 2;
      const progress = ((offset + seconds * speed * direction) % cycle + cycle) % cycle;
      const signed = (progress < route.length ? 1 : -1) * direction;
      const distance = progress < route.length ? progress : cycle - progress;
      const [x, z] = pointAt(route, distance);
      const tangent = isCar ? 5 : 1.5;
      const before = pointAt(route, distance - tangent);
      const after = pointAt(route, distance + tangent);
      const heading = Math.atan2((after[0] - before[0]) * signed, (after[1] - before[1]) * signed);
      const pose = actorPose[index];
      const fade = isCar ? Math.max(0.01, Math.min(1, distance / 12, (route.length - distance) / 12)) : 1;
      pose.position.set(x + Math.cos(heading) * width, route.height, z - Math.sin(heading) * width);
      pose.rotation.set(0, heading, 0);
      pose.scale.setScalar(scale * fade);
      pose.updateMatrix();
    });

    for (const kind of Object.keys(batches) as (keyof typeof batches)[]) {
      const mesh = meshes.current[kind];
      if (!mesh) continue;
      batches[kind].forEach(({ index, part }, slot) => {
        const { phase, speed } = actors[index];
        const stride = Math.sin(seconds * speed * 6 + phase) * (part.swing ?? 0);
        root.position.set(part.at[0], part.at[1] + Math.abs(stride) * 0.055, part.at[2] + stride * 0.24);
        root.rotation.set(kind === "wheel" ? 0 : -stride * 0.52, 0, kind === "wheel" ? Math.PI / 2 : 0);
        const [width, height, depth] = part.size;
        root.scale.set(kind === "wheel" ? height : width, kind === "wheel" ? width : height, depth);
        root.updateMatrix();
        root.matrix.premultiply(actorPose[index].matrix);
        mesh.setMatrixAt(slot, root.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  useLayoutEffect(() => {
    const color = new Color();
    for (const kind of Object.keys(batches) as (keyof typeof batches)[]) {
      const mesh = meshes.current[kind];
      if (!mesh) continue;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      batches[kind].forEach(({ index, part }, slot) => {
        mesh.setColorAt(slot, color.set(part.color === "paint" ? actors[index].tint : part.color));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    renderActors(time.current);
    invalidate();
  }, [batches, actors, invalidate]);
  useEffect(() => {
    if (active) invalidate();
    return () => window.clearTimeout(pendingFrame.current);
  }, [active, invalidate]);
  useFrame((_, delta) => {
    if (!active) return;
    time.current += Math.min(delta, 0.1);
    renderActors(time.current);
    window.clearTimeout(pendingFrame.current);
    // Leave time for browser interaction and reuse the canvas between ticks.
    pendingFrame.current = window.setTimeout(invalidate, delta > 0.075 ? 75 : 25);
  });

  return (
    <group name="Tráfego ilustrativo e pedestres do Alvorada">
      {(Object.keys(batches) as (keyof typeof batches)[]).map((kind) => (
        <instancedMesh key={kind} ref={(mesh) => { if (mesh) meshes.current[kind] = mesh; else delete meshes.current[kind]; }}
          args={[undefined, undefined, batches[kind].length]} frustumCulled={false} receiveShadow={kind !== "shadow"}>
          {kind === "head" ? <sphereGeometry args={[0.5, 8, 5]} />
            : kind === "wheel" ? <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
            : kind === "shadow" ? <circleGeometry args={[0.5, 16]} onUpdate={(geometry) => { if (!geometry.userData.horizontal) {
              geometry.rotateX(-Math.PI / 2);
              geometry.userData.horizontal = true;
            } }} />
            : <boxGeometry />}
          {kind === "shadow" ? <meshBasicMaterial transparent opacity={0.2} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
            : <meshStandardMaterial roughness={0.59} />}
        </instancedMesh>
      ))}
    </group>
  );
}
