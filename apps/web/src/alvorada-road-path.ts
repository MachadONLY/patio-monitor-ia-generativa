import streets from "./alvorada-map.json" with { type: "json" };
import { localPoint } from "./observations";

type Point = { x: number; z: number };
type Road = { points: Point[]; left: number; right: number; top: number; bottom: number };

export function projectAlvoradaRoads(origin: [number, number]): Road[] {
  return (streets as [number, [number, number][]][]).map(([, coordinates]) => {
    const points = coordinates.map((coordinate) => {
      const [x, z] = localPoint(origin, coordinate);
      return { x, z };
    });
    return {
      points,
      left: Math.min(...points.map(({ x }) => x)),
      right: Math.max(...points.map(({ x }) => x)),
      top: Math.min(...points.map(({ z }) => z)),
      bottom: Math.max(...points.map(({ z }) => z)),
    };
  });
}

function nearest(point: Point, road: Road) {
  let match: { index: number; point: Point; offset: number } | undefined;
  for (let index = 1; index < road.points.length; index++) {
    const from = road.points[index - 1];
    const to = road.points[index];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSquared = dx ** 2 + dz ** 2;
    if (lengthSquared === 0) continue;
    const fraction = Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared));
    const x = from.x + fraction * dx;
    const z = from.z + fraction * dz;
    const offset = Math.hypot(x - point.x, z - point.z);
    if (!match || offset < match.offset) match = { index, point: { x, z }, offset };
  }
  return match;
}

export type VehicleRoadPose = Point & { heading: number };
type Match = VehicleRoadPose & { road: Road; segment: number; gap: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const headingFor = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);

export function buildVehicleRoadNetwork(roads: Road[], covers: (pose: VehicleRoadPose) => boolean) {
  function candidates(point: Point, oldHeading?: number): Match[] {
    const radius = 9;
    const matches: Match[] = [];
    for (const road of roads) {
      if (point.x < road.left - radius || point.x > road.right + radius ||
          point.z < road.top - radius || point.z > road.bottom + radius) continue;
      const hit = nearest(point, road);
      if (!hit || hit.offset > radius) continue;
      const heading = headingFor(road.points[hit.index - 1], road.points[hit.index]);
      const alignedHeading = oldHeading !== undefined && Math.cos(oldHeading - heading) < 0 ? heading + Math.PI : heading;
      matches.push({ ...hit.point, road, segment: hit.index, gap: hit.offset, heading: alignedHeading });
    }
    return matches.sort((a, b) => a.gap - b.gap);
  }

  function match(point: Point, heading?: number) {
    return candidates(point, heading).find(covers);
  }

  function path(from: VehicleRoadPose, to: VehicleRoadPose) {
    const a = from as Match, b = to as Match;
    const direct = distance(a, b);
    if (direct < 2 || direct > 220) return undefined;
    const pieces: Point[][] = [];
    if (a.road === b.road) {
      const middle = a.road.points.slice(Math.min(a.segment, b.segment), Math.max(a.segment, b.segment));
      if (a.segment > b.segment) middle.reverse();
      pieces.push([a, ...middle, b]);
    } else {
      const fromEnds = [a.road.points.slice(0, a.segment).reverse(), a.road.points.slice(a.segment)];
      const toEnds = [b.road.points.slice(0, b.segment), b.road.points.slice(b.segment).reverse()];
      for (const first of fromEnds) for (const second of toEnds) {
        if (distance(first.at(-1)!, second[0]) < 0.1) pieces.push([a, ...first, ...second, b]);
      }
    }

    for (const piece of pieces) {
      const points = piece.filter((point, i) => !i || distance(point, piece[i - 1]) > 0.035);
      if (points.length < 2) continue;
      const length = points.slice(1).reduce((total, point, i) => total + distance(point, points[i]), 0);
      if (length > direct * 1.6 + 5) continue;
      const poses = points.map((point, i) => ({
        x: point.x, z: point.z,
        heading: headingFor(points[Math.max(0, i - 1)], points[Math.min(points.length - 1, i + 1)]),
      }));
      // Test the pose along every segment, in addition to the per-frame guard.
      if (Math.abs(Math.cos(poses[0].heading - from.heading)) < 0.72 ||
          Math.abs(Math.cos(poses.at(-1)!.heading - to.heading)) < 0.72) continue;
      if (poses.every((pose, i) => {
        if (!covers(pose)) return false;
        if (!i) return true;
        const before = poses[i - 1];
        const steps = Math.ceil(distance(before, pose) / 0.85);
        const heading = headingFor(before, pose);
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          if (!covers({ x: before.x + (pose.x - before.x) * t, z: before.z + (pose.z - before.z) * t, heading })) return false;
        }
        return true;
      })) return poses;
    }
    return undefined;
  }
  return { match, path, covers };
}
