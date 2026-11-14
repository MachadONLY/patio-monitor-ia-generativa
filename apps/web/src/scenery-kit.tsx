import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture, Color, SRGBColorSpace,
  Object3D,
  type InstancedMesh,
  type Texture,
} from "three";

export type XYZ = [number, number, number];
export type Part = {
  at: XYZ;
  size: XYZ;
  color: string;
  rotation?: XYZ;
};
export type Shape = "box" | "leaf" | "trunk";

export function part(
  at: XYZ,
  size: XYZ,
  color: string,
  rotation?: XYZ,
): Part {
  return { at, size, color, rotation };
}

export function Batch({
  parts,
  shape = "box",
  cast = false,
  receive = true,
  roughness = 0.88,
  emissive = "#000000",
  emissiveIntensity = 0,
  map,
  bumpMap,
  bumpScale,
}: {
  parts: Part[];
  shape?: Shape;
  cast?: boolean;
  receive?: boolean;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  map?: Texture;
  bumpMap?: Texture;
  bumpScale?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const placement = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    parts.forEach(({ at, size, rotation, color }, index) => {
      placement.position.set(...at);
      placement.rotation.set(...(rotation ?? [0, 0, 0]));
      placement.scale.set(...size);
      placement.updateMatrix();
      mesh.setMatrixAt(index, placement.matrix);
      mesh.setColorAt(index, tint.set(color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts, placement, tint]);

  if (!parts.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} castShadow={cast} receiveShadow={receive}>
      {shape === "leaf" ? <icosahedronGeometry args={[0.5, 1]} /> : shape === "trunk" ? <cylinderGeometry args={[0.35, 0.5, 1, 8]} /> : <boxGeometry />}
      <meshStandardMaterial roughness={roughness} emissive={emissive} emissiveIntensity={emissiveIntensity} map={map} bumpMap={bumpMap} bumpScale={bumpScale} />
    </instancedMesh>
  );
}

export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function Sign({
  text,
  at,
  width,
  height,
  color = "#eeeade",
  ground = false,
  weight = 700,
  rotationY = 0,
}: {
  text: string;
  at: XYZ;
  width: number;
  height: number;
  color?: string;
  ground?: boolean;
  weight?: number;
  rotationY?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${weight} 100px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 68, 489);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [text, color, weight]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={at} rotation={ground ? [-Math.PI / 2, 0, 0] : [0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
