// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { vehicles, items } from './catalog';
import type { World, VehicleDef } from './types';
const number = (min: number, max: number) => z.number().finite().min(min).max(max);
const point = z.object({ x: number(-30, 30), y: number(-10, 30), z: number(-30, 30) });
const model = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const vehicleTuningSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    mode: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(8),
    ]),
    speed: number(1, 100),
    acceleration: number(0.1, 50),
    turn: number(0.1, 6),
    armour: number(10, 1000),
    fuel: number(0, 1),
    tank: number(1, 100000),
    capacity: number(1, 100000),
    price: number(0, 100000000).int(),
    hitch: number(0, 12).int(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    traction: number(0, 0.95),
    snowTraction: number(0, 0.95),
    rainTraction: number(0, 0.95),
    torque: number(0.25, 4),
    headlight: number(0, 1000),
    lightRange: number(0, 500),
    collisionRadius: number(0.2, 12),
    length: number(1, 60),
    beam: number(0.5, 20),
    persistentThrottle: z.boolean(),
    trawling: z.boolean(),
    provisions: z.boolean(),
    crew: number(0, 2).int(),
    netCapacity: number(10, 5000),
    trawlFuel: number(0.001, 1),
    trawlSpeed: number(1, 8),
    deathPolicy: z.enum(['world', 'lose', 'recover']),
    spoilageDays: number(0, 365),
    retainFuel: z.boolean(),
    tracks: z.boolean(),
    frontTrack: number(0.2, 12),
    rearTrack: number(0.2, 12),
    frontTyre: number(0.05, 3),
    rearTyre: number(0.05, 3),
    wheelbase: number(0.5, 20),
    cockpit: point,
    dashboard: model,
    trackTexture: model,
    instruments: z
      .array(z.enum(['speed', 'fuel', 'heading', 'altitude', 'pitch', 'condition']))
      .max(6),
    components: z
      .array(
        z.object({
          model,
          ...point.shape,
          scale: number(0.05, 10),
          yaw: number(-180, 180),
          role: z.enum(['body', 'wheel', 'steer', 'propeller']),
        }),
      )
      .max(16),
    lights: z
      .array(
        z.object({
          ...point.shape,
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          intensity: number(0, 20),
          blink: number(0, 10),
          switch: z.enum(['always', 'headlights', 'cabin', 'deck']),
        }),
      )
      .max(12),
  })
  .partial()
  .strict();
export type VehicleTuning = z.infer<typeof vehicleTuningSchema>;
export const vehicleSlotSchema = z.string().regex(/^(?:[0-9]|[12][0-9]|3[0123])$/);
export function vehicleDef(
  w: Pick<World, 'vehicleTuning'> | undefined,
  slot: number,
): VehicleDef & Omit<VehicleTuning, 'mode'> {
  return { ...vehicles[slot], ...w?.vehicleTuning?.[slot] };
}
export function isTrawler(slot: number, w?: Pick<World, 'vehicleTuning'>) {
  return vehicleDef(w, slot).mode === 3 && (w?.vehicleTuning?.[slot]?.trawling ?? slot === 30);
}
export function hasProvisions(slot: number, w?: Pick<World, 'vehicleTuning'>) {
  return w?.vehicleTuning?.[slot]?.provisions ?? isTrawler(slot, w);
}
export function crewBerths(slot: number, w?: Pick<World, 'vehicleTuning'>) {
  return w?.vehicleTuning?.[slot]?.crew ?? (isTrawler(slot, w) ? 2 : 0);
}
export function validateVehicleTuning(w: World, slot: number, input: unknown, replace = false) {
  const tuning = vehicleTuningSchema.parse(input),
    v = { ...vehicles[slot], ...(replace ? {} : w.vehicleTuning?.[slot]), ...tuning };
  if (
    [5, 6, 7, 29].includes(slot) &&
    tuning.mode !== undefined &&
    tuning.mode !== vehicles[slot].mode
  )
    throw Error('Walking, creature, scout and lifeboat movement modes are reserved');
  if ((v.trawling || v.crew || v.provisions || v.deathPolicy === 'recover') && v.mode !== 3)
    throw Error('Trawling, provisions, paid crew and recovery require boat movement');
  if (v.crew && !(v.provisions ?? v.trawling ?? slot === 30))
    throw Error('Paid crew require provisions');
  for (const id of [v.dashboard, v.trackTexture].filter(Boolean))
    if (!w.assets?.some((a) => a.id === id && a.type.startsWith('image/')))
      throw Error('Choose an uploaded image asset');
  const textures = new Set(
    Object.entries(w.vehicleTuning ?? {})
      .filter(([s]) => Number(s) !== slot)
      .map(([, v]) => v.trackTexture)
      .filter(Boolean),
  );
  if (v.trackTexture) textures.add(v.trackTexture);
  if (textures.size > 4) throw Error('Use at most four distinct track textures per world');
  for (const c of v.components ?? [])
    if (!w.creator?.models.some((m) => m.id === c.model))
      throw Error('Choose a Workshop component model');
  for (const p of Object.values(w.players)) {
    const previous = vehicleDef(w, slot);
    const moored = Object.values(w.mooredBoats ?? {}).some(
      (b) => b.owner === p.id && b.slot === slot,
    );
    if (v.mode !== previous.mode && (moored || w.boatRescues?.[p.id]?.boat.slot === slot))
      throw Error('Recover and store moored vessels before changing movement mode');
    if ((v.tank ?? 64) < (previous.tank ?? 64) && (p.parkedFuel?.[slot] ?? 0) > (v.tank ?? 64))
      throw Error('Empty parked excess fuel before reducing the tank');
    if (p.vehicle !== slot) continue;
    if (p.trawl && ((v.trawling ?? slot === 30) === false || v.mode !== 3))
      throw Error('Haul and finish trawling before disabling it');
    if (
      Object.values(p.boatStores ?? {}).some((n) => n > 0) &&
      !(v.provisions ?? v.trawling ?? slot === 30)
    )
      throw Error('Empty provisions before disabling storage');
    if (Object.keys(p.fishingVoyage?.members ?? {}).length > (v.crew ?? (slot === 30 ? 2 : 0)))
      throw Error('Settle the expedition before reducing paid crew berths');
    if (v.mode !== vehicleDef(w, slot).mode)
      throw Error('Disembark all players before changing this vehicle’s movement mode');
    if (p.fuel > (v.tank ?? 64) && (v.tank ?? 64) < (previous.tank ?? 64))
      throw Error('Empty excess fuel before reducing the tank');
    const passengers = Object.values(w.players).filter((q) => q.hitch === p.id).length;
    if (passengers > Math.max(v.hitch, v.crew ?? (slot === 30 ? 2 : 0)))
      throw Error('Disembark passengers before reducing berths');
    const defs = { ...items, ...w.catalogue?.items };
    const load = [p.inventory, p.boatStores ?? {}, p.trawl?.catch ?? {}].reduce(
      (total, stock) =>
        total +
        Object.entries(stock).reduce((n, [id, count]) => n + count * (defs[id]?.weight ?? 0), 0),
      0,
    );
    if (v.capacity < previous.capacity && load > v.capacity)
      throw Error('Unload cargo before reducing the hold');
  }
  return tuning;
}

/** Fuel-free creature/walking/rowing slots have no engine, including custom modes. */
export function hasMotor(w: Pick<World, 'vehicleTuning'> | undefined, slot: number) {
  const v = vehicleDef(w, slot);
  return ![5, 6, 7, 29].includes(slot) && v.mode !== 8 && v.fuel > 0;
}
