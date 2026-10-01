// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
let cached: T.DataTexture | undefined;
let values: Uint8Array | undefined;
/** Shared texels let CPU light attenuation sample the same clouds as the shader. */
export function noiseValues() {
  if (values) return values;
  values = new Uint8Array(128 * 128);
  let seed = 7145;
  for (let i = 0; i < values.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    values[i] = seed >>> 24;
  }
  return values;
}
/** Repeatable value noise, evaluated once on the CPU instead of per-pixel trig. */
export function noiseTexture() {
  if (cached) return cached;
  const size = 128,
    data = new Uint8Array(size * size * 4);
  const values = noiseValues();
  for (let i = 0; i < size * size; i++) {
    const v = values[i];
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
