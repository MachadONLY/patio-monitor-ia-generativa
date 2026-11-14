import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "three";

export type Surface = "soil" | "meadow" | "asphalt" | "paving" | "platform" | "water";

const size = 128;

function hash(x: number, y: number) {
  let mixed = Math.imul(x + 41, 198491317) ^ Math.imul(y + 79, 6542989);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 0xffffffff;
}

function sample(u: number, v: number, period: number) {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const wrap = (coordinate: number) => (coordinate + period) % period;
  const ease = (phase: number) => phase * phase * (3 - 2 * phase);
  const fx = ease(x - x0);
  const fy = ease(y - y0);
  const top = hash(wrap(x0), wrap(y0)) * (1 - fx) + hash(wrap(x0 + 1), wrap(y0)) * fx;
  const bottom = hash(wrap(x0), wrap(y0 + 1)) * (1 - fx) + hash(wrap(x0 + 1), wrap(y0 + 1)) * fx;
  return top * (1 - fy) + bottom * fy;
}

function joint(value: number, width: number) {
  const fraction = value - Math.floor(value);
  return Math.max(0, 1 - Math.min(fraction, 1 - fraction) / width);
}

function describeSurface(surface: Surface, u: number, v: number, grain: number) {
  const broad = sample(u, v, 4) - 0.5;
  const mottling = sample(u, v, 19) - 0.5;
  const fine = sample(u, v, 51) - 0.5;

  switch (surface) {
    case "asphalt": {
      const speckle = grain > 0.91 ? 0.18 : grain < 0.1 ? -0.17 : (grain - 0.5) * 0.10;
      const worn = sample(u, v, 9);
      const brightness = 0.90 + broad * 0.11 + mottling * 0.14 + speckle;
      return [brightness, brightness * (1 - worn * 0.012), brightness * (1 - worn * 0.030), 0.52 + fine * 0.24 + speckle];
    }
    case "soil": {
      const brightness = 0.89 + broad * 0.22 + mottling * 0.13 + fine * 0.09 + (grain - 0.5) * 0.13;
      return [brightness, brightness * (0.97 - broad * 0.07), brightness * 0.91, 0.5 + fine * 0.26];
    }
    case "meadow": {
      const brightness = 0.86 + broad * 0.23 + mottling * 0.19 + fine * 0.16 + (grain - 0.5) * 0.11;
      return [brightness * (0.98 + broad * 0.16), brightness, brightness * (0.91 - broad * 0.16), 0.5 + fine * 0.32];
    }
    case "paving":
    case "platform": {
      const slabs = surface === "platform" ? 8 : 16;
      const row = Math.floor(v * slabs);
      const stagger = row % 2 ? 0.5 : 0;
      const seam = Math.max(joint(v * slabs, 0.085), joint(u * slabs + stagger, 0.085));
      const mix = hash((Math.floor(u * slabs + stagger) + slabs) % slabs, row) - 0.5;
      const brightness = 0.93 + mix * 0.14 + mottling * 0.08 + fine * 0.06 - seam * 0.19;
      return [brightness, brightness * 0.986, brightness * 0.96, 0.70 - seam * 0.6 + fine * 0.08];
    }
    case "water": {
      const wave = Math.sin(Math.PI * 2 * (u * 12 - v * 7) + broad * 4 + mottling * 2);
      const secondary = Math.sin(Math.PI * 2 * (u * 5 + v * 17) + mottling * 3);
      const crest = Math.max(0, wave * 0.7 + secondary * 0.3) ** 3;
      const brightness = 0.77 + broad * 0.13 + mottling * 0.07 + crest * 0.19;
      return [brightness * 0.94, brightness, brightness * (1 + crest * 0.07), 0.54 + wave * 0.19 + secondary * 0.07];
    }
  }
}

function texture(bytes: Uint8Array, isColor: boolean) {
  const result = new DataTexture(bytes, size, size, RGBAFormat);
  result.wrapS = RepeatWrapping;
  result.wrapT = RepeatWrapping;
  result.generateMipmaps = true;
  result.minFilter = LinearMipmapLinearFilter;
  result.magFilter = LinearFilter;
  result.anisotropy = 4;
  if (isColor) result.colorSpace = SRGBColorSpace;
  result.needsUpdate = true;
  return result;
}

export function makeSurfaceMaterial(surface: Surface) {
  const color = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(color.length);
  const toByte = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = 4 * (x + y * size);
      const [r, g, b, height] = describeSurface(surface, x / size, y / size, hash(x, y));
      color.set([toByte(r), toByte(g), toByte(b), 255], offset);
      const level = toByte(height);
      relief.set([level, level, level, 255], offset);
    }
  }

  return { map: texture(color, true), bumpMap: texture(relief, false) };
}
