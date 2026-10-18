import { housingChoices } from './housing.ts';
import { alcoholDose } from '../../shared/intoxication.ts';
import { constructionChoices } from './construction-projects.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { nutritionIn } from './household.ts';
import { availableSupply } from '../../shared/harbour-supply.ts';
import { blockedStep } from './recovery.ts';
import type { ResidentState } from './memory.ts';
import { cargoRelief } from './business-policy.ts';
import { carePlan } from './care.ts';
import { items } from '../../shared/catalog.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { shelter, roomCount } from '../../shared/lodging.ts';
import type { World, Player, Building } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import { operation } from './player-operations.ts';
import { travelPrep } from './travel.ts';
const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action: a });
function home(w: World, p: Player) {
  return w.buildings
    .filter(
      (b) =>
        !b.construction &&
        ((b.kind === 'home' && b.owner === p.id) || (b.lodging?.guests[p.id]?.until ?? 0) > w.time),
    )
    .sort(
      (a, b) =>
        Number(b.id === p.home) - Number(a.id === p.home) || distance(p, a) - distance(p, b),
    )[0];
}
/** Forecast actual home feeding rates, personal room stores and booking expiry. */
export function offlineReadiness(w: World, p: Player, awaySeconds: number) {
  const b = home(w, p);
  const stock = b ? (b.kind === 'home' ? b.stock : b.lodging!.guests[p.id].stock) : {};
  const until = !b ? 0 : b.kind === 'home' ? Infinity : b.lodging!.guests[p.id].until;
  const foodSeconds =
    w.settings.hungerRate > 0
      ? Math.max(0, 30000 - p.hunger + nutritionIn(w, stock, 'food')) /
        (w.settings.hungerRate * 0.8)
      : Infinity;
  const drinkSeconds =
    w.settings.thirstRate > 0
      ? Math.max(0, 30000 - p.thirst + nutritionIn(w, stock, 'drink')) /
        (w.settings.thirstRate * 0.8)
      : Infinity;
  const coveredSeconds = b ? Math.max(0, Math.min(foodSeconds, drinkSeconds, until - w.time)) : 0;
  return {
    home: b?.id,
    atHome: !!shelter(w, p),
    comfortable: p.hunger < 25000 && p.thirst < 25000 && p.health >= 30000,
    coveredSeconds,
    plannedAwaySeconds: awaySeconds,
    stocked: coveredSeconds >= awaySeconds + 900,
    reminder:
      'Use your own home or personal booked-room stores. Eat and drink before leaving, stock for the expected absence, then enter home. No free supplies or immunity. Without shelter or sufficient stores you will return sooner. Hunger, thirst and starvation damage continue offline for everyone; empty stores or expired lodging can kill you.',
  };
}
export function returnDelay(w: World, p: Player, plannedSeconds: number) {
  const ready = offlineReadiness(w, p, plannedSeconds);
  if (ready.atHome && ready.stocked && ready.comfortable) return plannedSeconds;
  const hunger = w.settings.hungerRate > 0 ? (35000 - p.hunger) / w.settings.hungerRate : Infinity;
  const thirst = w.settings.thirstRate > 0 ? (35000 - p.thirst) / w.settings.thirstRate : Infinity;
  // Brief welfare checks; never spin into immediate reconnect/model-call loops.
  return Math.min(
    plannedSeconds,
    Math.max(
      600,
      Math.min(
        3600,
        hunger * 0.5,
        thirst * 0.5,
        ready.atHome ? ready.coveredSeconds * 0.7 : Infinity,
      ),
    ),
  );
}
/** One ordinary, bounded errand at a time; no teleportation or inventory grants.
 * Running locally means a depleted AI budget cannot strand an already-planned logout. */
export function homecomingPlan(
  w: World,
  p: Player,
  awaySeconds: number,
  state?: ResidentState,
  enterForLogout = true,
): Step[] {
  w = {
    ...w,
    buildings: w.buildings.filter(
      (b) => !blockedStep(state?.recovery, { kind: 'travel', destination: b.id }, w.time),
    ),
  };
  if (p.task) return [{ kind: 'wait', seconds: Math.max(1, Math.min(60, p.task.end - w.time)) }];
  const ready = offlineReadiness(w, p, awaySeconds);
  if (ready.stocked && (!enterForLogout || ready.atHome)) return [];
  const care = carePlan(w, p, state);
  if (care.length) return care;
  if (!canCarry(p, 'water', 1, w) || !canCarry(p, 'bread', 1, w)) {
    const unload = cargoRelief(w, p, state);
    if (unload.length) return unload;
  }
  const visit = (b: Building, steps: Step[]): Step[] => [
    ...travelPrep(p),
    ...(distance(p, b) >= 12 ? [{ kind: 'travel', destination: b.id } as Step] : []),
    ...steps,
  ];
  // Consume carried food before stowing it, and before even looking for housing.
  for (const [item, count] of Object.entries(p.inventory))
    if (
      count > 0 &&
      ((p.hunger >= 20000 && items[item]?.food) || (p.thirst >= 20000 && items[item]?.drink))
    )
      return [action({ type: 'use', item })];
  const unfinishedHome = w.buildings.find(
    (b) => b.owner === p.id && b.kind === 'home' && b.construction,
  );
  if (unfinishedHome) {
    const finish = constructionChoices(w, p).find(
      (c) => c.careerGoal?.target === unfinishedHome.id,
    );
    if (finish) return finish.plan;
  }
  const b = home(w, p);
  for (const [need, nutrient, rate] of [
    [p.hunger, 'food', w.settings.hungerRate],
    [p.thirst, 'drink', w.settings.thirstRate],
  ] as const) {
    const alternatives = Object.keys(items).filter(
      (item) =>
        items[item][nutrient] &&
        !alcoholDose(item) &&
        ((p.inventory[item] ?? 0) > 0 ||
          w.buildings.some(
            (s) =>
              !s.construction &&
              s.id !== b?.id &&
              availableSupply(w, s, item) > 0 &&
              (s.owner === p.id || s.sell[item] >= 0),
          )),
    );
    const price = (item: string) =>
      (p.inventory[item] ?? 0) > 0
        ? 0
        : Math.min(
            ...w.buildings
              .filter(
                (s) =>
                  !s.construction &&
                  s.id !== b?.id &&
                  availableSupply(w, s, item) > 0 &&
                  (s.owner === p.id || s.sell[item] >= 0),
              )
              .map((s) => (s.owner === p.id ? 0 : s.sell[item])),
          );
    const item =
      alternatives.sort(
        (a, b) => price(a) / items[a][nutrient]! - price(b) / items[b][nutrient]!,
      )[0] ?? (nutrient === 'food' ? 'bread' : 'water');
    const stock = b ? (b.kind === 'home' ? b.stock : b.lodging!.guests[p.id].stock) : {};
    const target = b
      ? Math.ceil(
          Math.max(
            0,
            need + (awaySeconds + 900) * rate * 0.8 - 20000 - nutritionIn(w, stock, nutrient),
          ) / items[item][nutrient]!,
        )
      : need >= 15000
        ? 2
        : 0;
    const carried = p.inventory[item] ?? 0;
    if (b && carried > 0 && target > 0) {
      const n = Math.min(
        carried,
        target,
        (b.kind === 'home' ? b.capacity : 100) - (stock[item] ?? 0),
      );
      if (n > 0)
        return visit(b, [
          b.kind === 'home'
            ? action({ type: 'stock', building: b.id, item, quantity: n, direction: 'deposit' })
            : operation('lodging', {
                building: b.id,
                operation: 'store',
                item,
                quantity: n,
                direction: 'deposit',
              }),
        ]);
    }
    if (target > carried) {
      const shop = w.buildings
        .filter(
          (v) =>
            !v.construction &&
            v.id !== b?.id &&
            availableSupply(w, v, item) > 0 &&
            (v.owner === p.id ||
              (Number.isSafeInteger(v.sell[item]) && v.sell[item] >= 0 && p.cash >= v.sell[item])),
        )
        .sort(
          (a, b) =>
            (a.owner === p.id ? 0 : a.sell[item]) - (b.owner === p.id ? 0 : b.sell[item]) ||
            distance(p, a) - distance(p, b),
        )[0];
      if (shop) {
        const cost = shop.owner === p.id ? 0 : shop.sell[item];
        let n = Math.min(
          20,
          target - carried,
          availableSupply(w, shop, item),
          cost
            ? Math.floor(
                Math.max(0, p.cash - (nutrient === 'food' && p.thirst >= 15000 ? 1500 : 0)) / cost,
              )
            : 20,
        );
        while (n > 0 && !canCarry(p, item, n, w)) n--;
        if (n > 0)
          return visit(shop, [
            action(
              shop.owner === p.id
                ? { type: 'stock', building: shop.id, item, quantity: n, direction: 'withdraw' }
                : { type: 'trade', building: shop.id, item, quantity: n, direction: 'buy' },
            ),
          ]);
      }
    }
  }
  if (b) {
    if (enterForLogout && (!p.atHome || p.home !== b.id))
      return visit(b, [action({ type: 'home', building: b.id })]);
    return [];
  }
  const establish = housingChoices(w, p, awaySeconds)[0];
  if (establish) return establish.plan;
  const hours = Math.max(1, Math.min(24, Math.ceil((awaySeconds + 1200) / 3600)));
  const inn = w.buildings
    .filter(
      (v) =>
        !v.construction &&
        v.owner &&
        v.owner !== p.id &&
        v.lodging?.open &&
        roomCount(v) > Object.values(v.lodging.guests).filter((g) => g.until > w.time).length &&
        p.cash >= hours * v.lodging.rate + 2000,
    )
    .sort((a, b) => distance(p, a) - distance(p, b))[0];
  if (inn)
    return visit(inn, [operation('lodging', { building: inn.id, operation: 'rent', hours })]);
  return [];
}
