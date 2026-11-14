import { useMemo } from "react";
import { Batch, part, seeded, type Part } from "./scenery-kit";
import { Neighborhood } from "./scenery-neighborhood";
import { APPROACH, CITY_TRANSFORM, TERMINAL_GATE, WEST_STREET_X } from "./terminal-layout";

// A fictional city block composition, shown exclusively with the synthetic depot.
const WARM = ["#aea898", "#c6bca6", "#afa08c", "#c7c0aa", "#a39f90", "#a7afa0", "#acb5ad"];
const FAR = ["#a4b2b9", "#b4b7b4", "#a2a9b1", "#b9c4c5", "#a7b0b7"];
const GLASS = ["#657e86", "#6e8388", "#819295", "#64777d", "#a2afaa", "#586e77"];

function makeCity() {
  const rng = seeded(50731);
  const ground: Part[] = [];
  const architecture: Part[] = [];
  const trim: Part[] = [];
  const glazing: Part[] = [];

  const addRoad = (
    x: number, z: number, length: number, across: boolean, crossings: number[],
    eastAccess?: number,
  ) => {
    const center = across ? x : z;
    const bottom = center - length / 2;
    const top = center + length / 2;
    ground.push(part(
      [x, across ? -0.111 : -0.115, z],
      across ? [length, 0.21, 6.2] : [6.2, 0.21, length], "#6d7474",
    ));
    // Keep sidewalks out of the street junctions and the terminal service drive.
    for (const direction of [-1, 1]) {
      const gaps = crossings.map((v) => [v - 3.54, v + 3.54]);
      if (direction === 1 && eastAccess !== undefined) gaps.push([eastAccess - 3.04, eastAccess + 3.04]);
      let sidewalkStart = bottom;
      for (const [gapStart, gapEnd] of [...gaps.sort((a, b) => a[0] - b[0]), [top, top]]) {
        const stop = Math.min(gapStart, top);
        if (stop > sidewalkStart) {
          const span = stop - sidewalkStart;
          const mid = (sidewalkStart + stop) / 2;
          ground.push(part(
            across ? [mid, 0.013, z + direction * 4.05] : [x + direction * 4.05, 0.013, mid],
            across ? [span, 0.15, 1.9] : [1.9, 0.15, span], "#a8aca0",
          ));
        }
        sidewalkStart = Math.max(sidewalkStart, gapEnd);
      }
    }
    for (let t = bottom + 2.2; t < top - 1; t += 4.5) {
      if (crossings.some((v) => Math.abs(t - v) < 4.4)) continue;
      ground.push(part(
        across ? [t, 0.006, z] : [x, 0.006, t],
        across ? [1.6, 0.018, 0.075] : [0.075, 0.018, 1.6], "#b4ad8b",
      ));
    }
  };

  const approachX = (TERMINAL_GATE.x - CITY_TRANSFORM.x) / CITY_TRANSFORM.scaleX;
  const westStreet = (WEST_STREET_X - CITY_TRANSFORM.x) / CITY_TRANSFORM.scaleX;
  addRoad(-4, -28.4, 112, true, [westStreet, approachX, 30.6]);
  addRoad(-5, 28.8, 113, true, [westStreet, 30.6]);
  addRoad(30.6, 0, 58, false, [-28.4, 28.8]);
  addRoad(westStreet, 0, 57, false, [-28.4, 28.8], 30.1 / CITY_TRANSFORM.scaleZ);

  const start = TERMINAL_GATE.z / CITY_TRANSFORM.scaleZ + 0.2;
  const end = (APPROACH.streetZ - 5) / CITY_TRANSFORM.scaleZ;
  const accessWidth = 13.3 / CITY_TRANSFORM.scaleX;
  ground.push(part([approachX, -0.109, (start + end) / 2], [accessWidth, 0.21, start - end], "#727a78"));
  const streetCenter = ((APPROACH.streetEast + APPROACH.streetWest) / 2 - CITY_TRANSFORM.x) / CITY_TRANSFORM.scaleX;
  const streetLength = (APPROACH.streetEast - APPROACH.streetWest + 15) / CITY_TRANSFORM.scaleX;
  addRoad(streetCenter, APPROACH.streetZ / CITY_TRANSFORM.scaleZ, streetLength, true, [approachX]);
  for (const z of [-24, -33, -36, -39, -42, -45, -48, -51]) {
    ground.push(part([approachX, 0.007, z], [0.065, 0.016, 0.95], "#c5bc93"));
  }
  // Rail corridor behind the avenue, a geographic cue from the Pirituba setting.
  const railZ = -55.2;
  ground.push(part([-8, -0.06, railZ], [120, 0.32, 3.4], "#8a8171"));
  for (let x = -67; x <= 51; x += 0.63) {
    ground.push(part([x, 0.12, railZ], [0.14, 0.12, 2.8], "#675d52"));
  }
  for (const offset of [-0.88, -0.27, 0.27, 0.88]) {
    ground.push(part([-8, 0.2, railZ + offset], [120, 0.10, 0.038], "#757e79"));
  }

  const building = (x: number, z: number, w: number, d: number, levels: number, variant: number, distant = false) => {
    const story = 2.22 + rng() * 0.3;
    const base = 0.25;
    const height = levels * story;
    const palette = distant ? FAR : WARM;
    const wall = palette[variant % palette.length];
    architecture.push(part([x, -0.055, z], [w + 2.2, 0.18, d + 2.2], distant ? "#a8ad9e" : "#a9ab98"));
    const stepped = !distant && variant % 3 === 1 && levels > 3;
    const topHeight = stepped ? story : 0;
    const mainHeight = height - topHeight;
    architecture.push(part([x, base + mainHeight / 2, z], [w, mainHeight, d], wall));
    architecture.push(part([x, base + mainHeight + 0.12, z], [w + 0.2, 0.24, d + 0.22], "#bac0b5"));
    if (stepped) {
      architecture.push(part([x - w * 0.07, base + mainHeight + topHeight / 2, z - d * 0.08], [w * 0.77, topHeight, d * 0.72], wall));
      trim.push(part([x - w * 0.07, base + height + 0.10, z - d * 0.08], [w * 0.8, 0.23, d * 0.76], "#a8b0a5"));
      trim.push(part([x, base + mainHeight + 0.49, z + d * 0.47], [w * 0.96, 0.35, 0.08], "#889b91"));
    }
    if (!distant && variant === 6) {
      trim.push(part([x, base + height * 0.47, z + d / 2 + 0.054], [w * 0.70, height * 0.92, 0.14], "#789389"));
      trim.push(part([x + w * 0.26, base + height * 0.54, z + d / 2 + 0.20], [0.33, height * 1.04, 0.31], "#c0c6ac"));
      for (let i = -2; i <= 2; i++) {
        trim.push(part([x + i * w * 0.13, base + height * 0.54, z + d / 2 + 0.31], [0.08, height * 0.87, 0.18], "#96a998"));
      }
    }
    if (!distant && variant % 3 === 2) {
      const flank = x - w / 2 + 0.43;
      trim.push(part([flank, base + height / 2, z + d / 2 + 0.10], [0.57, height, 0.25], "#989886"));
      trim.push(part([x + w / 2 - 0.43, base + height / 2, z + d / 2 + 0.10], [0.57, height, 0.25], "#989886"));
    }
    architecture.push(part([x - w * 0.17, base + height + 0.65, z - d * 0.18], [w * 0.3, 0.96, d * 0.37], wall));
    if (variant % 3 === 0) {
      trim.push(part([x + w * 0.23, base + height + 0.39, z - d * 0.23], [w * 0.24, 0.42, d * 0.25], "#778b8e"));
      trim.push(part([x + w * 0.23, base + height + 0.67, z - d * 0.23], [w * 0.27, 0.13, d * 0.28], "#8fa2a1"));
    }
    const columns = Math.max(2, Math.floor(w / 1.8));
    const sideColumns = Math.max(2, Math.floor(d / 1.9));
    for (let y = 0; y < levels; y++) {
      const center = base + y * story + story * 0.56;
      if (stepped && y === levels - 1) {
        for (const dx of [-w * 0.25, 0, w * 0.19]) {
          glazing.push(part([x + dx, center, z + d * 0.28 + 0.016], [w * 0.14, story * 0.44, 0.039], "#728887"));
        }
        continue;
      }
      for (let i = 0; i < columns; i++) {
        const px = x - w / 2 + ((i + 0.5) * w) / columns;
        const glass = GLASS[Math.floor(rng() * GLASS.length)];
        const sillDepth = !distant && variant === 6 ? 0.137 : 0.012;
        glazing.push(part([px, center, z + d / 2 + sillDepth], [w / columns * 0.58, story * 0.52, 0.031], glass));
        if (!distant && variant % 4 === 1 && i > 0 && i < columns - 1) {
          const balconyWidth = w / columns * 0.86;
          trim.push(part([px, center - story * 0.29, z + d / 2 + 0.22], [balconyWidth, 0.11, 0.46], "#b9b8a8"));
          trim.push(part([px, center - story * 0.18, z + d / 2 + 0.43], [balconyWidth, 0.32, 0.04], "#84958b"));
        } else if (!distant && variant % 3 === 0 && y > 0) {
          trim.push(part([px, center - story * 0.27, z + d / 2 + 0.048], [w / columns * 0.68, 0.082, 0.10], "#a9ad9b"));
        }
      }
      for (let i = 0; i < sideColumns; i++) {
        const pz = z - d / 2 + ((i + 0.5) * d) / sideColumns;
        const glass = GLASS[Math.floor(rng() * GLASS.length)];
        glazing.push(part([x + w / 2 + 0.012, center, pz], [0.031, story * 0.52, d / sideColumns * 0.54], glass));
      }
      if (variant % 3 === 2 && y > 0) {
        trim.push(part([x, center - story * 0.36, z + d / 2 + 0.08], [w + 0.18, 0.15, 0.16], "#b6b4a9"));
      }
    }
  };

  // Low-rise workshops establish the near fabric; stepped residential towers
  // create a separate skyline rather than lining up behind the depot.
  [
    [-43, -18, 9, 8, 2, 3], [-42, -5, 7, 7, 3, 5], [-41, 11, 8, 9, 2, 2],
    [44, -22, 7, 6, 3, 5], [56, -3, 6, 6, 3, 1],
    [51, 23, 8, 7, 2, 4], [62, 5, 8, 9, 5, 3], [57, -10, 9, 8, 6, 4],
    [-46, -36, 8, 7, 4, 5], [-33, -37, 8, 9, 6, 2], [-21, -39, 7, 9, 5, 1],
    [-11, -42, 7, 6, 4, 1], [7, -45, 6, 5, 5, 6],
    [46.4, -40, 7, 6, 4, 1], [57, -40, 10, 8, 4, 6],
    [-26, 40, 7, 6, 2, 3], [-16, 39.5, 7, 7, 2, 5], [-7, 40, 6, 6, 2, 1],
    [3, 42.5, 8, 6, 3, 2],
  ].forEach(([x, z, w, d, floors, variant]) => building(x, z, w, d, floors, variant));

  for (let i = 0; i < 19; i++) {
    const x = -78 + i * 8.65 + rng() * 1.7;
    const z = -62 - Math.floor(rng() * 3) * 10;
    const levels = 6 + Math.floor(rng() * 8);
    building(x, z, 4.8 + rng() * 3.5, 5.5 + rng() * 3, levels, i, true);
  }

  return { ground, architecture, trim, glazing };
}

export function City() {
  const { ground, architecture, trim, glazing } = useMemo(makeCity, []);
  return (
    <group position={[CITY_TRANSFORM.x, 0, 0]} scale={[CITY_TRANSFORM.scaleX, 1, CITY_TRANSFORM.scaleZ]}>
      <Batch parts={ground} />
      <Batch parts={architecture} />
      <Batch parts={trim} />
      <Batch parts={glazing} roughness={0.49} />
      <Neighborhood />
    </group>
  );
}
