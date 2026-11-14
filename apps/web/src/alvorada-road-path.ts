import streets from "./alvorada-map.json";
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

export function pathAlongAlvoradaRoad(roads: Road[], from: Point, to: Point): Point[] | undefined {
  const maxOffset = 5;
  const direct = Math.hypot(to.x - from.x, to.z - from.z);
  let best: { score: number; points: Point[] } | undefined;
  for (const road of roads) {
    if ([from, to].some(({ x, z }) => x < road.left - maxOffset || x > road.right + maxOffset ||
      z < road.top - maxOffset || z > road.bottom + maxOffset)) continue;
    const a = nearest(from, road);
    const b = nearest(to, road);
    if (!a || !b || a.offset > maxOffset || b.offset > maxOffset) continue;

    const middle = road.points.slice(Math.min(a.index, b.index), Math.max(a.index, b.index));
    if (a.index > b.index) middle.reverse();
    if (!middle.length) continue;
    let distance = 0;
    let previous = a.point;
    for (const point of [...middle, b.point]) {
      distance += Math.hypot(point.x - previous.x, point.z - previous.z);
      previous = point;
    }
    if (distance < direct * 0.65 || distance > direct * 1.45) continue;
    const score = a.offset + b.offset + Math.abs(distance - direct) * 0.1;
    if (!best || score < best.score) best = { score, points: [from, ...middle, to] };
  }
  return best?.points;
}
