import { useEffect, useMemo } from "react";
import {
  BufferGeometry, CanvasTexture, ExtrudeGeometry, Float32BufferAttribute,
  MeshStandardMaterial, Path, RepeatWrapping, Shape, SRGBColorSpace, Vector2,
} from "three";
import catalog from "./alvorada-architecture-data.json";
import terminalRoofs from "./alvorada-architecture-roofs.json";
import { localPoint, type Area } from "./observations";
import { Batch, part, seeded, type Part } from "./scenery-kit";

type Point = [number, number];
type Surface =
  | "concrete" | "stucco" | "commercial" | "institutional" | "roof"
  | "metal" | "roofEdge" | "fold" | "skylight" | "glassRoof" | "civicRoof";

type Vertices = { position: number[]; uv: number[] };
type Panel = { x: number; z: number; dx: number; dz: number; normalX: number; normalZ: number };

const palette: Record<Surface, { color: string; map: "cement" | "roof" | "glass"; roughness: number }> = {
  concrete: { color: "#a7a79a", map: "cement", roughness: 0.85 },
  stucco: { color: "#e0d7c4", map: "cement", roughness: 0.91 },
  commercial: { color: "#c6c6bb", map: "cement", roughness: 0.88 },
  institutional: { color: "#bfbaac", map: "cement", roughness: 0.85 },
  roof: { color: "#9d9d8f", map: "roof", roughness: 0.83 },
  metal: { color: "#eceae0", map: "roof", roughness: 0.66 },
  roofEdge: { color: "#556667", map: "cement", roughness: 0.77 },
  fold: { color: "#b69783", map: "roof", roughness: 0.63 },
  skylight: { color: "#455859", map: "glass", roughness: 0.31 },
  glassRoof: { color: "#4b6668", map: "cement", roughness: 0.7 },
  civicRoof: { color: "#595d56", map: "roof", roughness: 0.84 },
};

function texture(style: "cement" | "roof" | "glass") {
  const random = seeded(385963);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const pixels = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const index = (y * 128 + x) * 4;
      const seams = x % 16 < 2 ? 44 : x % 16 === 2 ? -8 : 0;
      const grid = x % 32 < 3 || y % 32 < 3 ? 56 : 0;
      const shade = style === "roof"
        ? 223 - seams - (y < 2 ? 21 : 0) + random() * 13
        : style === "glass"
          ? 175 + 35 * Math.sin((x + y) * Math.PI / 64) - grid + random() * 10
          : 218 + random() * 25 + 7 * Math.sin(x * 0.36) * Math.sin(y * 0.31);
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = shade;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function appendVolume(
  buffers: Map<Surface, Vertices>,
  points: Point[],
  height: number,
  bottom: number,
  top: Surface,
  wall: Surface,
  pitch?: (x: number, z: number) => number,
  openings: Point[][] = [],
  ridge?: number,
) {
  const shape = new Shape(points.map(([x, z]) => new Vector2(x, -z)));
  shape.holes = openings.map((opening) => new Path(opening.map(([x, z]) => new Vector2(x, -z))));
  const slab = new ExtrudeGeometry(shape, { depth: height - bottom, bevelEnabled: false });
  const position = slab.getAttribute("position");
  const uv = slab.getAttribute("uv");
  for (const { start, count, materialIndex } of slab.groups) {
    const surface = materialIndex === 0 ? top : wall;
    const vertices = buffers.get(surface) ?? { position: [], uv: [] };
    buffers.set(surface, vertices);
    for (let vertex = start; vertex < start + count; vertex++) {
      const x = position.getX(vertex);
      const z = -position.getY(vertex);
      const y = position.getZ(vertex) + bottom + (pitch?.(x, z) ?? 0);
      if (materialIndex === 1 && ridge !== undefined && vertex % 3 === 0) {
        // Ignore the internal vertical face where two facets share an edge.
        const next = position.getX(vertex + 1);
        const last = position.getX(vertex + 2);
        if ([x, next, last].every((coordinate) => Math.abs(coordinate - ridge) < 0.005)) {
          vertex += 2;
          continue;
        }
      }
      vertices.position.push(x, y, z);
      vertices.uv.push(uv.getX(vertex) / (top === "skylight" ? 10 : 7), uv.getY(vertex) / 7);
    }
  }
  slab.dispose();
}

function signedArea(points: Point[]) {
  return points.reduce((sum, [x, z], index) => {
    const [nx, nz] = points[(index + 1) % points.length];
    return sum + x * nz - z * nx;
  }, 0);
}

function edges(points: Point[]) {
  const normal = signedArea(points) > 0 ? 1 : -1;
  return points.flatMap(([x, z], index) => {
    const next = points[(index + 1) % points.length];
    const len = Math.hypot(next[0] - x, next[1] - z);
    if (len < 0.2) return [];
    const dx = (next[0] - x) / len;
    const dz = (next[1] - z) / len;
    return [{ x, z, dx, dz, normalX: dz * normal, normalZ: -dx * normal, len }];
  });
}

function facadePart(panel: Panel, along: number, y: number, width: number, height: number, depth: number, offset: number, color: string) {
  const { x, z, dx, dz, normalX, normalZ } = panel;
  return part(
    [x + dx * along + normalX * offset, y, z + dz * along + normalZ * offset],
    [width, height, depth], color, [0, Math.atan2(-dz, dx), 0],
  );
}

function split(points: Point[], ridge: number, side: -1 | 1) {
  const clipped: Point[] = [];
  points.forEach((p, index) => {
    const next = points[(index + 1) % points.length];
    const inside = (p[0] - ridge) * side >= 0;
    const nextInside = (next[0] - ridge) * side >= 0;
    if (inside) clipped.push(p);
    if (inside !== nextInside) {
      const t = (ridge - p[0]) / (next[0] - p[0]);
      const crossing: Point = [ridge, p[1] + t * (next[1] - p[1])];
      if (Math.hypot(crossing[0] - p[0], crossing[1] - p[1]) > 0.005 &&
        Math.hypot(crossing[0] - next[0], crossing[1] - next[1]) > 0.005) clipped.push(crossing);
    }
  });
  return clipped;
}

function inside(point: Point, ring: Point[]) {
  const [x, z] = point;
  let within = false;
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) within = !within;
  });
  return within;
}

function roofPanels(origin: Area["origin"], ring: Point[], skylight: Point[], height: number, solids: Part[]) {
  // The municipal 2025 orthophoto shows the dark array on this roof.
  // Array hardware is rendered as a representative panel profile.
  const [x, z] = localPoint(origin, [-43.366963, -22.998770]);
  const [east, nextZ] = localPoint(origin, [-43.365050, -22.998760]);
  const angle = Math.atan2(z - nextZ, east - x);
  const slope = 0.03;
  const roofPoint = (along: number, across: number): Point => [
    x + along * Math.cos(angle) + across * Math.sin(angle),
    z - along * Math.sin(angle) + across * Math.cos(angle),
  ];
  for (let row = 0; row < 11; row++) {
    for (let column = 0; column < 18; column++) {
      const along = 7 + column * 10;
      const across = 3 + row * 6.9;
      if ((row + column * 13) % 23 === 0) continue;
      const margin = [-5.8, 5.8].flatMap((dx) => [-2.9, 2.9].map((dz) => roofPoint(along + dx, across + dz)));
      if (!margin.every((point) => inside(point, ring)) ||
          [roofPoint(along, across), ...margin].some((point) => inside(point, skylight))) continue;
      const [panelX, panelZ] = roofPoint(along, across);
      solids.push(part([panelX, height + 0.08, panelZ], [9.45, 0.13, 2.47], "#4e5656", [slope, angle, 0]));
    }
  }
}

function canopySupports(points: Point[], bottom: number, separation: number, solids: Part[], sturdy = false) {
  const outline = edges(points);
  const main = outline.reduce((a, b) => a.len >= b.len ? a : b);
  const along = points.map(([x, z]) => x * main.dx + z * main.dz);
  const [start, end] = [Math.min(...along), Math.max(...along)];
  const bays = Math.max(1, Math.ceil((end - start) / separation));
  const column = sturdy ? 0.52 : 0.3;
  for (let index = 0; index < bays; index++) {
    const t = start + (index + 0.5) * (end - start) / bays;
    const intersections = outline.flatMap((edge) => {
      const span = edge.len * (edge.dx * main.dx + edge.dz * main.dz);
      if (Math.abs(span) < 0.001) return [];
      const progress = (t - edge.x * main.dx - edge.z * main.dz) / span;
      if (progress < 0 || progress >= 1) return [];
      const x = edge.x + progress * edge.dx * edge.len;
      const z = edge.z + progress * edge.dz * edge.len;
      return [x * main.normalX + z * main.normalZ];
    }).sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const width = intersections[i + 1] - intersections[i];
      if (width < 1.1) continue;
      const rows = width > 5 ? [0.22, 0.78] : [0.5];
      for (const row of rows) {
        const cross = intersections[i] + width * row;
        const x = t * main.dx + cross * main.normalX;
        const z = t * main.dz + cross * main.normalZ;
        solids.push(
          part([x, bottom / 2, z], [column, bottom, column], "#465354"),
          part([x, 0.22, z], [column + 0.19, 0.43, column + 0.19], "#aaa594"),
        );
      }
      if (sturdy && width > 5) {
        const center = (intersections[i] + intersections[i + 1]) / 2;
        const x = t * main.dx + center * main.normalX;
        const z = t * main.dz + center * main.normalZ;
        solids.push(part([x, bottom - 0.14, z], [width * 0.71, 0.31, 0.24], "#64706a", [0, Math.atan2(-main.normalZ, main.normalX), 0]));
      }
    }
  }
}

function facade(
  points: Point[],
  building: typeof catalog[number],
  height: number,
  random: () => number,
  solids: Part[],
  windows: Part[],
) {
  const residential = building.kind === "residential";
  const office = building.kind === "office" || building.kind === "operations";
  const trim = residential ? "#d8cbb2" : "#808b85";
  const floors = building.levels ?? Math.max(1, Math.round(height / 3.3));
  const floorHeight = height / floors;
  const glassColors = office ? ["#547680", "#638892", "#41616c"] : ["#405957", "#536b66", "#60746e"];
  const outline = edges(points);
  const longest = Math.max(...outline.map(({ len }) => len));
  for (const edge of outline) {
    if (edge.len < 1.8) continue;
    const middle = edge.len / 2;
    solids.push(
      facadePart(edge, middle, 0.25, edge.len, 0.44, 0.22, 0.04, "#777970"),
      facadePart(edge, middle, height + 0.02, edge.len, 0.32, 0.38, 0.06, "#c4c2b4"),
    );
    if (edge.len < 2.6) continue;
    const width = office ? 2.65 : residential ? 3.15 : edge.len > 45 ? 6.1 : 3.4;
    const bays = Math.min(18, Math.max(1, Math.floor(edge.len / width)));
    const step = edge.len / bays;
    const affected = residential || office || edge.len < 22 || edge.len === longest;
    for (let level = 0; level < floors; level++) {
      if (level > 0 && (residential || office) && edge.len > 6) {
        solids.push(facadePart(edge, middle, level * floorHeight, edge.len, 0.18, 0.27, 0.02, trim));
      }
      if (!affected && level > 0) continue;
      for (let bay = 0; bay < bays; bay++) {
        const choice = random();
        if (!office && !residential && (level > 0 ? choice < 0.4 : choice < 0.21)) continue;
        const y = floorHeight * (level + (level > 0 ? 0.54 : 0.45));
        const paneWidth = Math.min(step * (office ? 0.89 : 0.69), office ? 3.35 : 2.6);
        const paneHeight = Math.min(floorHeight * (office ? 0.68 : 0.48), 2.45);
        const at = step * (bay + 0.5);
        windows.push(facadePart(edge, at, y, paneWidth, paneHeight, 0.08, 0.05, glassColors[Math.floor(random() * glassColors.length)]));
        if (residential && level > 0 && bay % 2 === 0 && paneWidth > 1.6) {
          solids.push(facadePart(edge, at, y - paneHeight * 0.62, paneWidth + 0.24, 0.15, 0.67, 0.22, trim));
        }
        if (office || (level === 0 && edge.len > 9)) {
          solids.push(facadePart(edge, at, y, 0.074, paneHeight, 0.075, 0.105, "#9ba49d"));
        }
      }
    }
  }
}

function architecture(origin: Area["origin"]) {
  const buffers = new Map<Surface, Vertices>();
  const solids: Part[] = [];
  const windows: Part[] = [];
  const [ridge, foldNorth] = localPoint(origin, [-43.365716, -23.001005]);

  for (const { height, rings } of terminalRoofs) {
    const [outline, ...openings] = rings.map((ring) => ring.map((coordinates) => localPoint(origin, coordinates as Point)));
    appendVolume(buffers, outline, height, height - 0.43, "metal", "roofEdge", undefined, openings);
    canopySupports(outline, height - 0.44, 17, solids, true);
  }

  catalog.forEach((building) => {
    const path = building.points.map((coordinates) => localPoint(origin, coordinates as Point));
    const { kind, height } = building;

    if (kind === "fold" || kind === "skylight") {
      // Plan geometry remains from OSM. The pitched frame is the documented
      // metal origami form, interpreted here without a surveyed roof height.
      const pitch = (x: number, z: number) => Math.max(0.7, 4.5 - Math.max(0, z - foldNorth) * 0.06) - Math.abs(x - ridge) * 0.16;
      for (const side of [-1, 1] as const) {
        const face = split(path, ridge, side);
        if (face.length > 2) {
          appendVolume(buffers, face, height, height - 0.48, kind, kind === "fold" ? "roofEdge" : "glassRoof", pitch, [], ridge);
        }
      }
      if (kind === "fold") canopySupports(path, height + 0.4, 22, solids, true);
      return;
    }
    if (kind === "platform" || kind === "canopy") {
      appendVolume(buffers, path, height, height - 0.42, "metal", "roofEdge");
      canopySupports(path, height - 0.43, kind === "platform" ? 11 : 8, solids);
      return;
    }
    if (kind === "arts") {
      // OSM records a raised complex. Its upper enclosure remains interpreted
      // within the mapped outline, with open ground level under the concrete.
      const bottom = building.minHeight ?? 10;
      const horizontal = edges(path);
      appendVolume(buffers, path, bottom + 2.2, bottom, "roof", "concrete");
      const roof = height - 2.4;
      appendVolume(buffers, path, roof, roof - 1.45, "civicRoof", "concrete");
      const raisedRoof = [
        [-43.365318, -22.998839], [-43.365116, -22.998837],
        [-43.365122, -22.999170], [-43.365324, -22.999180],
      ].map((coordinates) => localPoint(origin, coordinates as Point));
      appendVolume(buffers, raisedRoof, height, roof - 0.01, "metal", "institutional");
      roofPanels(origin, path, raisedRoof, roof, solids);
      for (const edge of horizontal) {
        if (edge.len < 6) continue;
        const columns = Math.max(1, Math.floor(edge.len / 18));
        for (let i = 0; i < columns; i++) {
          const t = (i + 0.5) * edge.len / columns;
          solids.push(
            facadePart(edge, t, bottom / 2, 1.42, bottom, 2.3, -2.3, "#afa991"),
            facadePart(edge, t, (roof + bottom) / 2, 1.2, roof - bottom - 1.7, 1.7, -1.55, "#b5afa0"),
          );
        }
      }
      return;
    }

    const base: Surface = kind === "residential" ? "stucco"
      : kind === "commercial" ? "commercial"
        : kind === "office" || kind === "operations" || kind === "ticket" ? "institutional" : "concrete";
    appendVolume(buffers, path, height, 0.02, "roof", base);
    facade(path, building, height, seeded(building.osm), solids, windows);
  });

  const meshes = Array.from(buffers, ([surface, { position, uv }]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return { surface, geometry };
  });
  return { meshes, solids, windows };
}

export function AlvoradaArchitecture({ area }: { area: Area }) {
  const [longitude, latitude] = area.origin;
  const model = useMemo(() => architecture([longitude, latitude]), [longitude, latitude]);
  const textures = useMemo(() => ({
    cement: texture("cement"),
    roof: texture("roof"),
    glass: texture("glass"),
  }), []);
  const materials = useMemo(() => new Map(
    Object.entries(palette).map(([key, { color, map, roughness }]) => [key, new MeshStandardMaterial({
      color, map: textures[map],
      ...(map === "glass" ? { metalness: 0.24 } : { bumpMap: textures[map], bumpScale: map === "roof" ? 0.055 : 0.024 }),
      roughness,
    })]),
  ), [textures]);

  useEffect(() => () => model.meshes.forEach(({ geometry }) => geometry.dispose()), [model]);
  useEffect(() => () => {
    materials.forEach((material) => material.dispose());
    Object.values(textures).forEach((map) => map?.dispose());
  }, [materials, textures]);

  return (
    <group name="Terminal Alvorada · edifícios e coberturas">
      {model.meshes.map(({ surface, geometry }) => (
        <mesh key={surface} geometry={geometry} material={materials.get(surface)} castShadow receiveShadow />
      ))}
      <Batch parts={model.solids} cast />
      <Batch parts={model.windows} roughness={0.36} />
    </group>
  );
}
