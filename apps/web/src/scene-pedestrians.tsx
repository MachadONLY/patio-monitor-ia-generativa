import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";

type Walk = {
  from: [number, number];
  to: [number, number];
  offset: number;
  ground: number;
  shirt: string;
  skin: string;
  trousers: string;
};

const walks: Walk[] = [
  { from: [-41.36, -29], to: [-41.36, 3.5], ground: 0.13, offset: 2, shirt: "#a95336", skin: "#9e664a", trousers: "#343b47" },
  { from: [-41.36, -27], to: [-41.36, 3.5], ground: 0.13, offset: 15, shirt: "#497a8a", skin: "#bc886c", trousers: "#30383b" },
  { from: [-51.2, -13.1], to: [-41.36, -13.1], ground: 0.16, offset: 6, shirt: "#d2a34b", skin: "#ac7559", trousers: "#45403e" },
  { from: [-43.37, -27.8], to: [-43.37, -21.6], ground: 0.16, offset: 3, shirt: "#57668f", skin: "#8c5c42", trousers: "#48474b" },
  { from: [-44.1, -9], to: [-44.1, 3.9], ground: 0.16, offset: 6, shirt: "#8d5370", skin: "#b98767", trousers: "#484139" },
  { from: [-44.1, -24.7], to: [-44.1, -24.7], ground: 0.16, offset: 0, shirt: "#427b6d", skin: "#d29b74", trousers: "#38443b" },
  { from: [-44.15, -21.55], to: [-44.15, -21.55], ground: 0.16, offset: 0, shirt: "#b87146", skin: "#79513d", trousers: "#343b47" },
  { from: [-27.94, -9.1], to: [-27.94, 9.1], ground: 0.22, offset: 5, shirt: "#568b81", skin: "#d5a582", trousers: "#424950" },
  { from: [-13.95, -8.9], to: [-13.95, 9.1], ground: 0.22, offset: 1, shirt: "#d2a847", skin: "#b98560", trousers: "#30494d" },
  { from: [-0.03, -9.2], to: [-0.03, 9.2], ground: 0.22, offset: 13, shirt: "#a37591", skin: "#7d513f", trousers: "#353442" },
  { from: [14.07, -9], to: [14.07, 9.1], ground: 0.22, offset: 15, shirt: "#ad6e39", skin: "#d29b74", trousers: "#39404c" },
  { from: [-23, 35.8], to: [2, 35.8], ground: 0.13, offset: 13, shirt: "#6d7fa0", skin: "#9e664a", trousers: "#353442" },
  { from: [16, 36.8], to: [38, 36.8], ground: 0.13, offset: 20, shirt: "#537966", skin: "#c89575", trousers: "#514438" },
  { from: [32, 4.2], to: [37.8, 4.2], ground: 0.23, offset: 3, shirt: "#2d6f73", skin: "#b47c5d", trousers: "#45463e" },
  { from: [58.1, -23], to: [58.1, 22], ground: 0.13, offset: 9, shirt: "#aa5e4b", skin: "#7d513f", trousers: "#29393a" },
];

const figure = [
  { at: [0, 1.59, 0], size: [0.24, 0.30, 0.24], color: "skin", swing: 0 },
  { at: [0, 1.15, 0], size: [0.43, 0.63, 0.29], color: "shirt", swing: 0 },
  { at: [-0.13, 0.43, 0], size: [0.17, 0.84, 0.17], color: "trousers", swing: 1 },
  { at: [0.13, 0.43, 0], size: [0.17, 0.84, 0.17], color: "trousers", swing: -1 },
  { at: [-0.24, 0.99, 0], size: [0.13, 0.50, 0.13], color: "shirt", swing: -0.72 },
  { at: [0.24, 0.99, 0], size: [0.13, 0.50, 0.13], color: "shirt", swing: 0.72 },
] as const;

export function Pedestrians({ elapsed }: { elapsed: { current: number } }) {
  const mesh = useRef<InstancedMesh>(null);
  const walker = useMemo(() => new Object3D(), []);
  const limb = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    const color = new Color();
    walks.forEach((walk, index) => {
      figure.forEach((part, i) => instance.setColorAt(index * figure.length + i, color.set(walk[part.color])));
    });
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const instance = mesh.current;
    if (!instance) return;
    walks.forEach((walk, index) => {
      const dx = walk.to[0] - walk.from[0];
      const dz = walk.to[1] - walk.from[1];
      const time = elapsed.current + walk.offset;
      const distance = Math.hypot(dx, dz);
      const cycle = distance ? (time * 0.95 / distance) % 2 : 0;
      const progress = cycle <= 1 ? cycle : 2 - cycle;
      const stride = distance ? Math.sin(time * 7.7) : 0;
      walker.position.set(walk.from[0] + dx * progress, walk.ground + Math.abs(stride) * 0.03, walk.from[1] + dz * progress);
      walker.rotation.y = distance ? Math.atan2(dx, dz) + (cycle <= 1 ? 0 : Math.PI) : -Math.PI / 2;
      walker.updateMatrix();
      figure.forEach((part, i) => {
        limb.position.set(part.at[0], part.at[1], stride * part.swing * 0.11);
        limb.scale.set(part.size[0], part.size[1], part.size[2]);
        limb.rotation.x = -stride * part.swing * 0.36;
        limb.updateMatrix();
        limb.matrix.premultiply(walker.matrix);
        instance.setMatrixAt(index * figure.length + i, limb.matrix);
      });
    });
    instance.instanceMatrix.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, walks.length * figure.length]} frustumCulled={false} receiveShadow>
      <sphereGeometry args={[0.5, 6, 5]} />
      <meshStandardMaterial roughness={0.88} />
    </instancedMesh>
  );
}
