import { Html } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, PlaneGeometry, ShapeUtils, SRGBColorSpace, TextureLoader, Vector2, type Texture } from "three";
import map from "./alvorada-cartography-data.json";
import { makeSurfaceMaterial, type Surface } from "./alvorada-cartography-materials";
import aerialContext from "./alvorada-ipp-2019-context.webp";
import aerialDetail from "./alvorada-ipp-2019-detail.webp";
import { localPoint } from "./observations";

type Coordinate = [number, number];
type Layer = keyof typeof map.layers;

// Geometry is projected once during extraction (SIRGAS-compatible UTM 23S meters).
// The offset keeps it aligned with any configured local scene origin.
const mapOrigin = map.origin as Coordinate;
const orthoOrigin: Coordinate = [-43.366102, -23.001922];
type Appearance = {
  kind: Layer;
  color: string;
  elevation: number;
  surface?: Surface;
  period?: number;
  roughness: number;
  bumpScale?: number;
  edge?: number;
};

const appearance: Appearance[] = [
  { kind: "water", color: "#5e9fac", elevation: 0.016, surface: "water", period: 32, roughness: 0.3, bumpScale: 0.32 },
  { kind: "yard", color: "#babaac", elevation: 0.034, surface: "paving", period: 10, roughness: 0.94, bumpScale: 0.045 },
  { kind: "grass", color: "#889e68", elevation: 0.05, surface: "meadow", period: 26, roughness: 0.99, bumpScale: 0.13 },
  { kind: "verge", color: "#adad9d", elevation: 0.105, surface: "soil", period: 12, roughness: 1, bumpScale: 0.05 },
  { kind: "sidewalk", color: "#d1c3aa", elevation: 0.15, surface: "paving", period: 8, roughness: 0.94, bumpScale: 0.045, edge: 0.085 },
  { kind: "road", color: "#687076", elevation: 0.19, surface: "asphalt", period: 12, roughness: 0.94, bumpScale: 0.055 },
  { kind: "major", color: "#586168", elevation: 0.22, surface: "asphalt", period: 17, roughness: 0.86, bumpScale: 0.05 },
  { kind: "bus", color: "#626c68", elevation: 0.25, surface: "asphalt", period: 9, roughness: 0.91, bumpScale: 0.055 },
  { kind: "walk", color: "#cfc5b3", elevation: 0.27, surface: "paving", period: 8, roughness: 0.97, bumpScale: 0.045, edge: 0.08 },
  { kind: "platform", color: "#d8cbb4", elevation: 0.34, surface: "platform", period: 8, roughness: 0.92, bumpScale: 0.045, edge: 0.24 },
  { kind: "mark", color: "#efe3c1", elevation: 0.365, roughness: 0.9 },
];

const surfaceTypes: Surface[] = ["soil", "meadow", "asphalt", "paving", "platform", "water"];

type ParkingStrip = {
  outline: [Coordinate, Coordinate, Coordinate, Coordinate];
  spacing: number;
};

// Measured on the 900×680 terminal crop (584,684 in the full IPP 2019 detail image).
// The top-left corner is the start of the first angled separator.
// Signs of the same parking layout are visible in the 2025 IPP mosaic.
const parkingStrips: ParkingStrip[] = [
  { outline: [[114, 117], [251, 117], [281, 147], [144, 147]], spacing: 11.2 },
  { outline: [[373, 117], [478, 117], [452, 148], [345, 148]], spacing: 12.8 },
  { outline: [[557, 118], [628, 118], [658, 148], [585, 148]], spacing: 12.2 },
  { outline: [[291, 290], [648, 289], [609, 325], [249, 326]], spacing: 10.8 },
  { outline: [[342, 343], [598, 342], [564, 380], [301, 381]], spacing: 10.8 },
  { outline: [[361, 396], [553, 395], [535, 418], [340, 419]], spacing: 10.2 },
  { outline: [[384, 434], [530, 433], [499, 460], [348, 461]], spacing: 10.4 },
];

function parkingGeometry() {
  const unitsPerPixel = 1200 / 2048;
  const layout: number[][][] = [];
  const markings: number[][][] = [];
  const project = (x: number, z: number) => [
    (x + 584 - 1024) * unitsPerPixel,
    (z + 684 - 1024) * unitsPerPixel,
  ];

  for (const { outline: [topStart, topEnd, bottomEnd, bottomStart], spacing } of parkingStrips) {
    const pavement = [topStart, topEnd, bottomEnd, bottomStart].flatMap(([x, z]) => project(x, z));
    layout.push([pavement]);
    const count = Math.floor((topEnd[0] - topStart[0]) / spacing);
    const halfWidth = 0.17;
    for (let slot = 1; slot < count; slot++) {
      const ratio = slot / count;
      const x = topStart[0] + (topEnd[0] - topStart[0]) * ratio;
      const z = topStart[1] + (topEnd[1] - topStart[1]) * ratio;
      const endX = bottomStart[0] + (bottomEnd[0] - bottomStart[0]) * ratio;
      const endZ = bottomStart[1] + (bottomEnd[1] - bottomStart[1]) * ratio;
      markings.push([[
        ...project(x - halfWidth, z), ...project(x + halfWidth, z),
        ...project(endX + halfWidth, endZ), ...project(endX - halfWidth, endZ),
      ]]);
    }
  }
  return { asphalt: createGeometry(layout, 6), paint: createGeometry(markings, 1) };
}

function AerialImage({ src, size, level }: { src: string; size: number; level: number }) {
  const [map, setMap] = useState<Texture>();

  useEffect(() => {
    let active = true;
    const texture = new TextureLoader().load(src, (loaded) => {
      if (!active) return;
      loaded.colorSpace = SRGBColorSpace;
      loaded.anisotropy = 4;
      setMap(loaded);
    }, undefined, () => { /* The projected OpenStreetMap layers remain visible. */ });
    return () => {
      active = false;
      texture.dispose();
    };
  }, [src]);

  if (!map) return null;
  return (
    <mesh position={[0, 0.010 + level * 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow renderOrder={level}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={map} color="#e1ded1" roughness={0.96} transparent depthWrite={false} />
    </mesh>
  );
}

function ring(points: number[]) {
  const vertices: Vector2[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const z = points[i + 1];
    const last = vertices.at(-1);
    if (!last || last.x !== x || last.y !== z) vertices.push(new Vector2(x, z));
  }
  return vertices;
}

function createGeometry(polygons: number[][][], period: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const uv: number[] = [];
  for (const [outer, ...inner] of polygons) {
    const perimeter = ring(outer);
    if (perimeter.length < 3) continue;
    const holes = inner.map(ring).filter((hole) => hole.length >= 3);
    const triangles = ShapeUtils.triangulateShape(perimeter, holes);
    const start = positions.length / 3;
    for (const vertex of [perimeter, ...holes].flat()) {
      positions.push(vertex.x, 0, vertex.y);
      normals.push(0, 1, 0);
      uv.push(vertex.x / period, vertex.y / period);
    }
    for (const [a, b, c] of triangles) indices.push(start + c, start + b, start + a);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}

function createEdges(polygons: number[][][], depth: number) {
  const positions: number[] = [];
  for (const [outer] of polygons) {
    const perimeter = ring(outer);
    for (let index = 0; index < perimeter.length; index++) {
      const start = perimeter[index];
      const end = perimeter[(index + 1) % perimeter.length];
      if (start.distanceToSquared(end) < 0.0001) continue;
      positions.push(
        start.x, 0, start.y, end.x, -depth, end.y, end.x, 0, end.y,
        start.x, 0, start.y, start.x, -depth, start.y, end.x, -depth, end.y,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function AlvoradaCartography({ origin }: { origin: Coordinate }) {
  const layers = useMemo(() => appearance.map((layer) => ({
    ...layer,
    geometry: createGeometry(map.layers[layer.kind], layer.period ?? 1),
    skirt: layer.edge ? createEdges(map.layers[layer.kind], layer.edge) : undefined,
  })), []);
  const ground = useMemo(() => {
    const plane = new PlaneGeometry(7200, 7200);
    const uv = plane.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, uv.getX(index) * 400, uv.getY(index) * 400);
    }
    return plane;
  }, []);
  useEffect(() => () => ground.dispose(), [ground]);
  const parking = useMemo(parkingGeometry, []);
  useEffect(() => () => {
    parking.asphalt.dispose();
    parking.paint.dispose();
  }, [parking]);
  const materials = useMemo(() => Object.fromEntries(surfaceTypes.map((surface) => [
    surface, makeSurfaceMaterial(surface),
  ])), []);
  useEffect(() => () => layers.forEach(({ geometry, skirt }) => {
    geometry.dispose();
    skirt?.dispose();
  }), [layers]);
  useEffect(() => () => Object.values(materials).forEach(({ map: color, bumpMap }) => {
    color.dispose();
    bumpMap.dispose();
  }), [materials]);
  const [offsetX, offsetZ] = localPoint(origin, mapOrigin);
  const [aerialX, aerialZ] = localPoint(mapOrigin, orthoOrigin);

  return (
    <group position={[offsetX, 0, offsetZ]}>
      <mesh geometry={ground} position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#a8aa95" roughness={1} map={materials.soil.map} />
      </mesh>
      <group position={[aerialX, 0, aerialZ]}>
        {/* Instituto Pereira Passos / PCRJ, Mosaico 2019, CC BY 4.0.
            Concentric 2048px exports in EPSG:31983, with feathered edge masks. */}
        <AerialImage src={aerialContext} size={3200} level={1} />
        <AerialImage src={aerialDetail} size={1200} level={2} />
        <mesh geometry={parking.asphalt} position={[0, 0.31, 0]} receiveShadow>
          <meshStandardMaterial color="#717269" map={materials.asphalt.map} bumpMap={materials.asphalt.bumpMap}
            bumpScale={0.05} roughness={0.96} />
        </mesh>
        <mesh geometry={parking.paint} position={[0, 0.32, 0]} receiveShadow>
          <meshStandardMaterial color="#bfb5a1" roughness={0.94} />
        </mesh>
      </group>
      {layers.map(({ kind, color, elevation, surface, roughness, bumpScale, geometry, skirt }) => (
        <group key={kind} position={[0, elevation, 0]}>
          <mesh geometry={geometry} receiveShadow>
            <meshStandardMaterial
              color={color}
              roughness={roughness}
              metalness={kind === "water" ? 0.1 : 0}
              side={DoubleSide}
              map={surface ? materials[surface].map : undefined}
              bumpMap={surface ? materials[surface].bumpMap : undefined}
              bumpScale={bumpScale}
            />
          </mesh>
          {skirt && <mesh geometry={skirt} receiveShadow>
            <meshStandardMaterial color={kind === "platform" ? "#9e9a86" : "#a59f8c"} roughness={0.95} side={DoubleSide} />
          </mesh>}
        </group>
      ))}
      {(map.labels as [string, number, number][]).map(([name, x, z]) => (
        <Html key={name} position={[x, 2, z]} center zIndexRange={[2, 1]} style={{ pointerEvents: "none" }}>
          <span style={{
            fontSize: 10,
            fontWeight: 650,
            letterSpacing: ".015em",
            whiteSpace: "nowrap",
            color: "#26372f",
            background: "#f2f3e8e6",
            boxShadow: "0 1px 3px #23312830",
            borderRadius: 4,
            padding: "3px 6px",
          }}>{name}</span>
        </Html>
      ))}
    </group>
  );
}
