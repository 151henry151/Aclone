import { withinBuildingRange } from '../../shared/simulation';
import {
  parkedVehicle,
  persistentVehicles,
  parkedGarage,
  storesSpareTractors,
  GARAGE_STORAGE,
} from '../../shared/parked-vehicles';
import { returnTractor, isTractor } from '../../shared/tractors';
import { parkingRules } from '../../shared/parking-rules';
import { npcJourneyRules } from '../../shared/npc-journey-rules';
import { nearbyFuelTanker } from './fuel';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../../shared/types.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import type { Step } from './decision.ts';
import { householdBudget } from './household.ts';
import { operation, operationAction } from './player-operations.ts';

const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });

function leaveDistractions(p: Player): Step[] {
  return [
    ...(p.atHome ? [act({ type: 'outside' })] : p.inside ? [act({ type: 'outside' })] : []),
    ...(p.game ? [operation('leaveGame')] : []),
    ...(p.hitch ? [operation('detach')] : []),
    ...(p.crowBody ? [operation('crow')] : []),
  ];
}

/** Get back on the tractor when there is fuel. An empty tank must never prevent walking to safety. */
export function travelVehicle(p: Player) {
  return p.fuel > 0 || (p.inventory.fuel ?? 0) > 0 ? 0 : 5;
}

export function travelPrep(p: Player, w?: World, destination?: Step): Step[] {
  const parked =
    w && persistentVehicles(w, p) && p.vehicle === 5
      ? parkedVehicle(w, p, returnTractor(p))
      : undefined;
  if (w && parked) {
    const garage = parkedGarage(w, p, parked.inside);
    // This is the recovery walk itself. Never prepend the same walk again.
    if (
      (destination?.kind === 'move' &&
        Math.hypot(destination.x - parked.x, destination.z - parked.z) < 0.01) ||
      (destination?.kind === 'travel' && destination.destination === garage?.id)
    )
      return [];
    if (parked.fuel <= 0 && !(p.inventory.fuel > 0)) return leaveDistractions(p);
    return [
      ...leaveDistractions(p),
      ...returnToParked(w, p, parked.slot),
      parked.slot === 0
        ? act({ type: 'vehicle', slot: 0, ...(garage ? { building: garage.id } : {}) })
        : operation('vehicle', {
            slot: parked.slot,
            ...(garage ? { building: garage.id } : {}),
          }),
      ...(parked.fuel <= 0 ? [act({ type: 'use', item: 'fuel' })] : []),
      act({ type: 'engine' }),
    ];
  }
  const slot = travelVehicle(p) === 5 ? 5 : w && storesSpareTractors(w, p) ? returnTractor(p) : 0;
  return [
    ...leaveDistractions(p),
    ...(p.fuel <= 0 && (p.inventory.fuel ?? 0) > 0 ? [act({ type: 'use', item: 'fuel' })] : []),
    ...(p.vehicle !== slot
      ? [slot === 0 || slot === 5 ? act({ type: 'vehicle', slot }) : operation('vehicle', { slot })]
      : []),
    ...(slot !== 5 && !p.engine ? [act({ type: 'engine' })] : []),
  ];
}

export function returnToParked(w: World, p: Player, slot: number): Step[] {
  const v = parkedVehicle(w, p, slot);
  if (!v) return [];
  if (v.inside) {
    const b = parkedGarage(w, p, v.inside);
    return b && !withinBuildingRange(w, p, b) ? [{ kind: 'travel', destination: b.id }] : [];
  }
  return Math.hypot(p.x - v.x, p.z - v.z) > parkingRules(w.settings).parkingReturnRange
    ? [{ kind: 'move', x: v.x, z: v.z }]
    : [];
}
/** Repair an already accepted action plan before its physical boarding/refuel step. */
export function parkingActionPrep(w: World, p: Player, step: Step): Step[] {
  if (!persistentVehicles(w, p) || !['act', 'operation'].includes(step.kind)) return [];
  const a =
    step.kind === 'act'
      ? step.action
      : step.kind === 'operation'
        ? operationAction(step)
        : undefined;
  if (!a) return [];
  const slot =
    a.type === 'vehicle'
      ? Number(a.slot)
      : a.type === 'use' && a.item === 'fuel' && p.vehicle === 5
        ? returnTractor(p)
        : undefined;
  if (slot === undefined) return [];
  const v = parkedVehicle(w, p, slot);
  const spare =
    storesSpareTractors(w, p) &&
    isTractor(slot) &&
    slot !== (isTractor(p.vehicle) ? p.vehicle : returnTractor(p));
  const garage = parkedGarage(w, p, spare ? GARAGE_STORAGE : v?.inside);
  const route: Step[] = garage
    ? withinBuildingRange(w, p, garage)
      ? []
      : [{ kind: 'travel', destination: garage.id }]
    : returnToParked(w, p, slot);
  if (garage) {
    if (a.type === 'vehicle') {
      // Repair the accepted step too, so arrival cannot lose the storage location.
      if (step.kind === 'act' && step.action.type === 'vehicle') step.action.building = garage.id;
      else if (step.kind === 'operation') {
        step.parameters = step.parameters.filter((p) => p.name !== 'building');
        step.parameters.push({ name: 'building', value: garage.id });
      }
    } else return [...route, operation('vehicle', { slot, building: garage.id })];
  }
  return route;
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
  const parked =
    persistentVehicles(w, p) && p.vehicle === 5 ? parkedVehicle(w, p, returnTractor(p)) : undefined;
  const fuel = parked?.fuel ?? p.fuel;
  const returnPoint = parked ?? (persistentVehicles(w, p) ? { x: p.x, z: p.z } : undefined);
  const threshold = npcJourneyRules(w.settings).npcDriveFuelThreshold;
  const catalogue = worldItems(w);
  const carried = Object.entries(p.inventory).find(([item, n]) => n > 0 && catalogue[item]?.fuel);
  const tanker = fuel < threshold && !carried ? nearbyFuelTanker(w, p) : undefined;
  const shop = fuel < threshold && !carried && !tanker ? fuelShop(w, p) : undefined;
  const willFuel = fuel > 0 || (fuel < threshold && !!carried) || !!shop || !!tanker;
  if (
    !p.atHome &&
    !p.game &&
    !p.hitch &&
    !p.crowBody &&
    p.vehicle !== 5 &&
    p.engine &&
    fuel > 0 &&
    fuel >= threshold
  )
    return [];
  if (!willFuel) return travelPrep(p, w);
  const steps: Step[] = [...leaveDistractions(p)];
  let walkedToPump = false;
  let engineStarted = false;
  if (fuel < threshold && carried)
    steps.push(
      ...(parked ? returnToParked(w, p, parked.slot) : []),
      act({ type: 'use', item: carried[0] }),
    );
  else if (tanker) {
    steps.push(
      operation('fuelTrailer', {
        operation: 'buy',
        id: tanker.id,
        quantity: 1,
        price: tanker.owner === p.id ? 0 : (tanker.sellPrice ?? 0),
      }),
      ...(parked ? returnToParked(w, p, parked.slot) : []),
      act({ type: 'use', item: 'fuel' }),
    );
  } else if (shop) {
    if (p.vehicle !== 5 && fuel <= 0) {
      steps.push(act({ type: 'vehicle', slot: 5 }));
      walkedToPump = true;
    }
    if (p.vehicle === 5 && fuel > 0)
      steps.push(
        ...(parked ? returnToParked(w, p, parked.slot) : []),
        act({ type: 'vehicle', slot: 0 }),
      );
    if ((p.vehicle !== 5 || fuel > 0) && !p.engine && fuel > 0) {
      steps.push(act({ type: 'engine' }));
      engineStarted = true;
    }
    if (distance(p, shop) >= 12) steps.push({ kind: 'travel', destination: shop.id });
    const n = 1; // Leave room and money for meals; refuel only what this trip needs.
    steps.push(
      act({ type: 'trade', building: shop.id, item: 'fuel', quantity: n, direction: 'buy' }),
    );
    if (returnPoint && (walkedToPump || (p.vehicle === 5 && fuel <= 0)))
      steps.push({ kind: 'move', x: returnPoint.x, z: returnPoint.z });
    steps.push(act({ type: 'use', item: 'fuel' }));
  }
  if ((p.vehicle === 5 || walkedToPump) && willFuel) steps.push(act({ type: 'vehicle', slot: 0 }));
  if (!engineStarted && (!p.engine || walkedToPump || !!parked) && willFuel)
    steps.push(act({ type: 'engine' }));
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

export function parkingDestination(w: World, p: Player, target: { x: number; z: number }) {
  if (!persistentVehicles(w, p) || p.vehicle !== 5) return;
  const v = Object.values(w.parkedVehicles ?? {}).find(
    (v) => v.owner === p.id && !v.inside && Math.hypot(v.x - target.x, v.z - target.z) < 0.01,
  );
  return v ? { radius: parkingRules(w.settings).parkingReturnRange } : undefined;
}
