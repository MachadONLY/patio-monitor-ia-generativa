import geometry from "./alvorada-vehicle-surfaces.json" with { type: "json" };
import { localPoint } from "./observations";
import type { VehicleRoadPose } from "./alvorada-road-path";

const tile = 36;
const origin: [number, number] = [geometry.origin[0], geometry.origin[1]];
const edges = new Map<string, number[][]>();
const scanlines = new Map<number, number[][]>();

for (const polygon of geometry.rings) {
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const [a, b, c, d] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
      for (let iz = Math.floor(Math.min(b, d) / tile); iz <= Math.floor(Math.max(b, d) / tile); iz++) {
        const row = scanlines.get(iz) ?? [];
        row.push([a, b, c, d]);
        scanlines.set(iz, row);
      }
      for (let ix = Math.floor(Math.min(a, c) / tile); ix <= Math.floor(Math.max(a, c) / tile); ix++) {
        for (let iz = Math.floor(Math.min(b, d) / tile); iz <= Math.floor(Math.max(b, d) / tile); iz++) {
          const key = ix + "," + iz;
          const segments = edges.get(key) ?? [];
          segments.push([a, b, c, d]);
          edges.set(key, segments);
        }
      }
    }
  }
}

export function alvoradaRoadSurface(sceneOrigin: [number, number]) {
  const [offsetX, offsetZ] = localPoint(origin, sceneOrigin);
  return ({ x, z, heading }: VehicleRoadPose) => {
    x += offsetX;
    z += offsetZ;
    let inside = false;
    for (const [a, b, c, d] of scanlines.get(Math.floor(z / tile)) ?? []) {
      if ((b > z) !== (d > z) && x < a + (c - a) * (z - b) / (d - b)) inside = !inside;
    }
    if (!inside) return false;

    // The physical model is under 12.5m × 3.2m including mirrors. Reject
    // any road or obstacle boundary that touches its oriented footprint.
    const sin = Math.sin(heading), cos = Math.cos(heading);
    const halfLength = 6.4, halfWidth = 1.7;
    const rx = Math.abs(sin) * halfLength + Math.abs(cos) * halfWidth;
    const rz = Math.abs(cos) * halfLength + Math.abs(sin) * halfWidth;
    for (let ix = Math.floor((x - rx) / tile); ix <= Math.floor((x + rx) / tile); ix++) {
      for (let iz = Math.floor((z - rz) / tile); iz <= Math.floor((z + rz) / tile); iz++) {
        for (const [a, b, c, d] of edges.get(ix + "," + iz) ?? []) {
          if (Math.max(a, c) < x - rx || Math.min(a, c) > x + rx ||
              Math.max(b, d) < z - rz || Math.min(b, d) > z + rz) continue;
          const ax = (a - x) * cos - (b - z) * sin, az = (a - x) * sin + (b - z) * cos;
          const bx = (c - x) * cos - (d - z) * sin, bz = (c - x) * sin + (d - z) * cos;
          if (Math.min(ax, bx) > halfWidth || Math.max(ax, bx) < -halfWidth ||
              Math.min(az, bz) > halfLength || Math.max(az, bz) < -halfLength) continue;
          // Separating axis normal to the boundary segment.
          const dx = bx - ax, dz = bz - az;
          if (Math.abs(ax * dz - az * dx) <= Math.abs(dz) * halfWidth + Math.abs(dx) * halfLength) return false;
        }
      }
    }
    return true;
  };
}
