// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from '../../shared/catalog.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { availableSupply } from '../../shared/harbour-supply.ts';
import { canCarry, distance, productionInterval } from '../../shared/simulation.ts';
import { herdReady } from '../../shared/livestock.ts';
import { waterworksSite } from '../../shared/shoreline.ts';
import { productionStaff } from '../../shared/sound-state.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import type { ResidentState } from './memory.ts';
import { visitBuilding } from './care.ts';
import { spareSupplies, secondsToDamage } from './strategy.ts';
import { blockedStep } from './recovery.ts';
const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action: a });
/** Bounded symbolic forecast; NEVER applied to the world. It accounts for all
 * inputs, intermediate purchases, tuition and wage capital before exposing the
 * first executable stage. Every stage is re-estimated from later observations. */
export function estimateSupply(
  world: World,
  player: Player,
  state: ResidentState,
  building: Building,
  item: string,
) {
  const w = structuredClone({ ...world, messages: [], ledger: [] });
  const p = w.players[player.id];
  let first: Step[] | undefined,
    seconds = 0,
    tuition = 0,
    trades = 0;
  const speed = p.vehicle === 5 || p.fuel <= 0 ? 1 : 3;
  const originCash = p.cash;
  const visiting = new Set<string>();
  const safe = (b: Building) =>
    !blockedStep(state.recovery, { kind: 'travel', destination: b.id }, w.time);
  const stage = (b: Building, steps: Step[]) => {
    if (!safe(b)) throw Error('Route resting');
    const plan = visitBuilding(p, b, steps);
    if (plan.length > 12) throw Error('Stage too large');
    first ??= plan;
    seconds += distance(p, b) / speed + 10;
    p.x = b.x;
    p.z = b.z;
    p.atHome = false;
  };
  const spend = (n: number) => {
    if (!Number.isFinite(n) || n < 0 || p.cash < n) throw Error('Cannot fund the whole plan');
    p.cash -= n;
  };
  const obtain = (source: Building, key: string, quantity: number, depth: number) => {
    if (depth > 3 || visiting.has(source.id)) throw Error('Dependency cycle or depth limit');
    if (!canCarry(p, key, quantity, w)) throw Error('Cargo would not fit');
    const owned = source.owner === p.id;
    const price = owned ? 0 : source.sell[key];
    if (!Number.isSafeInteger(price) || price < 0) throw Error('No posted offer');
    if (availableSupply(w, source, key) < quantity) {
      visiting.add(source.id);
      const recipe = source.production ?? recipes[source.recipe ?? ''];
      if (
        !recipe ||
        !recipe.outputs[key] ||
        source.kind === 'farm' ||
        source.construction ||
        !herdReady(source) ||
        (source.kind === 'waterworks' && !waterworksSite(w, source, source.rotation))
      )
        throw Error('No ready producer');
      const interval = productionInterval(w, source);
      const batches = Math.ceil((quantity - (source.stock[key] ?? 0)) / recipe.outputs[key]);
      if (batches > 4) throw Error('Too many batches for a survival errand');
      const staff = productionStaff(w, source, w.time + seconds + interval * batches);
      const operating =
        owned &&
        w.settings.ownerOperation &&
        p.skills.includes(recipe.skill) &&
        (!w.settings.activeWork ||
          (source.ownerActiveUntil ?? 0) >= w.time + seconds + interval * batches);
      const needsWorker = !source.government && !staff.length && !operating;
      if (needsWorker) {
        if (
          owned
            ? !w.settings.ownerOperation
            : w.settings.jobsEnabled === false ||
              (source.employees.length >= 16 && p.job !== source.id)
        )
          throw Error('No worker available');
        if (!p.skills.includes(recipe.skill)) {
          if (
            (p.learning && p.learning.skill !== recipe.skill) ||
            (!p.learning && p.skills.length >= w.settings.maxSkills)
          )
            throw Error('Cannot qualify');
          const school = w.buildings.find((b) => b.kind === 'school' && !b.construction && safe(b));
          if (!p.learning && !school) throw Error('Need to inspect a school');
          const fee = p.learning ? 0 : p.skills.length ? 16000 : 8000;
          const training = p.learning
            ? Math.max(0, p.learning.end - w.time)
            : p.skills.length
              ? 2400
              : 60;
          spend(fee);
          tuition += fee;
          seconds += training;
          if (p.learning)
            first ??= [{ kind: 'wait', seconds: Math.max(1, Math.min(60, Math.ceil(training))) }];
          else
            stage(school!, [action({ type: 'learn', building: school!.id, skill: recipe.skill })]);
          p.skills.push(recipe.skill);
          delete p.learning;
        }
      }
      for (const [input, n] of Object.entries(recipe.inputs)) {
        const missing = Math.max(0, n * batches - (source.stock[input] ?? 0));
        if (!missing) continue;
        const held = Math.min(missing, spareSupplies(p, input, w));
        const needed = missing - held;
        const bid = owned ? 0 : source.buy[input];
        if (!Number.isSafeInteger(bid) || bid < 0 || source.investment < missing * bid)
          throw Error('Input buyer cannot pay');
        if (needed) {
          const sellers = w.buildings.filter(
            (b) =>
              b.id !== source.id &&
              !b.construction &&
              safe(b) &&
              (b.owner === p.id || (Number.isSafeInteger(b.sell[input]) && b.sell[input] >= 0)) &&
              (availableSupply(w, b, input) >= needed ||
                (b.production ?? recipes[b.recipe ?? ''])?.outputs[input]),
          );
          sellers.sort(
            (a, b) =>
              Number(availableSupply(w, b, input) >= needed) -
                Number(availableSupply(w, a, input) >= needed) ||
              (a.owner === p.id ? 0 : a.sell[input]) - (b.owner === p.id ? 0 : b.sell[input]) ||
              distance(p, a) - distance(p, b),
          );
          // Bounded branching: do not speculate through unavailable producers.
          const seller = sellers[0];
          if (!seller) throw Error('Need to discover an input source');
          obtain(seller, input, needed, depth + 1);
        }
        stage(source, [
          action(
            owned
              ? {
                  type: 'stock',
                  building: source.id,
                  item: input,
                  quantity: missing,
                  direction: 'deposit',
                }
              : {
                  type: 'trade',
                  building: source.id,
                  item: input,
                  quantity: missing,
                  direction: 'sell',
                },
          ),
        ]);
        p.inventory[input] = (p.inventory[input] ?? 0) - missing;
        source.stock[input] = (source.stock[input] ?? 0) + missing;
        source.investment -= missing * bid;
        const received = missing * bid; // The buyer funds the posted bid; sales tax is charged on retail purchases.
        p.cash += received;
        trades -= received;
      }
      const wages = source.wage * (staff.length + (needsWorker && !owned ? 1 : 0)) * batches;
      if (source.investment < wages) throw Error('Wages not funded after inputs');
      if (
        Object.entries(recipe.outputs).some(
          ([key, n]) => (source.stock[key] ?? 0) + n * batches > source.capacity,
        )
      )
        throw Error('Output storage full');
      if (needsWorker)
        stage(source, [
          ...(!owned && p.job && p.job !== source.id ? [action({ type: 'quit' })] : []),
          action({ type: owned || p.job === source.id ? 'work' : 'job', building: source.id }),
        ]);
      const wait = Math.ceil(interval - (w.time % interval) + 1);
      stage(source, [{ kind: 'wait', seconds: Math.max(1, Math.min(60, wait)) }]);
      seconds += interval * batches;
      source.investment -= wages; // Never rely on future wages to finance earlier errands.
      for (const [key, n] of Object.entries(recipe.inputs)) source.stock[key] -= n * batches;
      for (const [key, n] of Object.entries(recipe.outputs))
        source.stock[key] = (source.stock[key] ?? 0) + n * batches;
      visiting.delete(source.id);
    }
    spend(price * quantity);
    trades += price * quantity;
    stage(source, [
      action(
        owned
          ? { type: 'stock', building: source.id, item: key, quantity, direction: 'withdraw' }
          : { type: 'trade', building: source.id, item: key, quantity, direction: 'buy' },
      ),
    ]);
    source.stock[key] = Math.max(0, (source.stock[key] ?? 0) - quantity);
    p.inventory[key] = (p.inventory[key] ?? 0) + quantity;
  };
  try {
    const source = w.buildings.find((b) => b.id === building.id)!;
    obtain(source, item, 1, 0);
    if (!worldItems(w)[item]?.food && !worldItems(w)[item]?.drink) return;
    if (!first) return;
    // If the first stage is the final purchase, immediately consume its receipt.
    if (
      first.some(
        (s) =>
          s.kind === 'act' &&
          'item' in s.action &&
          s.action.item === item &&
          'building' in s.action &&
          s.action.building === building.id &&
          ['trade', 'stock'].includes(s.action.type),
      )
    )
      first.push(action({ type: 'use', item }));
    if (seconds + 90 >= secondsToDamage(world, player)) return;
    return {
      plan: first,
      seconds: Math.ceil(seconds + 90),
      tuition,
      netCost: originCash - p.cash,
      tradingCost: trades,
    };
  } catch {
    return;
  }
}
