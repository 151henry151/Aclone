// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { snowTrackHeight } from './snow-surface';

/** Heights in the fountain model's local units (its root has a 0.6 scale).
 * Sample the rendered bare terrain triangles, including rotated town centres.
 * Snow must never lift furniture as the seasons change. */
export function townCentreGround(w: World, b: Building) {
  const surface = snowTrackHeight({ ...w, climate: undefined });
  const base = b.foundationY ?? terrainHeight(w, b.x, b.z);
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const ground = (x: number, z: number) =>
    (surface(b.x + 0.6 * (x * c + z * s), b.z + 0.6 * (z * c - x * s)) - base) / 0.6;
  const rim = Array.from({ length: 48 }, (_, i) =>
    ground(5 * Math.cos((i * Math.PI) / 24), 5 * Math.sin((i * Math.PI) / 24)),
  );
  return {
    fountain: { low: Math.min(...rim), high: Math.max(...rim, ground(0, 0)) + 0.03 },
    benches: [-7, 7].map((x) => {
      const feet = [-1.05, 1.05].flatMap((dx) =>
        [-0.32, 0.32].map((z) => ({ x: x + dx, z, ground: ground(x + dx, z) })),
      );
      return { x, feet, seat: Math.max(...feet.map((f) => f.ground)) + 0.85 };
    }),
  };
}
