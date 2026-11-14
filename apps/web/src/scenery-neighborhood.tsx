import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { Batch, part, seeded, type Part, type XYZ } from "./scenery-kit";

type Sign = {
  text: string;
  at: XYZ;
  width: number;
  height: number;
  paper: string;
  ink: string;
};

const TONES = {
  iron: "#52625b",
  pavement: "#bab4a1",
};

function makeNeighborhood() {
  const rng = seeded(17395);
  const shell: Part[] = [];
  const brick: Part[] = [];
  const tile: Part[] = [];
  const furniture: Part[] = [];
  const glazing: Part[] = [];
  const awning: Part[] = [];
  const street: Part[] = [];
  const mosaic: Part[] = [];
  const greens: Part[] = [];
  const signs: Sign[] = [];

  const place = (x: number, z: number) =>
    (list: Part[], at: XYZ, size: XYZ, color: string, rotation?: XYZ) =>
      list.push(part([x + at[0], at[1], z + at[2]], size, color, rotation));

  function planter(at: XYZ) {
    furniture.push(part(at, [0.46, 0.54, 0.48], "#8b8170"));
    for (let i = 0; i < 3; i++) {
      greens.push(part(
        [at[0] + (i - 1) * 0.12, at[1] + 0.35 + rng() * 0.11, at[2] + (rng() - 0.5) * 0.18],
        [0.33, 0.41, 0.32], ["#638050", "#7b8b51", "#84964d"][i],
      ));
    }
  }

  function deck(x: number, z: number, w: number, d: number) {
    street.push(part([x, 0.036, z], [w, 0.16, d], TONES.pavement));
    for (let offset = -w / 2 + 0.5; offset < w / 2; offset += 0.51) {
      street.push(part([x + offset, 0.119, z], [0.013, 0.009, d - 0.08], "#a29f8b"));
    }
    for (const offset of [-0.68, 0.68]) {
      street.push(part([x, 0.119, z + offset], [w - 0.11, 0.009, 0.013], "#9d9d88"));
    }
  }

  function roofRidge(x: number, z: number, width: number, depth: number, wallHeight: number, color: string) {
    const tilt = 0.35;
    const side = depth / 2 + 0.22;
    const length = side / Math.cos(tilt);
    const add = place(x, z);
    for (const direction of [-1, 1]) {
      const rotation: XYZ = [direction * tilt, 0, 0];
      add(tile, [0, wallHeight + side * Math.tan(tilt) / 2, direction * side / 2], [width + 0.38, 0.13, length], color, rotation);
      for (let ridge = -width / 2; ridge < width / 2; ridge += 0.29) {
        add(tile, [ridge, wallHeight + 0.084 + side * Math.tan(tilt) / 2, direction * side / 2], [0.052, 0.055, length], "#9a5b43", rotation);
      }
    }
    add(tile, [0, wallHeight + side * Math.tan(tilt), 0], [width + 0.39, 0.16, 0.18], "#92553e");
    // Stepped end-wall hidden under roof overhang from the public sidewalk.
    for (let i = 0; i < 5; i++) {
      add(shell, [0, wallHeight + (i + 0.5) * side * Math.tan(tilt) / 5, 0], [width, side * Math.tan(tilt) / 5, depth * (1 - i / 5)], "#bfab91");
    }
  }

  function pharmacy(x: number, z: number) {
    const add = place(x, z);
    deck(x, z + 4.18, 8.8, 2.82);
    add(shell, [0, 2.35, 0], [8.8, 4.42, 7.0], "#bfc7bb");
    add(shell, [1.48, 2.45, 2.5], [5.54, 4.68, 2.75], "#d8ded0");
    add(shell, [0, 4.75, 0], [9.1, 0.39, 7.42], "#cfd7ca");
    add(shell, [1.51, 3.52, 3.92], [5.65, 0.59, 0.15], "#698b6d");
    add(shell, [0.4, 4.24, -0.7], [3.8, 0.9, 3.8], "#d1d6c9");
    add(glazing, [1.57, 1.55, 3.89], [5.2, 2.59, 0.11], "#536d64");
    add(glazing, [-2.59, 1.58, 3.54], [2.48, 2.53, 0.11], "#5c7164");
    add(glazing, [4.287, 1.61, 2.24], [0.09, 2.54, 2.9], "#6e8375");
    for (const px of [-3.85, -2.59, -1.35, -0.95, 0.7, 2.24, 3.98]) {
      add(furniture, [px, 1.56, px < -1.2 ? 3.611 : 3.959], [0.075, 2.56, 0.095], "#c8d4c9");
    }
    add(awning, [1.53, 3.05, 4.19], [6.0, 0.12, 0.91], "#c5cdbb");
    add(awning, [-3.21, 3.11, 3.72], [2.06, 0.16, 0.43], "#55785f");
    // Dimensional pharmacy cross, visible even when text is small.
    add(furniture, [-3.36, 3.73, 3.62], [0.85, 0.27, 0.13], "#4e825a");
    add(furniture, [-3.36, 3.73, 3.62], [0.27, 0.83, 0.13], "#4e825a");
    add(furniture, [4.42, 3.53, 2.42], [0.19, 0.69, 0.20], "#5c906a");
    add(furniture, [4.42, 3.53, 2.42], [0.19, 0.20, 0.69], "#5c906a");
    signs.push({ text: "FARMÁCIA DA VILA", at: [x + 1.5, 3.52, z + 4.001], width: 5.3, height: 0.51, paper: "#698b6d", ink: "#fbf8e9" });
    planter([x - 3.72, 0.35, z + 4.41]);
    planter([x + 3.69, 0.35, z + 4.60]);
  }

  function bakery(x: number, z: number) {
    const add = place(x, z);
    deck(x, z + 4.21, 8.32, 2.74);
    add(shell, [0, 1.91, 0], [7.85, 3.56, 6.83], "#c7a886");
    add(brick, [0, 1.52, 3.36], [7.87, 2.74, 0.20], "#b46e55");
    add(brick, [3.86, 1.53, 0.91], [0.16, 2.73, 5.19], "#a16a54");
    roofRidge(x, z, 7.86, 6.85, 3.7, "#a5694f");
    add(brick, [2.45, 4.23, -1.24], [0.52, 1.37, 0.58], "#a46651");
    add(tile, [2.45, 4.95, -1.24], [0.73, 0.13, 0.78], "#a98366");
    for (const px of [-2.53, 0, 2.54]) {
      add(furniture, [px, 1.53, 3.472], [2.05, 2.37, 0.065], "#705241");
      add(glazing, [px, 1.53, 3.513], [1.82, 2.16, 0.047], "#4c5f58");
      add(furniture, [px, 1.51, 3.548], [0.045, 2.16, 0.055], "#a28a69");
      add(furniture, [px, 1.24, 3.548], [1.82, 0.047, 0.055], "#a28a69");
    }
    add(furniture, [0, 3.02, 3.456], [5.98, 0.71, 0.13], "#9a6f4d");
    for (let i = 0; i < 19; i++) {
      const px = (i - 9) * 0.42;
      const stripe = i % 2 ? "#a15f43" : "#e1c6a4";
      add(awning, [px, 2.63, 4.08], [0.42, 0.082, 1.31], stripe, [0.27, 0, 0]);
      add(awning, [px, 2.40, 4.70], [0.42, 0.22, 0.078], stripe);
    }
    signs.push({ text: "PADARIA GIRASSOL", at: [x, 3.04, z + 3.53], width: 5.81, height: 0.60, paper: "#9a6f4d", ink: "#fff1ce" });
    for (const px of [-2.57, 2.55]) {
      add(furniture, [px, 0.84, 4.78], [0.88, 0.08, 0.54], "#98765a");
      add(furniture, [px, 0.45, 4.78], [0.079, 0.79, 0.08], "#4c5850");
      for (const side of [-1, 1]) add(furniture, [px + side * 0.64, 0.47, 4.78], [0.31, 0.07, 0.34], "#a37d61");
    }
    planter([x - 3.57, 0.35, z + 4.92]);
    planter([x + 3.57, 0.35, z + 4.92]);
  }

  function market(x: number, z: number) {
    const add = place(x, z);
    deck(x, z + 5.27, 12.8, 3.38);
    add(shell, [0, 1.92, 0], [11.7, 3.58, 8.4], "#c4c3a5");
    add(shell, [-3.11, 2.36, -0.2], [5.43, 4.42, 8.3], "#b5bd9d");
    add(shell, [3.71, 2.05, -0.16], [4.42, 3.81, 8.35], "#cac6a9");
    add(shell, [-3.11, 4.61, -0.2], [5.64, 0.18, 8.54], "#87937a");
    add(shell, [3.69, 4.01, -0.16], [4.68, 0.16, 8.58], "#a9ad91");
    add(brick, [5.797, 1.45, 0.25], [0.15, 2.60, 7.93], "#ae8563");
    for (const px of [-4.8, -2.89, -0.97, 0.96, 2.89, 4.8]) {
      add(furniture, [px, 1.47, 4.24], [1.77, 2.62, 0.15], "#6d785d");
      add(glazing, [px, 1.51, 4.329], [1.55, 2.38, 0.055], "#506058");
      add(furniture, [px, 1.43, 4.37], [0.043, 2.38, 0.047], "#a1aa89");
    }
    add(awning, [0, 3.03, 4.81], [12.02, 0.14, 1.85], "#647d65", [0.11, 0, 0]);
    add(awning, [0, 2.91, 5.72], [12.03, 0.29, 0.095], "#506b58");
    add(furniture, [-2.71, 3.81, 4.23], [5.9, 0.63, 0.13], "#7b866b");
    signs.push({ text: "MERCADO SABIÁ", at: [x - 2.7, 3.81, z + 4.301], width: 5.72, height: 0.55, paper: "#7b866b", ink: "#f8edcf" });
    for (let i = 0; i < 5; i++) {
      const px = 2.1 + i * 0.57;
      add(furniture, [px, 0.47, 5.08], [0.48, 0.60, 0.74], "#8f7352");
      add(furniture, [px, 0.84, 5.08], [0.46, 0.12, 0.69], "#aa8763");
      for (let j = 0; j < 4; j++) {
        const produce = ["#b5a358", "#8b9f63", "#bf8157", "#82945e"][i % 4];
        greens.push(part([x + px + (j % 2 - 0.5) * 0.19, 0.93, z + 4.94 + Math.floor(j / 2) * 0.27], [0.19, 0.13, 0.21], produce));
      }
    }
    for (const px of [-5.35, 5.37]) planter([x + px, 0.35, z + 5.86]);
  }

  function apartments(x: number, z: number) {
    const add = place(x, z);
    deck(x, z + 4.87, 10.2, 2.55);
    add(brick, [0, 4.63, 0], [9.2, 9.0, 7.15], "#9f8f78");
    add(shell, [-3.45, 4.97, 3.58], [2.46, 9.68, 0.63], "#b4af9b");
    add(shell, [0, 9.28, 0], [9.3, 0.28, 7.34], "#a8aa97");
    add(shell, [3.0, 9.67, -1.86], [2.05, 0.78, 2.17], "#bcbaa1");
    add(shell, [0.96, 1.48, 3.61], [6.92, 2.68, 0.22], "#777862");
    for (const px of [-1.48, 0.22, 1.92, 3.63]) {
      add(glazing, [px, 1.49, 3.747], [1.50, 2.32, 0.065], "#4d6360");
      add(furniture, [px - 0.74, 1.49, 3.783], [0.09, 2.37, 0.061], "#b5b19a");
    }
    add(awning, [0.9, 2.79, 3.95], [6.98, 0.155, 0.9], "#9b7050");
    add(furniture, [0.9, 2.97, 3.66], [6.78, 0.53, 0.22], "#9a7b5c");
    signs.push({ text: "CAFÉ DO BAIRRO", at: [x + 0.9, 2.97, z + 3.777], width: 6.48, height: 0.47, paper: "#9a7b5c", ink: "#fff0cf" });
    for (let floor = 0; floor < 3; floor++) {
      const y = 3.85 + floor * 1.88;
      add(glazing, [-3.45, y + 0.24, 3.917], [0.62, 1.34, 0.04], "#617575");
      add(furniture, [-3.45, y + 0.20, 3.942], [0.047, 1.23, 0.038], "#a8aa96");
      for (const px of [-0.83, 1.96]) {
        add(glazing, [px, y + 0.36, 3.603], [1.87, 1.20, 0.055], floor % 2 ? "#637776" : "#516763");
        add(furniture, [px, y + 0.36, 3.636], [0.064, 1.20, 0.042], "#a7a68e");
        add(furniture, [px, y - 0.33, 4.00], [2.55, 0.17, 0.88], "#b9ad8e");
        add(furniture, [px, y + 0.13, 4.40], [2.46, 0.05, 0.06], TONES.iron);
        for (let j = 0; j < 9; j++) {
          add(furniture, [px + (j - 4) * 0.29, y - 0.083, 4.4], [0.026, 0.41, 0.04], TONES.iron);
        }
      }
      for (const pz of [-2.46, -0.11, 2.28]) {
        add(glazing, [4.613, y + 0.31, pz], [0.045, 1.07, 1.32], "#607573");
        add(furniture, [4.642, y - 0.22, pz], [0.16, 0.086, 1.49], "#a7a48d");
      }
    }
    planter([x + 4.17, 0.35, z + 4.26]);
    planter([x - 2.51, 0.35, z + 4.26]);
  }

  pharmacy(14, -38.9);
  bakery(-1.65, -39.2);
  market(41.6, 9.4);
  apartments(39.15, -10.7);


  // A small open square connects the corner market to the southern sidewalk.
  const squareX = 41.0;
  const squareZ = 21.5;
  street.push(part([squareX, 0.015, squareZ], [10.7, 0.18, 8.7], "#9b9e88"));
  mosaic.push(part([squareX, 0.102, squareZ], [10.35, 0.032, 8.3], "#d3c5a6"));
  for (const x of [37.04, 44.99]) {
    furniture.push(part([x, 0.23, squareZ], [1.39, 0.31, 4.45], "#aba087"));
    furniture.push(part([x, 0.404, squareZ], [1.20, 0.071, 4.23], "#788361"));
    for (let i = 0; i < 11; i++) {
      const z = squareZ - 1.94 + i * 0.38;
      const hue = ["#778b56", "#83935c", "#5c7751"][i % 3];
      greens.push(part([x, 0.55 + rng() * 0.12, z], [0.78, 0.41, 0.48], hue));
    }
  }
  const arbor = place(squareX, squareZ - 0.3);
  for (const x of [-1.75, 1.75]) {
    for (const z of [-1.17, 1.17]) {
      arbor(furniture, [x, 1.47, z], [0.14, 2.71, 0.14], "#62776a");
    }
    arbor(furniture, [x, 2.83, 0], [0.15, 0.16, 2.9], "#687d6d");
  }
  for (let i = -3; i <= 3; i++) {
    arbor(awning, [0, 2.97, i * 0.42], [4.01, 0.11, 0.10], "#9c8367");
  }
  for (const z of [-0.73, 0.73]) {
    arbor(furniture, [0, 0.58, z], [2.65, 0.11, 0.48], "#9b866a");
    for (const x of [-1.03, 1.03]) arbor(furniture, [x, 0.35, z], [0.13, 0.38, 0.40], TONES.iron);
  }

  // Paving and kerb furniture communicate that the houses share the depot's streets.
  for (const [x, z, w] of [[-10, -32.17, 18], [10, -32.17, 14], [40, -32.17, 17]]) {
    for (let j = -w / 2 + 0.2; j < w / 2; j += 0.38) {
      street.push(part([x + j, 0.099, z], [0.26, 0.023, 0.29], j % 3 ? "#ae9d77" : "#b9a57b"));
    }
  }
  for (const [x, z] of [[-15.5, -32.5], [4.2, -32.8], [28.4, -32.8], [44.8, -32.8], [35.37, -6], [35.37, 11.2]]) {
    street.push(part([x, 0.15, z], [0.31, 0.30, 0.31], "#b4ac91"));
    furniture.push(part([x, 2.22, z], [0.112, 4.31, 0.112], "#66716a"));
    furniture.push(part([x, 4.39, z + 0.34], [0.12, 0.11, 0.75], "#65726c"));
    furniture.push(part([x, 4.34, z + 0.68], [0.29, 0.135, 0.44], "#a6a997"));
  }
  for (const [x, z] of [[-10, -32.8], [9.2, -33.1], [38.5, -32.85], [36, -4.8], [36.4, 14.8]]) {
    for (const dz of [-0.11, 0, 0.11]) furniture.push(part([x, 0.51, z + dz], [1.44, 0.06, 0.071], "#a18d72"));
    for (const dx of [-0.55, 0.55]) furniture.push(part([x + dx, 0.29, z], [0.12, 0.40, 0.22], TONES.iron));
    furniture.push(part([x + 1.13, 0.35, z], [0.29, 0.53, 0.31], "#5b6960"));
    furniture.push(part([x + 1.13, 0.63, z], [0.33, 0.075, 0.34], "#424e48"));
  }

  // Zebra stripes are flat road paint and don't enter the simulated gate corridor.
  for (const [x, z] of [[-31.3, -24.2], [30.6, -24.2], [30.6, 24.6]]) {
    for (let i = -4; i <= 4; i++) {
      street.push(part([x + i * 0.58, 0.005, z], [0.34, 0.015, 1.83], "#c5c4ad"));
    }
  }

  return { shell, brick, tile, furniture, glazing, awning, street, mosaic, greens, signs };
}

function surface(kind: "stucco" | "brick" | "tile" | "mosaic"): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const rng = seeded(73438);
  const pixels = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const start = 4 * (y * 128 + x);
      let value = 232 + (rng() - 0.5) * 22;
      if (kind === "brick") {
        const row = Math.floor(y / 10);
        const joint = (x + (row % 2) * 10) % 20;
        if (y % 10 < 1 || joint < 1) value = 198;
        else value += (Math.sin(row * 31 + Math.floor(x / 20) * 93) - 1) * 7;
      } else if (kind === "tile") {
        if (y % 12 < 1) value = 204;
        else value += Math.cos((x % 12) / 12 * 2 * Math.PI) * 7;
      } else if (kind === "mosaic") {
        const offset = Math.sin(x * Math.PI / 32) * 8;
        const band = (y + offset + 32) % 32;
        value += band < 9 ? -73 : 10;
        if (x % 5 === 0 || y % 4 === 0) value *= 0.91;
      }
      pixels.data.set([value, value, value, 255], start);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function ShopSign({ sign }: { sign: Sign }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = sign.paper;
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = sign.ink;
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 2;
    ctx.strokeRect(9, 10, 494, 76);
    ctx.globalAlpha = 1;
    ctx.font = '700 61px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = sign.ink;
    ctx.fillText(sign.text, 256, 51, 460);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [sign]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={sign.at}>
      <planeGeometry args={[sign.width, sign.height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function Neighborhood() {
  const city = useMemo(makeNeighborhood, []);
  const stucco = useMemo(() => surface("stucco"), []);
  const brick = useMemo(() => surface("brick"), []);
  const tile = useMemo(() => surface("tile"), []);
  const mosaic = useMemo(() => surface("mosaic"), []);
  useEffect(() => () => {
    stucco.dispose();
    brick.dispose();
    tile.dispose();
    mosaic.dispose();
  }, [stucco, brick, tile, mosaic]);
  return (
    <>
      <Batch parts={city.street} />
      <Batch parts={city.mosaic} map={mosaic} />
      <Batch parts={city.shell} cast map={stucco} bumpMap={stucco} bumpScale={0.029} />
      <Batch parts={city.brick} cast map={brick} bumpMap={brick} bumpScale={0.041} />
      <Batch parts={city.tile} cast map={tile} bumpMap={tile} bumpScale={0.026} />
      <Batch parts={city.furniture} />
      <Batch parts={city.glazing} roughness={0.39} />
      <Batch parts={city.awning} cast />
      <Batch parts={city.greens} shape="leaf" />
      {city.signs.map((sign) => <ShopSign key={sign.at.join(",")} sign={sign} />)}
    </>
  );
}
