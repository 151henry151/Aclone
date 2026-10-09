// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../../shared/types.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { distance } from '../../shared/simulation.ts';
import type { Step } from './decision.ts';
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

/** Get back on the tractor when there is fuel. Never dismount just because the tank is low. */
export function travelPrep(p: Player): Step[] {
  return [
    ...leaveDistractions(p),
    ...(p.vehicle === 5 && p.fuel > 0
      ? [act({ type: 'vehicle', slot: 0 })]
      : p.vehicle !== 5 && !p.engine && p.fuel > 0
        ? [act({ type: 'engine' })]
        : []),
  ];
}

function fuelShop(w: World, p: Player) {
  return w.buildings
    .filter(
      (b) =>
        !b.construction &&
        (b.stock.fuel ?? 0) > 0 &&
        Number.isSafeInteger(b.sell.fuel) &&
        b.sell.fuel > 0 &&
        p.cash >= b.sell.fuel,
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
  if (!willFuel && p.vehicle === 5 && p.fuel <= 0) return [];
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
    const n = Math.min(2, shop.stock.fuel, Math.max(1, Math.floor(p.cash / shop.sell.fuel)));
    steps.push(
      act({ type: 'trade', building: shop.id, item: 'fuel', quantity: n, direction: 'buy' }),
    );
    steps.push(act({ type: 'use', item: 'fuel' }));
  }
  if ((p.vehicle === 5 || walkedToPump) && willFuel) steps.push(act({ type: 'vehicle', slot: 0 }));
  else if (p.vehicle !== 5 && !p.engine && willFuel) steps.push(act({ type: 'engine' }));
  return steps;
}

/** Keep a little cash for the next meal, but never block a single affordable deal. */
export function livingReserve(w: World, p: Player) {
  if (p.hunger >= 25000 || p.thirst >= 25000) return 0;
  return Math.min(4000, Math.max(0, p.cash - 1));
}

export function affordableLoad(cash: number, price: number, reserve: number, max: number) {
  if (price <= 0) return max;
  if (cash < price) return 0;
  return Math.min(max, Math.max(1, Math.floor(Math.max(0, cash - reserve) / price)));
}
