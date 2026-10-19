// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
const textures = new Map<string, T.DataTexture>();
/** Small shared painted sign/clock maps. Symbols, ticks and lettering-like strokes cost no meshes. */
export function buildingBadge(kind: string) {
  const cached = textures.get(kind);
  if (cached) return cached;
  const size = 128,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x - 64) / 64,
        v = (y - 64) / 64,
        r = Math.hypot(u, v);
      let ink = false;
      if (kind === 'clock') {
        ink =
          (r > 0.83 && r < 0.91) ||
          (r > 0.7 && r < 0.8 && Math.abs(Math.sin(Math.atan2(v, u) * 6)) < 0.14) ||
          (Math.abs(u) < 0.025 && v > -0.54 && v < 0.06) ||
          (Math.abs(v - u * 0.55) < 0.028 && u >= 0 && u < 0.44);
      } else if (kind === 'beer')
        ink =
          (Math.abs(u + 0.15) < 0.34 && v > -0.25 && v < 0.57) ||
          (Math.abs(v + 0.35) < 0.1 && Math.abs(u + 0.15) < 0.4) ||
          (Math.abs(Math.hypot((u - 0.3) * 1.8, v - 0.1) - 0.5) < 0.09 && u > 0.15);
      else if (kind === 'bread')
        ink =
          Math.pow(u / 0.72, 2) + Math.pow(v / 0.36, 2) < 1 &&
          !(Math.abs(Math.sin((u + v * 0.4) * 9)) < 0.2 && v < 0.05);
      else if (kind === 'tea' || kind === 'coffee')
        ink =
          (Math.abs(u) < 0.45 && v > -0.05 && v < 0.45) ||
          (Math.abs(v - 0.58) < 0.035 && Math.abs(u) < 0.65) ||
          (Math.abs(u - Math.sin(v * 10) * 0.06) < 0.035 && v < -0.2 && v > -0.65);
      else if (kind === 'bed')
        ink =
          (Math.abs(v - 0.16) < 0.18 && Math.abs(u) < 0.65) ||
          (Math.abs(Math.abs(u) - 0.65) < 0.06 && v > -0.18 && v < 0.6) ||
          (Math.abs(u + 0.4) < 0.15 && v > -0.12 && v < 0.05);
      else if (kind === 'tools')
        ink = (Math.abs(u - v) < 0.12 && r < 0.75) || (Math.abs(u + v) < 0.12 && r < 0.75);
      else if (kind === 'coin')
        ink =
          Math.abs(r - 0.65) < 0.07 ||
          (Math.abs(u) < 0.035 && Math.abs(v) < 0.5) ||
          (Math.abs(v) < 0.3 && Math.abs(Math.cos(v * 8) * 0.3 - u) < 0.07);
      else if (kind === 'water')
        ink =
          Math.abs(v - Math.sin(u * 9) * 0.1) < 0.05 ||
          Math.abs(v - 0.35 - Math.sin(u * 9) * 0.1) < 0.05;
      else
        ink =
          (Math.abs(v + 0.45) < 0.05 && Math.abs(u) < 0.65) ||
          (Math.abs(v - 0.5) < 0.05 && Math.abs(u) < 0.65) ||
          (Math.abs(u) < 0.5 && Math.abs(v) < 0.4 && Math.abs(Math.sin(u * 12)) < 0.3);
      const light = kind === 'clock';
      const c = ink
        ? light
          ? [38, 48, 45]
          : [232, 206, 136]
        : light
          ? [229, 223, 193]
          : [42, 70, 62];
      const i = (y * size + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, size, size);
  texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  texture.userData.shared = true;
  textures.set(kind, texture);
  return texture;
}
