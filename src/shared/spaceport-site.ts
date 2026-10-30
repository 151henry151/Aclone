// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
export interface SpaceportSite {
  layout?: number;
  /** Pad centre, not the terminal doorway. */
  x: number;
  z: number;
  height: number;
  building: string;
  exclusion: number;
  fence: number;
  access?: { x: number; z: number }[];
}
export function spaceportReserved(
  w: Pick<World, 'spaceportSite'>,
  x: number,
  z: number,
  padding = 0,
) {
  const s = w.spaceportSite;
  return !!s && Math.hypot(x - s.x, z - s.z) < s.exclusion + padding;
}
/** Only the working apron is graded; broad smooth shoulders retain the surrounding hills. */
export function spaceportGround(s: SpaceportSite | undefined, x: number, z: number, h: number) {
  if (!s) return h;
  const t = Math.max(0, Math.min(1, (Math.hypot(x - s.x, z - s.z) - 180) / 160));
  const blend = t * t * (3 - 2 * t);
  return s.height * (1 - blend) + h * blend;
}
const cache = new WeakMap<SpaceportSite, ReturnType<typeof makeFence>>();
function makeFence(s: SpaceportSite) {
  const edges = [];
  // 16-metre gate on the town-facing southeast side. Coarse collision segments,
  // with denser terrain-following visual panels generated on the client.
  const gate = Math.PI / 4,
    halfGap = 8 / s.fence,
    n = 192;
  for (let i = 0; i < n; i++) {
    const a = gate + halfGap + ((Math.PI * 2 - 2 * halfGap) * i) / n;
    const b = gate + halfGap + ((Math.PI * 2 - 2 * halfGap) * (i + 1)) / n;
    edges.push({
      id: 'spaceport-security',
      kind: 'fence' as const,
      height: 2.8,
      width: 0.12,
      a: { x: s.x + Math.cos(a) * s.fence, z: s.z + Math.sin(a) * s.fence },
      b: { x: s.x + Math.cos(b) * s.fence, z: s.z + Math.sin(b) * s.fence },
    });
  }
  return edges;
}
export function spaceportFences(
  w: Pick<World, 'spaceportSite'>,
  from?: { x: number; z: number },
  to = from,
  padding = 0,
) {
  const s = w.spaceportSite;
  if (!s) return [];
  if (from && to) {
    const d = Math.hypot(from.x - s.x, from.z - s.z),
      reach = Math.hypot(to.x - from.x, to.z - from.z) + padding + 1;
    if (d + reach < s.fence || d - reach > s.fence) return [];
  }
  let edges = cache.get(s);
  if (!edges) {
    edges = makeFence(s);
    cache.set(s, edges);
  }
  return edges;
}
