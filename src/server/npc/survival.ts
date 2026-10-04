import { anotherSupplier } from './cooperation.ts';
import { estimateSupply } from './supply-estimate.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { worldItems } from '../../shared/world-catalogue.ts';
import { recipes } from '../../shared/catalog.ts';
import { availableSupply } from '../../shared/harbour-supply.ts';
import { canCarry, distance, productionInterval } from '../../shared/simulation.ts';
import { productionStaff } from '../../shared/sound-state.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
import { visitBuilding } from './care.ts';
import { secondsToDamage, spareSupplies } from './strategy.ts';
import { blockedStep } from './recovery.ts';
export interface SupplyGoal {
  world: string;
  building: string;
  item: string;
  started: number;
  expires: number;
  deaths: number;
}
const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action: a });
const safe = (state: ResidentState, plan: Step[], time: number) =>
  !plan.some((s) => blockedStep(state.recovery, s, time));
/** Cost the WHOLE bootstrap, including tuition, input losses, wages held by the
 * business, final retail purchase and travel time. Never count future wages as cash
 * available before production. Offers are estimates; actual acts revalidate them. */
export function supplyChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  if (p.task) return [];
  const catalogue = worldItems(w);
  const result: FarmerChoice[] = [];
  for (const b of w.buildings) {
    const recipe = b.production ?? recipes[b.recipe ?? ''];
    if (!recipe || b.kind === 'farm' || b.construction) continue;
    const item = Object.keys(recipe.outputs).find(
      (i) =>
        (catalogue[i]?.drink && p.thirst >= 15000) || (catalogue[i]?.food && p.hunger >= 15000),
    );
    if (!item) continue;
    const owned = b.owner === p.id;
    const retail = owned ? 0 : b.sell[item];
    if (!Number.isSafeInteger(retail) || retail < 0 || !canCarry(p, item, 1, w)) continue;
    const goal: SupplyGoal = {
      world: w.id,
      building: b.id,
      item,
      started: w.time,
      expires: w.time + 7200,
      deaths: p.deaths,
    };
    const add = (description: string, plan: Step[]) => {
      if (plan.length <= 12 && safe(state, plan, w.time))
        result.push({
          id: `survival_${b.id}_${item}`,
          description,
          plan,
          reconsiderSeconds: 600,
          supplyGoal: goal,
        });
    };
    if ((b.stock[item] ?? 0) > 0 && p.cash >= retail) {
      add(
        `Secure my ${item} from ${b.name}; buy/withdraw and consume it, verifying actual supplies.`,
        visitBuilding(p, b, [
          action(
            owned
              ? { type: 'stock', building: b.id, item, quantity: 1, direction: 'withdraw' }
              : { type: 'trade', building: b.id, item, quantity: 1, direction: 'buy' },
          ),
          action({ type: 'use', item }),
        ]),
      );
      continue;
    }
    // Healthy neighbours can pursue another source instead of duplicating a
    // publicly announced rescue. Urgency overrides the courtesy: no forced starvation.
    if (
      anotherSupplier(w, p, b.id, item) &&
      secondsToDamage(w, p) > 1800 &&
      state.supplyGoal?.building !== b.id
    )
      continue;
    const estimate = estimateSupply(w, p, state, b, item);
    if (estimate)
      add(
        `Restore ${b.name} to obtain ${item}: estimated net cost ${estimate.netCost} including tuition ${estimate.tuition}; about ${estimate.seconds}s. Survival can justify affordable input losses. Next stage only; public output is not reserved and must be checked before buying.`,
        estimate.plan,
      );
  }
  return result;
}
/** Advance an accepted supply goal without another model call. */
export function continueSupply(
  w: World,
  p: Player,
  state: ResidentState,
): FarmerChoice | undefined {
  const goal = state.supplyGoal;
  if (!goal) return;
  if (goal.world !== w.id || goal.deaths !== p.deaths || goal.expires <= w.time) {
    delete state.supplyGoal;
    return;
  }
  const def = worldItems(w)[goal.item];
  if ((!def?.drink || p.thirst < 15000) && (!def?.food || p.hunger < 15000)) {
    delete state.supplyGoal;
    return;
  }
  const choice = supplyChoices(w, p, state).find(
    (c) => c.supplyGoal?.building === goal.building && c.supplyGoal.item === goal.item,
  );
  if (!choice) delete state.supplyGoal;
  return choice;
}
