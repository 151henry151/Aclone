// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { terrainHeight } from './terrain';
import { waterLevel } from './ocean';

type Point = { x: number; z: number };

/** Sweep the collision footprint, including the space between simulation ticks.
 * Use tidal sea level, not wave crests: a wave must not let a boat climb the beach.
 */
export function boatShoreCollision(
  w: World,
  from: Point,
  to: Point,
  radius: number,
  heading = 0,
  halfLength = radius,
) {
  const sea = waterLevel(w);
  const sin = Math.sin(heading),
    cos = Math.cos(heading);
  // Taper at bow/stern, with shoulders to cover a long hull approaching diagonally.
  const footprint = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, halfLength],
    [0, -halfLength],
    [radius * 0.7, halfLength * 0.7],
    [-radius * 0.7, halfLength * 0.7],
    [radius * 0.7, -halfLength * 0.7],
    [-radius * 0.7, -halfLength * 0.7],
  ].map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
  const wet = (p: Point) =>
    footprint.every(([x, z]) => terrainHeight(w, p.x + x, p.z + z) < sea - 0.05);
  const penetration = (p: Point) =>
    footprint.map(([x, z]) => Math.max(0, terrainHeight(w, p.x + x, p.z + z) - sea + 0.05));
  const dx = to.x - from.x,
    dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-8) return undefined;
  const steps = Math.max(1, Math.ceil(distance / 0.5));
  let safe = { ...from };
  for (let i = 1; i <= steps; i++) {
    const next = { x: from.x + (dx * i) / steps, z: from.z + (dz * i) / steps };
    if (!wet(next)) {
      // Tides, hull changes or a turn can leave a saved pose partly on shore.
      // Permit a continuous retreat only while every grounded hull sample gets
      // no deeper into land and at least one improves. Never admit new contacts
      // or skip a dry ridge merely because the destination is water.
      const before = penetration(safe),
        after = penetration(next);
      if (
        after.every((depth, index) => depth <= before[index]) &&
        after.some((depth, index) => depth < before[index])
      ) {
        safe = next;
        continue;
      }
      // A small recoil into water, never an unchecked step onto an opposite bank.
      for (let back = 0.2; back <= 1.01; back += 0.2) {
        const recoil = { x: safe.x - (dx / distance) * 0.2, z: safe.z - (dz / distance) * 0.2 };
        if (!wet(recoil)) break;
        safe = recoil;
      }
      return safe;
    }
    safe = next;
  }
  return undefined;
}
