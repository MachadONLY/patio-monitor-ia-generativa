import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { APPROACH, APRON, BAY, TERMINAL_BOUNDS, terminalBays } from "./terminal-layout";
import { TerminalHall } from "./scenery-terminal";
import { City } from "./scenery-city";
import { Batch, Sign, part, seeded, type Part, type XYZ } from "./scenery-kit";

function Asphalt() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const grain = ctx.createImageData(256, 256);
    const rng = seeded(8734);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const aggregate = (rng() - 0.5) * 22;
        const patch = Math.cos(x * Math.PI / 32) * Math.sin(y * Math.PI / 32) * 2;
        const value = 155 + aggregate + patch;
        grain.data.set([value + 1, value, value - 2, 255], i);
      }
    }
    ctx.putImageData(grain, 0, 0);
    const map = new CanvasTexture(canvas);
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(16, 12);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[(TERMINAL_BOUNDS.west + TERMINAL_BOUNDS.east) / 2, -0.007, (TERMINAL_BOUNDS.north + TERMINAL_BOUNDS.south) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[TERMINAL_BOUNDS.east - TERMINAL_BOUNDS.west, TERMINAL_BOUNDS.south - TERMINAL_BOUNDS.north]} />
      <meshStandardMaterial color="#a5a6a5" map={texture} roughness={0.97} />
    </mesh>
  );
}

const C = {
  concrete: "#cbc8b9",
  trim: "#c2c8bd",
  steel: "#526663",
  roof: "#d6d8cd",
  glass: "#486569",
  lane: "#f0edde",
  yellow: "#d6a444",
  green: "#285f52",
};

const platforms = [
  { x: -27, width: 3.5, name: "PLATAFORMA A" },
  { x: -13, width: 3.2, name: "PLATAFORMA B" },
  { x: 1, width: 3.7, name: "PLATAFORMA C" },
  { x: 15, width: 3.1, name: "PLATAFORMA D" },
];

function makeYard() {
  const terrain: Part[] = [];
  const fixtures: Part[] = [];
  const details: Part[] = [];
  const painted: Part[] = [];
  const glazing: Part[] = [];
  const lights: Part[] = [];
  const posts: Part[] = [];
  const foliage: Part[] = [];
  const branches: Part[] = [];
  const rng = seeded(611401);
  const g = (at: XYZ, size: XYZ, color: string) => terrain.push(part(at, size, color));
  const f = (at: XYZ, size: XYZ, color: string, rotation?: XYZ) => fixtures.push(part(at, size, color, rotation));
  const d = (at: XYZ, size: XYZ, color: string, rotation?: XYZ) => details.push(part(at, size, color, rotation));
  const p = (at: XYZ, size: XYZ, color = C.lane, rotation?: XYZ) => painted.push(part(at, size, color, rotation));

  g([0, -0.77, 0], [390, 1, 360], "#879479");
  g([-0.6, 0.04, 36.25], [96.4, 0.18, 3.5], C.concrete);
  g([57.4, 0.04, 1], [2.4, 0.18, 75.5], C.concrete);
  g([-2.6, 0.04, -35.7], [88.8, 0.18, 2.0], C.concrete);
  for (let x = -47; x <= 47; x += 1.45) {
    d([x, 0.136, 36.25], [0.025, 0.01, 3.45], "#9e9f91");
  }

  // Lightweight folded roofs, exposed concrete and passenger services.
  for (const [index, { x, width }] of platforms.entries()) {
    const edge = width / 2 - 0.19;
    const roofWidth = width + 1.7;
    g([x, 0.107, 0], [width, 0.23, 20.5], C.concrete);
    for (const side of [-1, 1]) {
      d([x + side * edge, 0.232, 0], [0.14, 0.024, 19.8], C.yellow);
      f([x + side * roofWidth / 4, 5.37, 0], [roofWidth / 2 + 0.03, 0.13, 23.8], index % 2 ? "#d0d6cf" : C.roof, [0, 0, side * 0.10]);
      f([x + side * (roofWidth / 2 - 0.01), 5.52, 0], [0.085, 0.18, 23.9], "#a4b0a5");
      for (let z = -11.6; z <= 11.6; z += 0.58) {
        d([x + side * roofWidth / 4, 5.48, z], [roofWidth / 2 - 0.045, 0.025, 0.035], "#b8c2b8", [0, 0, side * 0.10]);
      }
    }
    f([x, 5.18, 0], [0.29, 0.25, 23.75], C.steel);
    f([x, 4.91, 11.83], [2.35, 0.4, 0.11], C.green);
    for (const z of [-8, 0, 8]) {
      f([x, 2.48, z], [0.30, 4.52, 0.29], C.steel);
      f([x, 4.95, z], [roofWidth - 0.26, 0.16, 0.14], C.steel);
      f([x, 0.42, z], [0.5, 0.39, 0.46], "#a3a89c");
      lights.push(part([x + 0.54, 4.79, z], [0.14, 0.06, 1.35], "#fff0cb"));
    }
    for (const z of [-5.1, 4.6]) {
      f([x + 0.43, 0.68, z], [0.42, 0.11, 1.85], "#a47c50");
      f([x + 0.21, 0.9, z], [0.085, 0.35, 1.85], "#b58c61");
      for (const dz of [-0.64, 0.64]) f([x + 0.42, 0.43, z + dz], [0.29, 0.42, 0.09], C.steel);
    }
    f([x - 0.49, 1.63, 1.82], [0.07, 1.53, 0.86], C.steel);
    d([x - 0.54, 1.67, 1.82], [0.024, 1.27, 0.66], "#e0d9c4");
  }

  // Service island between the platforms and the two vehicle portals.
  g([34.8, 0.106, 0], [9.5, 0.24, 21], C.concrete);
  for (let z = -9.3; z <= 9.4; z += 0.92) {
    d([34.8, 0.231, z], [9.36, 0.011, 0.023], "#a8aa9b");
  }
  f([35, 1.53, -3.55], [7.25, 2.82, 6.8], "#c1b3a0");
  f([35, 3.11, -3.55], [7.67, 0.27, 7.22], "#d4d2bf");
  f([35, 3.46, 1.42], [8.05, 0.22, 3.66], C.roof);
  for (const x of [31.35, 38.65]) f([x, 1.84, 2.84], [0.18, 3.23, 0.18], C.steel);
  f([35, 2.61, -0.10], [7.16, 0.48, 0.16], C.green);
  for (const x of [32.72, 35, 37.28]) {
    glazing.push(part([x, 1.70, -0.09], [1.88, 0.95, 0.078], C.glass));
    f([x, 1.16, -0.02], [1.99, 0.12, 0.24], "#a59a83");
    lights.push(part([x, 3.325, 0.95], [0.62, 0.06, 0.15], "#fff0cb"));
  }
  for (let z = -6.55; z < -0.4; z += 0.27) {
    d([38.65, 1.53, z], [0.049, 2.44, 0.018], "#a18b72");
  }
  f([35, 1.13, 7.35], [7.1, 0.12, 2.85], "#b8c1b4");
  for (const x of [31.85, 38.15]) f([x, 0.67, 7.35], [0.11, 0.94, 2.72], C.steel);
  for (const x of [32.75, 35.75, 37.85]) {
    g([x, 0.37, 9.15], [1.32, 0.36, 1.63], "#a39d87");
    foliage.push(part([x, 0.73, 9.15], [1.22, 0.68, 1.49], "#66804c"));
  }
  for (const z of [-27, 27]) {
    for (let x = -33; x < 39; x += 5.6) {
      p([x, 0.012, z + (z < 0 ? -5.15 : 5.15)], [2.72, 0.014, 0.082], "#c5c4ad");
    }
  }

  // Separate vehicular portals with a median booth and clear headroom.
  const { inboundX, outboundX } = APPROACH;
  f([50, 0.09, -34.5], [0.96, 0.2, 4.5], C.concrete);
  f([50, 1.02, -34.65], [0.83, 1.72, 1.86], C.trim);
  glazing.push(part([50, 1.41, -33.70], [0.68, 0.56, 0.07], C.glass));
  for (const x of [43.4, 56.6]) {
    f([x, 2.56, -35.1], [0.24, 5.12, 0.24], C.steel);
  }
  f([50, 5.25, -35.15], [13.65, 0.25, 3.65], C.roof);
  for (const x of [inboundX, outboundX]) {
    f([x, 5.04, -33.23], [4.16, 0.48, 0.10], C.green);
  }

  for (let z = -32; z < 16; z += 4.8) {
    p([50, 0.012, z], [0.09, 0.014, 2.18], "#d4bf79");
    p([56.3, 0.012, z], [0.09, 0.014, 2.18], "#d4bf79");
  }

  for (const { x, z } of terminalBays) {
    for (const dx of [-BAY.width / 2, BAY.width / 2]) p([x + dx, 0.014, z], [0.095, 0.014, BAY.length]);
    for (const dz of [-BAY.length / 2, BAY.length / 2]) {
      for (const dx of [-1.75, 1.75]) p([x + dx, 0.014, z + dz], [0.99, 0.014, 0.09]);
    }
  }

  function arrow(x: number, z: number, heading: number) {
    const at = (dx: number, dz: number): XYZ => [
      x + dx * Math.cos(heading) + dz * Math.sin(heading),
      0.017,
      z - dx * Math.sin(heading) + dz * Math.cos(heading),
    ];
    p(at(0, -0.14), [0.15, 0.016, 1.24], C.lane, [0, heading, 0]);
    p(at(-0.22, 0.43), [0.11, 0.016, 0.70], C.lane, [0, heading + 0.74, 0]);
    p(at(0.22, 0.43), [0.11, 0.016, 0.70], C.lane, [0, heading - 0.74, 0]);
  }
  for (const x of [-30, -14, 2, 18, 31]) {
    arrow(x, APRON.south, Math.PI / 2);
    arrow(x, APRON.north, -Math.PI / 2);
  }
  for (const z of [-23, -12, 0, 12]) arrow(outboundX, z, Math.PI);
  arrow(inboundX, -41, 0);

  for (const x of [-37, -13, 11, 35]) {
    for (const z of [-35.65, 36.3]) {
      posts.push(part([x, 3.35, z], [0.19, 6.7, 0.19], C.steel));
      f([x, 6.7, z + (z > 0 ? -0.44 : 0.44)], [0.08, 0.11, 0.93], C.steel);
      lights.push(part([x, 6.62, z + (z > 0 ? -0.81 : 0.81)], [0.28, 0.07, 0.38], "#f3ebd7"));
    }
  }

  const greens = ["#4a6c43", "#658048", "#7d914d", "#526f3b", "#617f57", "#8c9954"];
  const purple = ["#785e91", "#9274a0", "#84669d", "#a087a9", "#6f577f"];
  function tree(x: number, z: number, s: number, floral = false) {
    const palette = floral ? purple : greens;
    const trunk = "#695845";
    const h = 3.02 * s;
    const top = (2.1 + rng() * 0.45) * s;
    const phase = rng() * Math.PI * 2;
    posts.push(part([x, h * 0.49, z], [0.27 * s, h, 0.28 * s], trunk, [0.015, 0, 0.035]));
    for (let j = 0; j < 7; j++) {
      const angle = phase + j * Math.PI * 2 / 7;
      const r = s * (0.68 + rng() * 0.7);
      const crownX = x + Math.cos(angle) * r, crownZ = z + Math.sin(angle) * r;
      const crownY = top + s * (0.66 + rng() * 0.57);
      const spread = s * (1.12 + rng() * 1.03);
      branches.push(part([(x + crownX) / 2, crownY - s * 0.67, (z + crownZ) / 2], [0.10 * s, 1.75 * s, 0.11 * s], trunk, [Math.sin(angle) * 0.57, 0, -Math.cos(angle) * 0.57]));
      foliage.push(part([crownX, crownY, crownZ], [spread * 1.15, spread * 0.81, spread], palette[j % palette.length], [0, angle, 0.08]));
      foliage.push(part([crownX + 0.2 * s, crownY + s * 0.48, crownZ], [spread * 0.71, spread * 0.67, spread * 0.75], palette[(j + 1) % palette.length], [0, angle + 0.5, -0.14]));
    }
    foliage.push(part([x, top + 1.68 * s, z], [2.0 * s, 1.48 * s, 1.85 * s], palette[2]));
  }


  for (const [index, [x, z, scale]] of [
    [-48.7, -34, 1.05], [-53.1, 34, 0.92],
    [-36, 39.9, 0.89], [-23, 39.8, 1.03], [-10, 39.8, 0.96], [4, 39.7, 0.9],
    [17, 39.8, 1.11], [31, 39.9, 0.97], [46, 39.7, 0.96],
    [-39, -39.5, 1.04], [-24, -39.6, 1.24], [-7, -39.6, 1.02], [10, -39.5, 1.3],
    [24, -39.5, 1.02], [36, -39.5, 0.97], [59.1, -30, 1.12], [59.1, -10, 1.04],
    [59.1, 13, 1.11], [59.1, 30, 0.88], [36.5, 9, 0.81], [31, -8.6, 0.82],
  ].entries()) tree(x, z, scale, index === 7 || index === 14);

  return { terrain, fixtures, details, painted, glazing, lights, posts, foliage, branches };
}

export function Scenery() {
  const parts = useMemo(makeYard, []);
  return (
    <>
      <City />
      <Batch parts={parts.terrain} />
      <Asphalt />
      <TerminalHall />
      <Batch parts={parts.fixtures} cast />
      <Batch parts={parts.details} />
      <Batch parts={parts.painted} />
      <Batch parts={parts.glazing} roughness={0.44} />
      <Batch parts={parts.lights} receive={false} emissive="#e9bf7f" emissiveIntensity={0.19} />
      <Batch parts={parts.posts} shape="trunk" cast />
      <Batch parts={parts.branches} shape="trunk" />
      <Batch parts={parts.foliage} shape="leaf" cast />

      <Sign text="TERMINAL PÁTIO LESTE" at={[35, 2.62, -0.011]} width={6.87} height={0.56} />
      <Sign text="ENTRADA" at={[APPROACH.inboundX, 5.04, -33.169]} width={3.85} height={0.63} />
      <Sign text="SAÍDA" at={[APPROACH.outboundX, 5.04, -33.169]} width={3.85} height={0.63} />
      {platforms.map(({ x, name }) => <Sign key={name} text={name} at={[x, 4.91, 11.896]} width={2.3} height={0.44} />)}
      {terminalBays.map(({ x, z, id }) => (
        <Sign key={id} text={id} at={[x, 0.026, z + 8.5]} width={2.6} height={0.98} ground />
      ))}
    </>
  );
}
