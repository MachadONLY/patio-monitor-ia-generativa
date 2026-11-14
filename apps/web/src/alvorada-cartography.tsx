import { Html } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";
import map from "./alvorada-cartography-data.json";
import { localPoint } from "./observations";

type Coordinate = [number, number];
type Layer = keyof typeof map.layers;

// Geometry is projected once during extraction (SIRGAS-compatible UTM 23S meters).
// The offset keeps it aligned with any configured local scene origin.
const mapOrigin = map.origin as Coordinate;
const appearance: [Layer, string, number, number][] = [
  ["water", "#629ca8", 0.012, 0.38],
  ["yard", "#a5aa9f", 0.028, 0.94],
  ["grass", "#859d70", 0.04, 0.92],
  ["verge", "#a9ada5", 0.10, 0.96],
  ["sidewalk", "#c5bfb0", 0.13, 0.94],
  ["road", "#6c7476", 0.19, 0.96],
  ["major", "#5c6367", 0.22, 0.96],
  ["bus", "#676f70", 0.25, 0.95],
  ["walk", "#c5bfb0", 0.27, 0.94],
  ["platform", "#cfcebd", 0.33, 0.94],
  ["mark", "#e8dfb9", 0.36, 0.86],
];

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

function createGeometry(polygons: number[][][]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const [outer, ...inner] of polygons) {
    const perimeter = ring(outer);
    if (perimeter.length < 3) continue;
    const holes = inner.map(ring).filter((hole) => hole.length >= 3);
    const triangles = ShapeUtils.triangulateShape(perimeter, holes);
    const start = positions.length / 3;
    for (const vertex of [perimeter, ...holes].flat()) {
      positions.push(vertex.x, 0, vertex.y);
      normals.push(0, 1, 0);
    }
    for (const [a, b, c] of triangles) indices.push(start + c, start + b, start + a);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function AlvoradaCartography({ origin }: { origin: Coordinate }) {
  const layers = useMemo(() => appearance.map(([kind, color, height, roughness]) => ({
    kind,
    color,
    height,
    roughness,
    geometry: createGeometry(map.layers[kind] ?? []),
  })), []);
  useEffect(() => () => layers.forEach(({ geometry }) => geometry.dispose()), [layers]);
  const [offsetX, offsetZ] = localPoint(origin, mapOrigin);

  return (
    <group position={[offsetX, 0, offsetZ]}>
      {layers.map(({ kind, color, height, roughness, geometry }) => (
        <mesh key={kind} geometry={geometry} position={[0, height, 0]} receiveShadow>
          <meshStandardMaterial color={color} roughness={roughness} side={2} />
        </mesh>
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
