// SPDX-License-Identifier: GPL-3.0-or-later
import { ROWBOAT, rowboatRules } from './rowboat-rules';
import { rowedWater, clearRowedBank } from './canoe-shore';
import { vehicleDef } from './vehicle-config';
import { surfaceWaterLevel } from './ocean';
import { terrainHeight } from './terrain';
import type { World, Player } from './types';
import type { BoatLanding } from './boathouse';
export function rowboatWater(w: World, p: { x: number; z: number; heading: number }) {
  return rowedWater(
    w,
    p.x,
    p.z,
    p.heading,
    vehicleDef(w, ROWBOAT),
    rowboatRules(w.settings).rowboatMinDepth,
  );
}
export function rowboatBeach(
  w: World,
  p: Pick<Player, 'id' | 'x' | 'z' | 'heading' | 'speed' | 'vehicle'>,
): BoatLanding | undefined {
  if (p.vehicle !== ROWBOAT || Math.abs(p.speed) >= 0.5) return;
  const r = rowboatRules(w.settings),
    depth = surfaceWaterLevel(w, p.x, p.z) - terrainHeight(w, p.x, p.z);
  if (depth < r.rowboatMinDepth || depth > r.rowboatStepOutDepth || !rowboatWater(w, p)) return;
  for (let distance = 0.5; distance <= r.rowboatBankRange; distance += 0.5)
    for (let i = 0; i < 32; i++) {
      const a = p.heading + (i * Math.PI) / 16,
        land = { x: p.x + Math.sin(a) * distance, z: p.z + Math.cos(a) * distance };
      if (clearRowedBank(w, land, p, r.rowboatBankRise))
        return {
          id: `beach:${p.id}`,
          beached: true,
          land,
          berth: { x: p.x, z: p.z },
          heading: p.heading,
        };
    }
}
export function beachedLanding(
  w: World,
  b: NonNullable<World['mooredBoats']>[string],
): BoatLanding | undefined {
  const r = rowboatRules(w.settings);
  if (
    b.slot !== ROWBOAT ||
    !b.beached ||
    !rowboatWater(w, b) ||
    !clearRowedBank(w, b.beached, b, r.rowboatBankRise) ||
    Math.hypot(b.x - b.beached.x, b.z - b.beached.z) > r.rowboatBankRange
  )
    return;
  return {
    id: b.landing,
    beached: true,
    land: b.beached,
    berth: { x: b.x, z: b.z },
    heading: b.heading,
  };
}
