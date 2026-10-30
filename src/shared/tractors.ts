// SPDX-License-Identifier: GPL-3.0-or-later
import { vehicles } from './catalog.ts';
import { vehicleDef } from './vehicle-config';
import type { Player, World } from './types.ts';
/** New machines use appended slots: existing saves and custom slots 8–23 retain their identities. */
export const tractorSlots = [0, 24, 25, 26, 27, 28] as const;
export const isTractor = (slot: number) => (tractorSlots as readonly number[]).includes(slot);
export const tractorRoles: Record<number, { role: string; description: string; tradeoff: string }> =
  {
    0: {
      role: 'Everyday economy',
      description:
        'A red, rounded agricultural classic. The most economical engine, useful cargo room and an uncomplicated all-rounder.',
      tradeoff: 'Ordinary lights and traction; no specialist advantage on difficult ground.',
    },
    24: {
      role: 'Orchard & village',
      description:
        'A compact teal open tractor with a low bonnet and roll bar. Quick acceleration and the tightest steering.',
      tradeoff: 'The smallest load and tank; modest lights and no weather cab.',
    },
    25: {
      role: 'Express deliveries',
      description:
        'A blue streamlined road tractor with a tapered bonnet, swept cab and amber stripe. The fastest way to move small valuable loads.',
      tradeoff: 'Small cargo space, thirsty engine and less help in snow or mud.',
    },
    26: {
      role: 'Bulk haulage',
      description:
        'An oxblood estate dray with a forward cab and long timber-sided load deck. Carries the biggest load.',
      tradeoff: 'Slow, wide-turning and expensive to fuel. Hauling capacity is its speciality.',
    },
    27: {
      role: 'Rough-ground work',
      description:
        'A green four-wheel field tractor with equal-size broad tyres, a tall angular cab and protected nose. Recovers part of the mud and snow penalty.',
      tradeoff:
        'Lower road speed, higher fuel use and ordinary headlights. Deep snow still slows it.',
    },
    28: {
      role: 'Long-range night work',
      description:
        'A gold-and-ivory forward-control utility tractor with a rear equipment deck and roof work lamps. Largest tank and strongest headlights.',
      tradeoff:
        'Moderate cargo and speed; a large tank costs more to fill, rather than making fuel free.',
    },
  };
export function returnTractor(p: Player) {
  return isTractor(p.lastTractor ?? -1) && (p.fleet ?? [0, 5]).includes(p.lastTractor!)
    ? p.lastTractor!
    : 0;
}
/** Fuel stays in the actual machine while walking/scouting. Old saves infer their current tank. */
export function fuelVehicle(p: Player, w?: World) {
  return (
    p.fuelVehicle ??
    (vehicleDef(w, p.vehicle)?.fuel > 0 && p.vehicle !== 7
      ? p.vehicle
      : (p.crowBody?.vehicle ?? returnTractor(p)))
  );
}
export function fuelCapacity(p: Player, w?: World) {
  return vehicleDef(w, fuelVehicle(p, w))?.tank ?? 64;
}
/** Only the stranded vessel's own tank is inaccessible during a rescue. */
export function refuelRequiresReboarding(p: Player, w: World) {
  const rescue = w.boatRescues?.[p.id];
  return p.vehicle === 29 || (!!rescue && fuelVehicle(p, w) === rescue.boat.slot);
}
/** Park tanks without topping up or throwing away fuel. Newly bought machines start empty. */
export function switchVehicle(p: Player, slot: number, remember = true, w?: World) {
  // Legacy saves had one shared tank. The first switch between legacy slots
  // adopts that fuel once, preserving existing NPC recovery and player fuel.
  // New tractor purchases never receive this transfer or a free full tank.
  const legacy = p.fuelVehicle === undefined && p.parkedFuel === undefined && slot < 24;
  const previous = legacy && vehicleDef(w, slot)?.fuel > 0 && slot !== 7 ? slot : fuelVehicle(p, w);
  p.fuelVehicle = previous;
  if (vehicleDef(w, slot)?.fuel > 0 && slot !== 7) {
    if (previous !== slot) {
      p.parkedFuel = { ...p.parkedFuel, [previous]: p.fuel };
      p.fuel = p.parkedFuel[slot] ?? 0;
      delete p.parkedFuel[slot];
    }
    p.fuelVehicle = slot;
  }
  if (p.vehicle !== slot) delete p.flight;
  p.vehicle = slot;
  if (remember && isTractor(slot)) p.lastTractor = slot;
}
/** Recover a fraction of a bad surface's penalty, never give a dry-road speed bonus. */
export function tractorSurface(value: number, recovery = 0) {
  return value + (1 - value) * recovery;
}
