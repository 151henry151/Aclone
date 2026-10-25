// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { roadSurfaceDistance, townRoads } from '../shared/town';
import { terrainHeight, mapHalf, legacyHalf } from '../shared/terrain';
import { snowDepth } from '../shared/environment';

const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
/** World-space drifts agree across tile seams. Roads and submerged ground stay bare.
 * Small, broad variations preserve the reported average depth rather than inventing
 * waist-high banks from a few centimetres of snow. */
export function snowProfile(w: World) {
  const roads = townRoads(w);
  return (x: number, z: number, y = terrainHeight(w, x, z)) =>
    smooth(roadSurfaceDistance(w, roads, x, z) / 3) *
    smooth((y - w.settings.seaLevel) / 0.5) *
    (1 + 0.12 * Math.sin(x * 0.38 + Math.sin(z * 0.13)) * Math.cos(z * 0.31));
}
/** One static attribute per existing terrain vertex, no extra meshes or draw calls.
 * Snow depth changes on the GPU; nothing is rebuilt as it falls or melts. */
export function prepareSnowSurface(geometry: T.BufferGeometry, w: World, cx = 0, cz = 0) {
  const p = geometry.getAttribute('position');
  const data = new Float32Array(p.count * 3);
  const profile = snowProfile(w);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx,
      z = p.getZ(i) + cz;
    data[i * 3] = (profile(x + 0.75, z) - profile(x - 0.75, z)) / 1.5;
    data[i * 3 + 1] = profile(x, z, p.getY(i));
    data[i * 3 + 2] = (profile(x, z + 0.75) - profile(x, z - 0.75)) / 1.5;
  }
  geometry.setAttribute('snowLift', new T.BufferAttribute(data, 3));
}
/** The terrain grid shared by snow displacement and conforming detail meshes. */
export function snowSurfaceGrid(w: World) {
  const streamed = mapHalf(w) > legacyHalf + 50;
  return { step: streamed ? 4 : 540 / 128, origin: streamed ? 0 : -270 };
}
/** Match the actual triangles, not an ideal curved drift, so prints cannot sink
 * into the snow between terrain vertices. Cache samples for one sync pass. */
export function snowTrackHeight(w: World) {
  const profile = snowProfile(w),
    depth = snowDepth(w.climate),
    { step, origin } = snowSurfaceGrid(w),
    cache = new Map<string, number>();
  const sample = (i: number, j: number) => {
    const key = `${i}:${j}`;
    let value = cache.get(key);
    if (value === undefined) {
      const x = origin + i * step,
        z = origin + j * step;
      const y = terrainHeight(w, x, z);
      value = y + depth * profile(x, z, y);
      cache.set(key, value);
    }
    return value;
  };
  return (x: number, z: number) => {
    const gx = (x - origin) / step,
      gz = (z - origin) / step;
    const i = Math.floor(gx),
      j = Math.floor(gz),
      u = gx - i,
      v = gz - j;
    const b = sample(i, j + 1),
      d = sample(i + 1, j);
    return u + v <= 1
      ? sample(i, j) * (1 - u - v) + d * u + b * v
      : sample(i + 1, j + 1) * (u + v - 1) + b * (1 - u) + d * (1 - v);
  };
}

/** Keep the cheap tractor contact shade above the snow in Performance mode too. */
export function liftSnowShadow(group: T.Object3D, lift: number) {
  const shade = group.userData.snowShadow as T.Object3D | undefined;
  if (!shade) return;
  shade.userData.bareHeight ??= shade.position.y;
  shade.position.y = shade.userData.bareHeight + Math.max(0, lift);
}
