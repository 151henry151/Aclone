// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../../shared/types.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import type { Step } from './decision.ts';
import { householdBudget } from './household.ts';
import { operation } from './player-operations.ts';

const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });

function leaveDistractions(p: Player): Step[] {
  return [
    ...(p.atHome ? [act({ type: 'outside' })] : []),
    ...(p.game ? [operation('leaveGame')] : []),
    ...(p.hitch ? [operation('detach')] : []),
    ...(p.crowBody ? [operation('crow')] : []),
  ];
}

/** Get back on the tractor when there is fuel. An empty tank must never prevent walking to safety. */
export function travelPrep(p: Player): Step[] {
  if (p.fuel <= 0 && (p.inventory.fuel ?? 0) > 0)
    return [...leaveDistractions(p), act({ type: 'use', item: 'fuel' })];
  return [
    ...leaveDistractions(p),
    ...(p.vehicle !== 5 && p.fuel <= 0
      ? [act({ type: 'vehicle', slot: 5 })]
      : p.vehicle === 5 && p.fuel > 0
        ? [act({ type: 'vehicle', slot: 0 })]
        : p.vehicle !== 5 && !p.engine && p.fuel > 0
          ? [act({ type: 'engine' })]
          : []),
  ];
}

function fuelShop(w: World, p: Player) {
  const budget = householdBudget(w, p);
  const mealReserve = budget.reserve - budget.fuel;
  return w.buildings
    .filter(
      (b) =>
        !b.construction &&
        b.owner !== p.id &&
        (b.stock.fuel ?? 0) > 0 &&
        Number.isSafeInteger(b.sell.fuel) &&
        b.sell.fuel > 0 &&
        p.cash - mealReserve >= b.sell.fuel &&
        canCarry(p, 'fuel', 1, w),
    )
    .sort((a, b) => a.sell.fuel - b.sell.fuel || distance(p, a) - distance(p, b))[0];
}

/** Refuel and remount before touring the parish. Walk only as far as the pump. */
export function drivePlan(w: World, p: Player): Step[] {
  const catalogue = worldItems(w);
  const carried = Object.entries(p.inventory).find(([item, n]) => n > 0 && catalogue[item]?.fuel);
  const shop = p.fuel < 10 && !carried ? fuelShop(w, p) : undefined;
  const willFuel = p.fuel > 0 || !!carried || !!shop;
  if (
    !p.atHome &&
    !p.game &&
    !p.hitch &&
    !p.crowBody &&
    p.vehicle !== 5 &&
    p.engine &&
    p.fuel >= 10
  )
    return [];
  if (!willFuel) return travelPrep(p);
  const steps: Step[] = [...leaveDistractions(p)];
  let walkedToPump = false;
  if (p.fuel < 10 && carried) steps.push(act({ type: 'use', item: carried[0] }));
  else if (shop) {
    if (p.vehicle !== 5 && p.fuel <= 0) {
      steps.push(act({ type: 'vehicle', slot: 5 }));
      walkedToPump = true;
    }
    if (p.vehicle === 5 && p.fuel > 0) steps.push(act({ type: 'vehicle', slot: 0 }));
    if ((p.vehicle !== 5 || p.fuel > 0) && !p.engine && p.fuel > 0)
      steps.push(act({ type: 'engine' }));
    if (distance(p, shop) >= 12) steps.push({ kind: 'travel', destination: shop.id });
    const n = 1; // Leave room and money for meals; refuel only what this trip needs.
    steps.push(
      act({ type: 'trade', building: shop.id, item: 'fuel', quantity: n, direction: 'buy' }),
    );
    steps.push(act({ type: 'use', item: 'fuel' }));
  }
  if ((p.vehicle === 5 || walkedToPump) && willFuel) steps.push(act({ type: 'vehicle', slot: 0 }));
  else if (p.vehicle !== 5 && !p.engine && willFuel) steps.push(act({ type: 'engine' }));
  return steps;
}

/** Optional spending must leave the measured household reserve intact. */
export function livingReserve(w: World, p: Player) {
  return householdBudget(w, p).reserve;
}

export function affordableLoad(cash: number, price: number, reserve: number, max: number) {
  if (price <= 0) return max;
  return Math.min(max, Math.max(0, Math.floor((cash - reserve) / price)));
}
