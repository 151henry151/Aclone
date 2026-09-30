// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
let cached: T.DataTexture | undefined;
/** Repeatable value noise, evaluated once on the CPU instead of per-pixel trig. */
export function noiseTexture() {
  if (cached) return cached;
  const size = 128,
    data = new Uint8Array(size * size * 4);
  let seed = 7145;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = seed >>> 24;
    data.set([v, v, v, 255], i * 4);
  }
  cached = new T.DataTexture(data, size, size, T.RGBAFormat);
  cached.wrapS = cached.wrapT = T.RepeatWrapping;
  cached.magFilter = T.LinearFilter;
  cached.minFilter = T.LinearFilter;
  cached.userData.shared = true;
  cached.needsUpdate = true;
  return cached;
}
