// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Player, World } from './types';
import { TUGBOAT, poweredBoat } from './boats';
import { vehicleDef } from './vehicle-config';
import { boatLanding } from './boathouse';
import { boatShoreCollision } from './boat-shore';
import { buildingBlocksMovement } from './building-shapes';
import { creatorBlocksSegment } from './creator';
import { waterLevel } from './ocean';
import { terrainHeight } from './terrain';
import { log, say } from './simulation';
export interface TowJob {
  owner: string;
  tug: string;
  slot: number;
  fee: number;
  state: 'offered' | 'accepted' | 'towing';
  created: number;
  rescue: boolean;
  rope?: number;
}
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
export function strandedVessel(w: World, owner: string) {
  const p = w.players[owner],
    r = w.boatRescues?.[owner];
  if (!p) return undefined;
  if (r && !r.landing) {
    const fuel = p.fuelVehicle === r.boat.slot ? p.fuel : (p.parkedFuel?.[r.boat.slot] ?? 0);
    if (fuel > 0) return undefined;
    return { point: r.boat, slot: r.boat.slot, rescue: true };
  }
  if (
    !r &&
    poweredBoat(p.vehicle, w) &&
    !p.hitch &&
    !p.atHome &&
    p.fuel <= 0 &&
    Math.abs(p.speed) < 0.5
  )
    return { point: p, slot: p.vehicle, rescue: false };
}
export function towTarget(w: World, j: TowJob) {
  if (j.rescue) {
    const r = w.boatRescues?.[j.owner];
    return r?.boat.slot === j.slot ? r.boat : undefined;
  }
  const p = w.players[j.owner];
  return p?.vehicle === j.slot && !p.hitch && !p.atHome ? p : undefined;
}
export function activeTow(w: World, tug: string) {
  return Object.values(w.towJobs ?? {}).find((j) => j.tug === tug && j.state === 'towing');
}
export function beingTowed(w: World, p: Player) {
  const j = w.towJobs?.[p.id];
  return !!j && j.state === 'towing' && !j.rescue;
}
export function cancelTow(w: World, owner: string) {
  const j = w.towJobs?.[owner];
  if (!j) return;
  delete w.towJobs![owner]; // Remove first: retries cannot pay or refund twice.
  if (j.state !== 'offered' && w.players[owner]) w.players[owner].cash += j.fee;
  const tug = w.players[j.tug];
  if (tug) {
    tug.boatThrottle = 0;
    tug.speed = 0;
  }
  const target = w.players[owner];
  if (target && !j.rescue) {
    target.speed = 0;
    target.boatThrottle = 0;
  }
}
export function cancelPlayerTows(w: World, id: string) {
  for (const j of Object.values(w.towJobs ?? {}))
    if (j.owner === id || j.tug === id) cancelTow(w, j.owner);
}
export function maintainTows(w: World) {
  for (const j of Object.values(w.towJobs ?? {})) {
    const tug = w.players[j.tug],
      target = towTarget(w, j);
    if (
      !tug ||
      !target ||
      (j.state === 'towing' &&
        (tug.vehicle !== TUGBOAT ||
          tug.atHome ||
          tug.hitch ||
          Math.hypot(tug.x - target.x, tug.z - target.z) > (j.rope ?? 0) + 50)) ||
      (j.state === 'offered' && w.time - j.created > 600)
    )
      cancelTow(w, j.owner);
  }
}
export function towAction(w: World, p: Player, a: Action) {
  const owner = String(a.owner ?? p.id);
  let j = w.towJobs?.[owner];
  if (a.operation === 'offer' || a.operation === 'self') {
    need((p.fleet ?? []).includes(TUGBOAT), 'Buy a tugboat at the boatyard first');
    need(a.operation !== 'self' || owner === p.id, 'Self-recovery is only for your boat');
    const vessel = strandedVessel(w, owner);
    need(vessel, 'That captain has no stranded out-of-fuel vessel');
    need(
      !(owner === p.id && (!vessel!.rescue || vessel!.slot === TUGBOAT)),
      'Use a different tug and captain to recover this tugboat',
    );
    need(
      !j && !Object.values(w.towJobs ?? {}).some((t) => t.tug === p.id),
      'Finish or cancel the existing towing agreement first',
    );
    const fee = owner === p.id ? 0 : Number(a.fee);
    need(Number.isSafeInteger(fee) && fee >= 0 && fee <= 10000000, 'Choose a valid rescue fee');
    w.towJobs ??= {};
    w.towJobs[owner] = {
      owner,
      tug: p.id,
      slot: vessel!.slot,
      rescue: vessel!.rescue,
      fee,
      state: owner === p.id ? 'accepted' : 'offered',
      created: w.time,
    };
    say(
      w,
      'Tow service',
      `${p.name} offers to tow your stranded vessel for ${(fee / 100).toFixed(2)}d. Accept in Activities → Boat rescue & towing. Payment is held until delivery.`,
      'system',
      owner,
    );
    return owner === p.id
      ? 'Self-recovery planned; sail alongside in your tugboat.'
      : 'Rescue offer sent; the captain must accept.';
  }
  need(j && (j.owner === p.id || j.tug === p.id), 'No towing agreement belongs to you');
  j = j!;
  if (a.operation === 'cancel') {
    cancelTow(w, owner);
    return 'Tow cancelled; any held fee is refunded.';
  }
  if (a.operation === 'accept') {
    need(
      p.id === owner && j.state === 'offered',
      'Only the stranded captain can accept this offer',
    );
    const target = strandedVessel(w, owner);
    need(
      target && target.rescue === j.rescue && target.slot === j.slot,
      'The stranded vessel has changed; request a new offer',
    );
    need(p.cash >= j.fee, 'Not enough cash for the agreed rescue fee');
    p.cash -= j.fee;
    j.state = 'accepted';
    return 'Fee held securely until your boat reaches a dock. You can cancel for a refund.';
  }
  need(
    p.id === j.tug && p.vehicle === TUGBOAT && !p.hitch && !p.atHome,
    'Operate your tugboat to handle the tow',
  );
  const target = towTarget(w, j);
  need(target, 'The vessel is no longer available');
  if (a.operation === 'hook') {
    const stranded = strandedVessel(w, owner);
    need(
      stranded && stranded.slot === j.slot && stranded.rescue === j.rescue,
      'The vessel is no longer stranded',
    );
    need(!activeTow(w, owner), 'A tug already towing another vessel cannot itself be towed');
    need(
      j.state === 'accepted' && Math.abs(p.speed) < 0.5,
      'Stop beside the vessel after agreeing the rescue',
    );
    const distance = Math.hypot(target!.x - p.x, target!.z - p.z);
    const minimum = (vehicleDef(w, TUGBOAT).length! + (vehicleDef(w, j.slot).length ?? 14)) / 2 + 2;
    need(
      distance >= minimum && distance <= minimum + 25,
      'Position the tug a hull length ahead, within towline reach',
    );
    need(
      !towBlocked(w, j, target!, p, target!.heading),
      'The towline needs clear water between the vessels',
    );
    j.rope = distance;
    j.state = 'towing';
    p.boatThrottle = 0;
    const captain = w.players[owner];
    if (captain.trawl) captain.trawl.deployed = false;
    if (!j.rescue) {
      captain.engine = false;
      captain.boatThrottle = 0;
      captain.speed = 0;
    }
    return 'Towline secured. Proceed slowly; bring the disabled vessel into a dock approach.';
  }
  need(a.operation === 'deliver' && j.state === 'towing', 'Unknown tow action');
  need(Math.abs(p.speed) < 0.5, 'Stop before handing over the tow');
  need(
    Math.hypot(p.x - target!.x, p.z - target!.z) <= (j.rope ?? 0) + 2,
    'Bring the tug and vessel together before delivery',
  );
  const dock = boatLanding(w, target!, true);
  need(dock, 'The towed boat must reach a boatyard or fishing pier approach');
  if (j.rescue) w.boatRescues![owner].landing = dock!.id;
  else {
    const captain = w.players[owner];
    captain.speed = 0;
    captain.engine = false;
    captain.boatThrottle = 0;
  }
  delete w.towJobs![owner];
  p.cash += j.fee;
  if (j.fee) log(w, 'transfer', j.fee, owner, p.id, 'completed boat tow');
  say(
    w,
    'Tow service',
    'Your boat has arrived at the dock. Its cargo and fuel remain aboard. The agreed rescue fee has been paid.',
    'system',
    owner,
  );
  return 'Tow delivered; fee paid. The boat is ready for its owner.';
}
function towBlocked(
  w: World,
  j: TowJob,
  from: { x: number; z: number },
  to: { x: number; z: number },
  heading: number,
) {
  const v = vehicleDef(w, j.slot),
    radius = v.beam ? v.beam / 2 : (v.collisionRadius ?? 2);
  return (
    !!boatShoreCollision(w, from, to, radius, heading, (v.length ?? 14) / 2) ||
    creatorBlocksSegment(
      w,
      { ...from, y: waterLevel(w) },
      { ...to, y: waterLevel(w) },
      radius,
      true,
    ) ||
    w.buildings.some((b) =>
      buildingBlocksMovement(b, from, to, waterLevel(w) - terrainHeight(w, b.x, b.z), radius),
    )
  );
}
/** Distance-constrained tow; sweep the complete hull and rollback the tug if a corner is blocked. */
export function moveTow(
  w: World,
  p: Player,
  before: { x: number; z: number; heading: number },
  prediction = false,
) {
  const j = activeTow(w, p.id);
  if (!j) return;
  const target = towTarget(w, j);
  if (!target) return;
  const dx = p.x - target.x,
    dz = p.z - target.z,
    distance = Math.hypot(dx, dz),
    rope = j.rope!;
  const clearance =
    ((vehicleDef(w, TUGBOAT).length ?? 16.8) + (vehicleDef(w, j.slot).length ?? 14)) / 2 + 1;
  if (distance < clearance) {
    Object.assign(p, before);
    p.speed = 0;
    p.boatThrottle = 0;
    return;
  }
  if (distance <= rope) return;
  const next = { x: p.x - (dx * rope) / distance, z: p.z - (dz * rope) / distance },
    heading = Math.atan2(dx, dz);
  if (towBlocked(w, j, target, next, heading)) {
    Object.assign(p, before);
    p.speed = 0;
    p.boatThrottle = 0;
    return;
  }
  if (!prediction) {
    Object.assign(target, next, { heading });
    if (!j.rescue) {
      const owner = w.players[j.owner];
      owner.y = waterLevel(w);
      owner.speed = 0;
    }
  }
}
