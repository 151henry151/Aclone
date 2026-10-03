import { heightmapAt } from './landscape.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function terrainHeight(w: World, x: number, z: number) {
  const hills = Math.sin(x * 0.021) * Math.cos(z * 0.019) * 8 + Math.sin(x * 0.047 + z * 0.025) * 3;
  const plateau = w.townLayout === 2 ? 230 : 120;
  const flat = 1 - clamp((Math.max(Math.abs(x), Math.abs(z)) - plateau) / 80, 0, 1);
  let h = hills * (1 - flat) + 0.15;
  if (z > 140) h -= (z - 140) * 0.2;
  if (w.landscape?.heightmap) h = heightmapAt(w.landscape.heightmap, x, z);
  for (const t of w.terrain)
    h += t.height * Math.max(0, 1 - Math.hypot(x - t.x, z - t.z) / t.radius);
  return h;
}
