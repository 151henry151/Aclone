// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import type { ResidentState } from './memory.ts';
import { visitBuilding } from './care.ts';
import { householdBudget } from './household.ts';
import type { Step } from './decision.ts';

/** Attribution survives meal breaks, replanning and logout. It grants no money:
 * settlement is still a normal cash deposit at the owned business. */
export function recordBusinessFreight(
  before: World,
  w: World,
  p: Player,
  state: ResidentState,
  a: Action,
) {
  const prior = before.players[p.id];
  if (a.type === 'stock' && a.direction === 'withdraw' && typeof a.item === 'string') {
    const b = w.buildings.find((b) => b.id === a.building && b.owner === p.id);
    const outputs = b && (b.production ?? recipes[b.recipe ?? ''])?.outputs;
    if (b && (outputs?.[a.item] || (b.kind === 'farm' && b.sell[a.item] > 0))) {
      const n = (p.inventory[a.item] ?? 0) - (prior.inventory[a.item] ?? 0);
      if (n > 0) (state.businessCargo ??= []).push({ building: b.id, item: a.item, quantity: n });
    }
  }
  for (const item of Object.keys(prior.inventory)) {
    let removed = Math.max(0, (prior.inventory[item] ?? 0) - (p.inventory[item] ?? 0));
    const total = removed;
    const sale = a.type === 'trade' && a.direction === 'sell' && a.item === item;
    for (const load of state.businessCargo ?? []) {
      if (load.item !== item || !removed) continue;
      const n = Math.min(removed, load.quantity);
      load.quantity -= n;
      removed -= n;
      if (sale && w.buildings.some((b) => b.id === load.building && b.owner === p.id)) {
        const amount = Math.floor((Math.max(0, p.cash - prior.cash) * n) / total);
        state.businessProceeds ??= {};
        state.businessProceeds[load.building] =
          (state.businessProceeds[load.building] ?? 0) + amount;
      }
    }
  }
  state.businessCargo = (state.businessCargo ?? []).filter(
    (l) => l.quantity > 0 && w.buildings.some((b) => b.id === l.building && b.owner === p.id),
  );
  if (
    a.type === 'investment' &&
    a.direction === 'deposit' &&
    typeof a.building === 'string' &&
    state.businessProceeds?.[a.building]
  )
    state.businessProceeds[a.building] = Math.max(
      0,
      state.businessProceeds[a.building] - Math.max(0, prior.cash - p.cash),
    );
}
export function settleBusinessProceeds(w: World, p: Player, state: ResidentState): Step[] {
  for (const [id, owed] of Object.entries(state.businessProceeds ?? {})) {
    const b = w.buildings.find((b) => b.id === id && b.owner === p.id && !b.construction);
    if (!b) {
      delete state.businessProceeds![id];
      continue;
    }
    const amount = Math.min(10_000_000, owed, Math.max(0, p.cash - householdBudget(w, p).reserve));
    if (amount > 0)
      return visitBuilding(p, b, [
        { kind: 'act', action: { type: 'investment', building: id, direction: 'deposit', amount } },
      ]);
  }
  return [];
}
