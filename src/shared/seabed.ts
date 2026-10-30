// SPDX-License-Identifier: GPL-3.0-or-later
import { fbm, smoothstep } from './noise';

/** Procedural bathymetry below the existing coast. No alteration above eight
 * metres below datum, so beaches, low-tide rocks and harbour berths stay put.
 * Caller preserves custom heightmaps and blends out around the original village. */
export function seabedHeight(
  height: number,
  sea: number,
  x: number,
  z: number,
  half: number,
  seed: number,
) {
  if (half <= 250 || height >= sea - 8) return height;
  const scale = Math.min(1, (half - 250) / 4000);
  const mouth = half * 0.8;
  const bay =
    (1 - smoothstep(mouth * 0.85, mouth * 1.13, z)) *
    smoothstep(100, 400, z) *
    (1 - smoothstep(0.85, 1.12, Math.abs(x) / (250 + Math.max(0, z - 150) * 0.5)));
  const offshore = smoothstep(half * 0.78, half * 1.28, Math.hypot(x, z));
  const relief = fbm(x / 750, z / 750, 3, seed + 227);
  const bayDepth = 24 + 42 * smoothstep(250, mouth, z) + 12 * relief;
  const trenchAxis = half * 1.08 + 350 * Math.sin(x / 1600 + (seed % 7));
  const trench = Math.exp(-(((z - trenchAxis) / 320) ** 2)) * 850 * offshore;
  const oceanDepth = 90 + 950 * offshore + 130 * relief * offshore + trench;
  const target = sea - Math.max(12, (bayDepth * bay + oceanDepth * (1 - bay)) * scale);
  const blend = smoothstep(8, 26, sea - height);
  return height + (Math.min(height, target) - height) * blend;
}
/** A small catch-rate influence: weather, shoals and voyage luck still dominate. */
export function depthFishingMultiplier(depth: number) {
  return 0.96 + 0.08 * smoothstep(20, 700, depth);
}
