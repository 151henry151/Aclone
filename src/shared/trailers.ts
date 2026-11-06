import { cargoAccepts } from './cargo-policy';
import { transferStock, type StockLife } from './stock-life';
import { vehicleRunningRules } from './vehicle-running-rules';
import { z } from 'zod';
import { cliffBlocks } from './coastal-bluffs';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action, Stock } from './types';
import { isTractor } from './tractors';
import { vehicleDef } from './vehicle-config';
import { worldItems } from './world-catalogue';
import { terrainHeight, mapHalf } from './terrain';
import { highWater } from './ocean';
import { creatorBlocksSegment } from './creator';
import { buildingBlocksMovement } from './building-shapes';
import { landscapeBlocks } from './landscape';
import { stockWeight } from './fishing-expedition';
import { requireHerdRoom, canCarry } from './simulation';
import { log } from './simulation';
import { trailerDefs, type TrailerKind } from './trailer-definitions';
export { trailerDefs, type TrailerKind } from './trailer-definitions';
export const fuelTrailerTuningSchema = z
  .object({
    price: z.number().int().min(0).max(100000000).optional(),
    capacity: z.number().int().min(1).max(100000).optional(),
  })
  .strict();
export const trailerTuningSchema = z.object({ fuel: fuelTrailerTuningSchema.optional() }).strict();
export type TrailerTuning = z.infer<typeof trailerTuningSchema>;
export function trailerDef(w: Pick<World, 'trailerTuning'>, kind: TrailerKind) {
  return { ...trailerDefs[kind], ...(kind === 'fuel' ? w.trailerTuning?.fuel : {}) };
}
export function tuneTrailer(w: World, input: unknown) {
  const tuning = fuelTrailerTuningSchema.parse(input),
    next = {
      ...w.trailerTuning?.fuel,
      ...Object.fromEntries(Object.entries(tuning).filter(([, value]) => value !== undefined)),
    },
    capacity = next.capacity ?? trailerDefs.fuel.capacity;
  need(
    Object.values(w.trailers ?? {}).every(
      (t) => t.kind !== 'fuel' || stockWeight(w, t.cargo) <= capacity,
    ),
    'Unload fuel tankers before reducing their capacity',
  );
  w.trailerTuning = { ...w.trailerTuning, fuel: next };
}
export interface Trailer {
  id: string;
  owner: string;
  kind: TrailerKind;
  x: number;
  z: number;
  heading: number;
  cargo: Stock;
  life?: StockLife;
  attached?: string;
  /** Vehicle key while its driver is walking or signed off; the hitch stays connected. */
  parkedWith?: string;
  /** Whole internal currency units per Fuel. Zero or absent closes public sales. */
  sellPrice?: number;
  /** Snapshot-only service facts; never trusted by authoritative transactions. */
  fuelService?: { ownerName: string; ownerOnline: boolean; stopped: boolean };
}
export const attachedTrailer = (w: World, p: Pick<Player, 'id'>) =>
  Object.values(w.trailers ?? {}).find((t) => t.attached === p.id && !t.parkedWith);
export const trailerHandlingReach = (w: World, t: Trailer) => trailerDef(w, t.kind).length / 2 + 9;
/** A parked hitch remains available to its owner beside a shop, but never follows the walker. */
export function tradingTrailer(w: World, p: Player, id?: string) {
  const active = attachedTrailer(w, p);
  if (active && (!id || active.id === id)) return active;
  return Object.values(w.trailers ?? {}).find((t) => {
    const parked = t.parkedWith && w.parkedVehicles?.[t.parkedWith];
    return (
      (!id || t.id === id) &&
      t.owner === p.id &&
      t.attached === p.id &&
      parked &&
      parked.owner === p.id &&
      !parked.inside &&
      Math.hypot(t.x - p.x, t.z - p.z) <= trailerHandlingReach(w, t)
    );
  });
}
function need(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
export function trailerAccepts(w: World, t: Trailer, item: string, n: number) {
  return cargoAccepts(w, t, trailerDef(w, t.kind).capacity, item, n);
}
export function trailerLoad(w: World, p: Player) {
  const t = attachedTrailer(w, p);
  return t ? stockWeight(w, p.trailerCargo?.[t.id] ?? t.cargo) / trailerDef(w, t.kind).capacity : 0;
}
export function trailerFactors(w: World, p: Player) {
  if (!attachedTrailer(w, p)) return { speed: 1, fuel: 1 };
  const rules = vehicleRunningRules(w.settings),
    load = trailerLoad(w, p);
  return {
    speed: 1 / (rules.trailerSpeedBase + load * rules.trailerLoadSpeedPenalty),
    fuel: rules.trailerFuelBase + load * rules.trailerLoadFuelPenalty,
  };
}
export function detachTrailer(w: World, p: Player, loseCargo = false) {
  const t = attachedTrailer(w, p);
  if (t) {
    delete t.attached;
    if (loseCargo) t.cargo = {};
  }
}
export function clearTrailer(w: World, t: Trailer, to: { x: number; z: number; heading: number }) {
  const d = trailerDefs[t.kind],
    radius = d.width / 2;
  const distance = Math.hypot(to.x - t.x, to.z - t.z),
    turn = Math.atan2(Math.sin(to.heading - t.heading), Math.cos(to.heading - t.heading));
  const steps = Math.max(
    1,
    Math.ceil(distance / 0.7),
    Math.ceil((Math.abs(turn) * d.length) / 0.7),
  );
  if (steps > 100) return false;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps,
      x = t.x + (to.x - t.x) * f,
      z = t.z + (to.z - t.z) * f,
      h = t.heading + turn * f;
    if (Math.abs(x) > mapHalf(w) - d.length || Math.abs(z) > mapHalf(w) - d.length) return false;
    for (
      let dz = -d.length / 2;
      dz <= d.length / 2 + 0.001;
      dz += d.length / Math.ceil(d.length / radius)
    ) {
      const q = { x: x + Math.sin(h) * dz, z: z + Math.cos(h) * dz };
      if (
        [-radius, 0, radius].some(
          (side) =>
            terrainHeight(w, q.x + Math.cos(h) * side, q.z - Math.sin(h) * side) <=
            highWater(w) + 0.1,
        )
      )
        return false;
      if (w.buildings.some((b) => buildingBlocksMovement(b, q, q, 0, radius))) return false;
      if (
        creatorBlocksSegment(
          w,
          { ...q, y: terrainHeight(w, q.x, q.z) },
          { ...q, y: terrainHeight(w, q.x, q.z) },
          radius,
          true,
        )
      )
        return false;
      if (trailerBlocks(w, q, q, radius, t.id)) return false;
    }
    const y = terrainHeight(w, x, z);
    if (cliffBlocks(w, t, { x, z }, radius)) return false;
    if (landscapeBlocks(w, { x: t.x, z: t.z, y }, { x, z, y }, radius, false)) return false;
    if (Math.abs(y - terrainHeight(w, t.x, t.z)) > Math.max(0.5, distance * 0.85)) return false;
  }
  return true;
}
export function trailerAction(w: World, p: Player, a: Action) {
  need(
    !p.atHome && !p.hitch && !p.task && !p.game && Math.abs(p.speed) < 0.5,
    'Stop outside before handling a trailer',
  );
  const t = w.trailers?.[String(a.id)];
  if (a.operation === 'buy') {
    const kind = String(a.kind) as TrailerKind;
    need(Object.hasOwn(trailerDefs, kind), 'Unknown trailer');
    const def = trailerDef(w, kind);
    const garage = w.buildings.find((b) => b.id === a.building);
    need(
      garage &&
        garage.kind === 'garage' &&
        !garage.aircraftHangar &&
        !garage.construction &&
        Math.hypot(p.x - garage.x, p.z - garage.z) <= 18,
      'Visit the tractor garage',
    );
    need(isTractor(p.vehicle), 'Bring a tractor to collect your trailer');
    need(!attachedTrailer(w, p), 'Unhitch your existing trailer first');
    need(p.cash >= def.price, 'Not enough cash');
    need(
      Object.values(w.trailers ?? {}).filter((t) => t.owner === p.id).length < 21,
      'Store or use your existing trailers',
    );
    const separation = def.length / 2 + 4.1;
    const candidate: Trailer = {
      id: '',
      owner: p.id,
      kind,
      x: p.x - Math.sin(p.heading) * separation,
      z: p.z - Math.cos(p.heading) * separation,
      heading: p.heading,
      cargo: {},
      attached: p.id,
    };
    need(
      clearTrailer(w, candidate, candidate),
      'Park with clear dry space behind your tractor to collect the trailer',
    );
    w.trailerSeq = (w.trailerSeq ?? 0) + 1;
    candidate.id = 'trailer-' + w.trailerSeq;
    w.trailers ??= {};
    w.trailers[candidate.id] = candidate;
    p.cash -= def.price;
    log(w, 'sink', def.price, p.id, 'treasury', 'trailer purchase');
    return 'Trailer purchased and hitched. Load it through Trailer cargo.';
  }
  need(t && t.owner === p.id, 'Choose your own trailer');
  need(
    Math.hypot(t.x - p.x, t.z - p.z) <= trailerHandlingReach(w, t),
    'Move alongside your trailer',
  );
  if (a.operation === 'unhitch') {
    need(t.attached === p.id, 'This trailer is not hitched');
    delete t.attached;
    delete t.parkedWith;
    return 'Trailer parked here with its cargo.';
  }
  if (a.operation === 'hitch') {
    need(!t.attached, 'Unhitch this trailer from its current tractor first');
    need(isTractor(p.vehicle) && !attachedTrailer(w, p), 'Bring a tractor with a free hitch');
    const rear = { x: p.x - Math.sin(p.heading) * 2.7, z: p.z - Math.cos(p.heading) * 2.7 };
    const nose = {
      x: t.x + Math.sin(t.heading) * (trailerDefs[t.kind].length / 2 + 1.4),
      z: t.z + Math.cos(t.heading) * (trailerDefs[t.kind].length / 2 + 1.4),
    };
    need(
      Math.hypot(rear.x - nose.x, rear.z - nose.z) < 2,
      'Reverse the tractor hitch to the trailer drawbar',
    );
    need(Math.cos(p.heading - t.heading) > 0.7, 'Align your tractor with the trailer');
    t.attached = p.id;
    return 'Trailer hitched.';
  }
  need(a.operation === 'load' || a.operation === 'unload', 'Unknown trailer action');
  const item = String(a.item),
    n = Number(a.quantity),
    defs = worldItems(w);
  need(defs[item] && Number.isSafeInteger(n) && n > 0, 'Choose a positive whole quantity');
  const b = a.building ? w.buildings.find((b) => b.id === a.building) : undefined;
  if (a.building)
    need(
      b &&
        b.owner === p.id &&
        !b.construction &&
        Math.hypot(p.x - b.x, p.z - b.z) <= 18 &&
        Math.hypot(t.x - b.x, t.z - b.z) <= 25,
      'Pull alongside a building you own',
    );
  const source = a.operation === 'load' ? (b ? b.stock : p.inventory) : t.cargo;
  const dest = a.operation === 'load' ? t.cargo : b ? b.stock : p.inventory;
  need((source[item] ?? 0) >= n, 'Not enough goods');
  if (a.operation === 'load')
    need(trailerAccepts(w, t, item, n), 'This load exceeds the trailer capacity or is unsuitable');
  else if (b) {
    need((b.stock[item] ?? 0) + n <= b.capacity, 'Building storage is full');
    requireHerdRoom(w, b, item, n);
  } else need(canCarry(p, item, n, w), 'Vehicle inventory is full');
  transferStock(w, source, dest, item, n);
  if (!source[item]) delete source[item];
  return 'Cargo transferred.';
}
/** Articulated single drawbar. Reversing is signed, so the trailer can jackknife. */
export function moveTrailer(
  w: World,
  p: Player,
  before: { x: number; z: number; heading: number },
  dt: number,
  prediction = false,
) {
  const attached = attachedTrailer(w, p);
  if (!attached) return;
  const scratch = p as Player & { predictedTrailer?: Trailer };
  const t = prediction
    ? (scratch.predictedTrailer ??= {
        ...attached,
        cargo: { ...(p.trailerCargo?.[attached.id] ?? attached.cargo) },
      })
    : attached;
  const d = trailerDefs[t.kind],
    drawbar = d.length / 2 + 1.4;
  const oldH = {
    x: before.x - Math.sin(before.heading) * 2.7,
    z: before.z - Math.cos(before.heading) * 2.7,
  };
  const hitch = { x: p.x - Math.sin(p.heading) * 2.7, z: p.z - Math.cos(p.heading) * 2.7 };
  const dhx = hitch.x - oldH.x,
    dhz = hitch.z - oldH.z;
  const heading = t.heading + (dhx * Math.cos(t.heading) - dhz * Math.sin(t.heading)) / drawbar;
  const next = {
    x: hitch.x - Math.sin(heading) * drawbar,
    z: hitch.z - Math.cos(heading) * drawbar,
    heading,
  };
  if (Math.cos(heading - p.heading) < 0.25 || !clearTrailer(w, t, next)) {
    Object.assign(p, before);
    p.speed = 0;
    return;
  }
  Object.assign(t, next);
}

export function trailerBlocks(
  w: World,
  from: { x: number; z: number },
  to: { x: number; z: number },
  radius: number,
  except?: string,
) {
  return Object.values(w.trailers ?? {}).some((t) => {
    if (t.id === except || (t.parkedWith && w.parkedVehicles?.[t.parkedWith]?.inside)) return false;
    const d = trailerDefs[t.kind],
      n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.5));
    for (let i = 0; i <= n; i++) {
      const x = from.x + ((to.x - from.x) * i) / n - t.x,
        z = from.z + ((to.z - from.z) * i) / n - t.z;
      const lx = x * Math.cos(t.heading) - z * Math.sin(t.heading),
        lz = x * Math.sin(t.heading) + z * Math.cos(t.heading);
      if (Math.abs(lx) < d.width / 2 + radius && Math.abs(lz) < d.length / 2 + radius) return true;
    }
    return false;
  });
}
