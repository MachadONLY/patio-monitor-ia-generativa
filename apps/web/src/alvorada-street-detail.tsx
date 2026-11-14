import { AlvoradaAmbience } from "./alvorada-ambience";
import { useMemo } from "react";
import buildings from "./alvorada-architecture-data.json";
import streets from "./alvorada-map.json";
import streetFeatures from "./alvorada-street-detail-data.json";
import { localPoint, type Area } from "./observations";
import { Batch, Sign, part, seeded, type Part, type XYZ } from "./scenery-kit";

type Point = [number, number];

const platforms: { label: string; start: Point; end: Point }[] = [
  { label: "A", start: [-43.3678905, -23.0010918], end: [-43.3644751, -23.0010388] },
  { label: "B", start: [-43.367726, -23.001359], end: [-43.36449, -23.001298] },
  { label: "C", start: [-43.367543, -23.001501], end: [-43.364617, -23.001444] },
  { label: "D", start: [-43.367283, -23.001601], end: [-43.36485, -23.001554] },
  { label: "E", start: [-43.367122, -23.00188], end: [-43.365168, -23.001844] },
];

const connectors: [Point, Point][] = [
  [[-43.366449, -23.001608], [-43.366439, -23.001906]],
  [[-43.365601, -23.001596], [-43.365586, -23.001888]],
];

const treeBands: [Point, Point][] = [
  [[-43.36829, -23.00222], [-43.36455, -23.00252]],
  [[-43.3689, -23.00015], [-43.364, -23.00029]],
  [[-43.36921, -23.00193], [-43.36852, -23.00284]],
  [[-43.36414, -23.00225], [-43.36369, -23.00047]],
];

const platformWalks = platforms.map(({ start, end }) =>
  [0.11, 0.89].map((f): Point => [start[0] + (end[0] - start[0]) * f, start[1] + (end[1] - start[1]) * f]),
);

function distanceToSegment([x, z]: Point, [ax, az]: Point, [bx, bz]: Point) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz;
  const offset = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
  return Math.hypot(x - (ax + offset * dx), z - (az + offset * dz));
}

function buildDetail(origin: Point) {
  const hardscape: Part[] = [];
  const furnishings: Part[] = [];
  const foliage: Part[] = [];
  const trunks: Part[] = [];
  const signs: { text: string; at: XYZ; rotation: number }[] = [];
  const random = seeded(81426);
  const project = (point: Point) => localPoint(origin, point);

  platforms.forEach(({ label, start, end }) => {
    const [x, z] = project(start);
    const [endX, endZ] = project(end);
    const length = Math.hypot(endX - x, endZ - z);
    const bearing = Math.atan2(z - endZ, endX - x);
    const rotation: XYZ = [0, bearing, 0];
    const at = (forward: number, height: number, offset = 0): XYZ => [
      x + forward * Math.cos(bearing) + offset * Math.sin(bearing),
      height,
      z - forward * Math.sin(bearing) + offset * Math.cos(bearing),
    ];

    const apron = label === "D" ? 8.8 : 6.3;
    hardscape.push(part(at(length / 2, 0.4), [length, 0.65, apron], "#aaa998", rotation));
    hardscape.push(part(at(length / 2, 0.76), [length - 2, 0.1, apron - 0.7], "#e6d9bf", rotation));
    for (const edge of [-1, 1]) {
      hardscape.push(part(at(length / 2, 0.83, edge * (apron / 2 - 0.64)), [length - 3, 0.08, 0.42], "#d8ad46", rotation));
    }
    for (let distance = length * 0.2; distance < length * 0.82; distance += 15) {
      if (Math.round(distance / 15) % 2 === 0) {
        furnishings.push(part(at(distance + 1.4, 1.26, 1.25), [2.3, 0.16, 0.6], "#ad6846", rotation));
        furnishings.push(part(at(distance + 1.4, 1.02, 1.26), [1.6, 0.28, 0.26], "#57645e", rotation));
        furnishings.push(part(at(distance + 4.6, 1.23, -0.95), [0.58, 0.93, 0.58], "#335d57", rotation));
      }
    }

    for (const atFraction of [0.29, 0.72]) {
      const position = length * atFraction;
      furnishings.push(part(at(position, 1.95, 0.45), [0.21, 2.5, 0.24], "#395855", rotation));
      furnishings.push(part(at(position, 3.36, 0.45), [4.6, 0.93, 0.2], "#245c65", rotation));
      signs.push({ text: `PLATAFORMA ${label}`, at: at(position, 3.36, 0.57), rotation: bearing });
      signs.push({ text: `PLATAFORMA ${label}`, at: at(position, 3.36, 0.33), rotation: bearing + Math.PI });
    }


  });

  connectors.forEach(([a, b]) => {
    const [x, z] = project(a);
    const [bx, bz] = project(b);
    const distance = Math.hypot(bx - x, bz - z);
    const rotation: XYZ = [0, Math.atan2(z - bz, bx - x), 0];
    for (let offset = 1.25; offset < distance - 1; offset += 1.8) {
      const ratio = offset / distance;
      hardscape.push(part([x + (bx - x) * ratio, 0.52, z + (bz - z) * ratio], [0.68, 0.08, 3.3], "#f1e8d7", rotation));
    }
  });

  const nearby = (point: Point) => Math.abs(point[0] + 43.366) < 0.005 && Math.abs(point[1] + 23.001) < 0.003;
  const roadPaths = (streets as [number, Point[]][]).filter(([, points]) => points.some(nearby))
    .map(([kind, points]) => ({ kind, points: points.map(project) }));
  const footprints = buildings.filter(({ points }) => points.some((point) => nearby(point as Point)))
    .map(({ points }) => points.map((point) => project(point as Point)));
  const used: Point[] = [];

  function plantTree([x, z]: Point) {
    const height = 3.2 + random() * 3.1;
    trunks.push(part([x, height / 2, z], [0.49, height, 0.49], "#715944"));
    for (let tuft = 0; tuft < 4; tuft++) {
      const size = 2.8 + random() * 3.3;
      const colors = ["#6d8b58", "#759d68", "#52794f", "#a6ab69"];
      foliage.push(part(
        [x + (random() - 0.5) * 3, height + 0.2 + random() * 1.7, z + (random() - 0.5) * 3],
        [size, size * 0.93, size], colors[tuft],
      ));
    }
  }

  for (const point of streetFeatures.trees as Point[]) {
    const projected = project(point);
    used.push(projected);
    plantTree(projected);
  }
  for (const point of streetFeatures.stops as Point[]) {
    const [x, z] = project(point);
    furnishings.push(part([x, 1.49, z], [0.17, 2.7, 0.19], "#5a6760"));
    furnishings.push(part([x, 2.8, z], [0.7, 0.77, 0.14], "#297179"));
    furnishings.push(part([x, 2.84, z + 0.077], [0.42, 0.29, 0.025], "#e7efe3"));
  }

  treeBands.forEach(([a, b]) => {
    const [x, z] = project(a);
    const [endX, endZ] = project(b);
    for (let i = 0; i < 42; i++) {
      const ratio = (i + random()) / 42;
      const point: Point = [x + (endX - x) * ratio + (random() - 0.5) * 28, z + (endZ - z) * ratio + (random() - 0.5) * 28];
      if (used.some((existing) => Math.hypot(existing[0] - point[0], existing[1] - point[1]) < 9)) continue;
      if (roadPaths.some(({ kind, points }) => points.some((end, j) => j > 0 && distanceToSegment(point, points[j - 1], end) < (kind === 1 ? 16 : 9)))) continue;
      if (footprints.some((points) => {
        const xs = points.map(([x]) => x);
        const zs = points.map(([, z]) => z);
        return point[0] > Math.min(...xs) - 4 && point[0] < Math.max(...xs) + 4 &&
          point[1] > Math.min(...zs) - 4 && point[1] < Math.max(...zs) + 4;
      })) continue;
      used.push(point);
      const [px, pz] = point;
      if (used.length % 4 === 1) {
        furnishings.push(part([px, 3.4, pz], [0.3, 6.8, 0.3], "#566965"));
        furnishings.push(part([px + 0.86, 6.8, pz], [2.0, 0.28, 0.42], "#677c72"));
        furnishings.push(part([px + 1.52, 6.63, pz], [0.73, 0.11, 0.44], "#e8e5cf"));
      } else {
        plantTree(point);
        hardscape.push(part([px, 0.32, pz], [4.7, 0.34, 4.7], "#7f8a6b"));
      }
    }
  });

  return { hardscape, furnishings, foliage, trunks, signs };
}

export function AlvoradaStreetDetail({ area, active }: { area: Area; active: boolean }) {
  const [longitude, latitude] = area.origin;
  const detail = useMemo(() => buildDetail([longitude, latitude]), [longitude, latitude]);

  return (
    <group>
      <Batch parts={detail.hardscape} />
      <Batch parts={detail.furnishings} cast />
      <Batch parts={detail.trunks} shape="trunk" cast />
      <Batch parts={detail.foliage} shape="leaf" cast />
      <AlvoradaAmbience origin={area.origin} platforms={platformWalks} active={active} />
      {detail.signs.map(({ text, at, rotation }, index) => (
        <Sign key={index} text={text} at={at} width={4.3} height={0.82} rotationY={rotation} />
      ))}
    </group>
  );
}
