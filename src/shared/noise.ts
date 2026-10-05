// SPDX-License-Identifier: GPL-3.0-or-later
/** Deterministic value noise shared by the server and every client, so terrain,
 * woodland and gathering grounds agree without storing kilometres of samples. */
export function hash2(ix: number, iz: number, seed: number) {
  let h = (Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ (seed | 0)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in -1..1 with unit cell size. */
export function valueNoise(x: number, z: number, seed = 0) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    fx = x - ix,
    fz = z - iz,
    u = fx * fx * (3 - 2 * fx),
    v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed),
    b = hash2(ix + 1, iz, seed),
    c = hash2(ix, iz + 1, seed),
    d = hash2(ix + 1, iz + 1, seed);
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1;
}
/** Fractal sum normalized to -1..1; each octave doubles frequency and halves weight. */
export function fbm(x: number, z: number, octaves: number, seed = 0) {
  let sum = 0,
    amplitude = 1,
    total = 0,
    frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum +=
      valueNoise(x * frequency + i * 17.3, z * frequency - i * 11.7, seed + i * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
/** Stable per-world seed from its identifier. */
export function seedOf(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h | 0;
}
