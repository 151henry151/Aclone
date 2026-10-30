// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types';
import { MOTORBOAT, poweredBoat, mooringKey } from './boats';
import { vehicleDef } from './vehicle-config';
import { boatLanding } from './boathouse';
import { boatShoreCollision } from './boat-shore';
import { terrainHeight } from './terrain';
import { waterLevel } from './ocean';
import { buildingBlocksMovement } from './building-shapes';
import { creatorBlocksSegment } from './creator';
export const tenderOf = (w: World, p: Player) => w.mooredBoats?.[mooringKey(p.id, MOTORBOAT)];
export const towingTender = (w: World, p: Player) => {
  const t = tenderOf(w, p);
  return t?.towedBy === p.vehicle ? t : undefined;
};
function need(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
export function tenderAction(w: World, p: Player, operation: unknown) {
  const t = tenderOf(w, p);
  need(
    t &&
      poweredBoat(p.vehicle, w) &&
      p.vehicle !== MOTORBOAT &&
      !p.atHome &&
      !p.hitch &&
      Math.abs(p.speed) < 0.5,
    'Stop your larger boat beside your own motorboat',
  );
  if (operation === 'hook') {
    need(!t.towedBy && !t.landing, 'This motorboat is already secured');
    const distance = Math.hypot(t.x - p.x, t.z - p.z),
      clearance = (vehicleDef(w, p.vehicle).length ?? 14) / 2 + 4;
    need(
      distance >= clearance && distance <= clearance + 15,
      'Move a hull length ahead of your motorboat, within line reach',
    );
    need(!boatShoreCollision(w, t, p, 1, t.heading, 2.15), 'The tender line needs clear water');
    t.towedBy = p.vehicle;
    t.rope = distance;
    return 'Motorboat attached astern. Tow it into a dock approach to secure it.';
  }
  need(operation === 'dock' && t.towedBy === p.vehicle, 'Attach the tender first');
  const dock = boatLanding(w, t, true);
  need(
    dock && Math.hypot(t.x - p.x, t.z - p.z) <= (t.rope ?? 0) + 2,
    'Bring the motorboat into the dock approach',
  );
  if (dock.building) delete w.mooredBoats![mooringKey(p.id, MOTORBOAT)];
  else {
    Object.assign(t, dock.berth, { heading: dock.heading, landing: dock.id });
    delete t.towedBy;
    delete t.rope;
  }
  return dock.building
    ? 'Motorboat stored inside the boatyard.'
    : 'Motorboat secured at the fishing pier.';
}
export function moveTender(
  w: World,
  p: Player,
  before: { x: number; z: number; heading: number },
  prediction = false,
) {
  const t = towingTender(w, p);
  if (!t) return;
  const dx = p.x - t.x,
    dz = p.z - t.z,
    d = Math.hypot(dx, dz),
    clearance = (vehicleDef(w, p.vehicle).length ?? 14) / 2 + 3;
  if (d < clearance) {
    Object.assign(p, before);
    p.speed = 0;
    p.boatThrottle = 0;
    return;
  }
  if (d <= (t.rope ?? clearance + 3)) return;
  const rope = t.rope ?? clearance + 3,
    next = { x: p.x - (dx * rope) / d, z: p.z - (dz * rope) / d },
    heading = Math.atan2(dx, dz);
  if (
    boatShoreCollision(w, t, next, 0.9, heading, 2.15) ||
    w.buildings.some((b) =>
      buildingBlocksMovement(b, t, next, waterLevel(w) - terrainHeight(w, b.x, b.z), 0.9),
    ) ||
    creatorBlocksSegment(w, { ...t, y: waterLevel(w) }, { ...next, y: waterLevel(w) }, 0.9, true)
  ) {
    Object.assign(p, before);
    p.speed = 0;
    p.boatThrottle = 0;
    return;
  }
  if (!prediction) Object.assign(t, next, { heading });
}
