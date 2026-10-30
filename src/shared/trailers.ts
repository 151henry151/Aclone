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
export const trailerDefs = {
  hay: {
    name: 'Harvest hay wagon',
    length: 6.6,
    width: 2.5,
    capacity: 600,
    price: 450000,
    color: '#ac6935',
    axles: 2,
    description: 'Open bale platform. Hay fills the rack; other dry goods use at most 60 weight.',
  },
  livestock: {
    name: 'Meadow livestock wagon',
    length: 7.2,
    width: 2.5,
    capacity: 240,
    price: 360000,
    color: '#738975',
    axles: 2,
    description: 'Ventilated stock box: up to 6 cattle or equivalent smaller animals.',
  },
  dump: {
    name: 'Quarry tipping trailer',
    length: 4.6,
    width: 2.45,
    capacity: 1000,
    price: 420000,
    color: '#c78a29',
    axles: 2,
    description: 'Deep steel body for stone, gravel, sand, ore and topsoil.',
  },
  logs: {
    name: 'Forester log wagon',
    length: 5.2,
    width: 2.45,
    capacity: 900,
    price: 600000,
    color: '#a54e35',
    axles: 2,
    description: 'Open bolsters and stakes for logs and sawn wood.',
  },
  tanker: {
    name: 'Dales liquid tanker',
    length: 4.7,
    width: 2.35,
    capacity: 700,
    price: 550000,
    color: '#a7b9b8',
    axles: 2,
    description: 'Sealed tank for water or milk. Empty it before changing liquids.',
  },
  box: {
    name: 'Parish box trailer',
    length: 4.4,
    width: 2.35,
    capacity: 400,
    price: 900000,
    color: '#65768f',
    axles: 2,
    description: 'Covered mixed dry goods. No loose liquids, livestock or fish.',
  },
  fish: {
    name: 'Harbour chilled fish trailer',
    length: 4.8,
    width: 2.4,
    capacity: 800,
    price: 650000,
    color: '#dce7df',
    axles: 2,
    description: 'Insulated seafood body with refrigeration housing and draining fish crates.',
  },
} as const;
export type TrailerKind = keyof typeof trailerDefs;
export interface Trailer {
  id: string;
  owner: string;
  kind: TrailerKind;
  x: number;
  z: number;
  heading: number;
  cargo: Stock;
  attached?: string;
}
export const attachedTrailer = (w: World, p: Pick<Player, 'id'>) =>
  Object.values(w.trailers ?? {}).find((t) => t.attached === p.id);
function need(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
const animals: Record<string, number> = { cows: 1, sheep: 0.25, pigs: 0.35, chickens: 0.05 };
const seafood = ['fish', 'largeFish', 'cod', 'halibut', 'tuna'];
export function trailerAccepts(w: World, t: Trailer, item: string, n: number) {
  const def = trailerDefs[t.kind],
    items = worldItems(w),
    cargo = { ...t.cargo, [item]: (t.cargo[item] ?? 0) + n };
  if (!items[item] || stockWeight(w, cargo) > def.capacity) return false;
  if (t.kind === 'livestock')
    return (
      !!animals[item] &&
      Object.entries(cargo).reduce((s, [id, q]) => s + q * (animals[id] ?? Infinity), 0) <= 6
    );
  if (t.kind === 'tanker')
    return (
      ['water', 'milk'].includes(item) &&
      Object.entries(t.cargo).every(([id, q]) => !q || id === item)
    );
  if (t.kind === 'fish') return seafood.includes(item);
  if (t.kind === 'logs') return ['logs', 'wood'].includes(item);
  if (t.kind === 'dump') return ['stone', 'gravel', 'sand', 'ore', 'topsoil'].includes(item);
  if (animals[item] || ['water', 'milk'].includes(item) || seafood.includes(item)) return false;
  if (t.kind === 'hay')
    return (
      stockWeight(w, Object.fromEntries(Object.entries(cargo).filter(([id]) => id !== 'hay'))) <= 60
    );
  return true;
}
export function trailerLoad(w: World, p: Player) {
  const t = attachedTrailer(w, p);
  return t ? stockWeight(w, p.trailerCargo?.[t.id] ?? t.cargo) / trailerDefs[t.kind].capacity : 0;
}
export function trailerFactors(w: World, p: Player) {
  return attachedTrailer(w, p)
    ? { speed: 1 / (1.12 + trailerLoad(w, p) * 0.33), fuel: 1.12 + trailerLoad(w, p) * 0.3 }
    : { speed: 1, fuel: 1 };
}
export function detachTrailer(w: World, p: Player, loseCargo = false) {
  const t = attachedTrailer(w, p);
  if (t) {
    delete t.attached;
    if (loseCargo) t.cargo = {};
  }
}
function clearTrailer(w: World, t: Trailer, to: { x: number; z: number; heading: number }) {
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
    const def = trailerDefs[kind];
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
    Math.hypot(t.x - p.x, t.z - p.z) <= trailerDefs[t.kind].length / 2 + 9,
    'Move alongside your trailer',
  );
  if (a.operation === 'unhitch') {
    need(t.attached === p.id, 'This trailer is not hitched');
    delete t.attached;
    return 'Trailer parked here with its cargo.';
  }
  if (a.operation === 'hitch') {
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
  source[item] -= n;
  if (!source[item]) delete source[item];
  dest[item] = (dest[item] ?? 0) + n;
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
    if (t.id === except) return false;
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
