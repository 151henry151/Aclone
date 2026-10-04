import { blockedStep } from './recovery.ts';
import type { ResidentState } from './memory.ts';
import { secondsToDamage } from './strategy.ts';
import { alcoholDose } from '../../shared/intoxication.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { availableSupply } from '../../shared/harbour-supply.ts';
import { items } from '../../shared/catalog.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import { nextNutrition } from './strategy.ts';
import { operation } from './player-operations.ts';
const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });
export function visitBuilding(p: Player, b: Building, steps: Step[]): Step[] {
  return [
    ...(p.atHome ? [act({ type: 'outside' })] : []),
    ...(p.game ? [operation('leaveGame')] : []),
    ...(p.hitch ? [operation('detach')] : []),
    ...(p.crowBody ? [operation('crow')] : []),
    ...(distance(p, b) >= 12
      ? [
          ...(p.vehicle !== 5 && p.fuel <= 0
            ? [act({ type: 'vehicle', slot: 5 })]
            : p.vehicle !== 5 && !p.engine
              ? [act({ type: 'engine' })]
              : []),
          { kind: 'travel' as const, destination: b.id },
        ]
      : []),
    ...steps,
  ];
}
/** Ordinary self-care is a routine, not a paid strategic decision. No gifts or immunity.
 * Resolve the most urgent nutrient first, including alternatives at the spaceport. */
export function carePlan(w: World, p: Player, state?: ResidentState): Step[] {
  const items = worldItems(w);
  if (p.task || (p.hunger < 25000 && p.thirst < 25000 && secondsToDamage(w, p) > 600)) return [];
  const usable = (b: Building) =>
    !blockedStep(state?.recovery, { kind: 'travel', destination: b.id }, w.time);
  const needs = (
    [
      ['food', p.hunger],
      ['drink', p.thirst],
    ] as const
  )
    .filter(
      ([nutrient, n]) =>
        n >= 25000 ||
        (50000 - n) / (nutrient === 'food' ? w.settings.hungerRate : w.settings.thirstRate) <= 600,
    )
    .sort((a, b) => b[1] - a[1]);
  for (const [nutrient] of needs) {
    const food = Object.keys(items).filter((i) => nextNutrition(p, i, w)[nutrient] > 0);
    const carried = food
      .filter((i) => p.inventory[i] > 0)
      .sort(
        (a, b) =>
          alcoholDose(a) - alcoholDose(b) ||
          nextNutrition(p, b, w)[nutrient] - nextNutrition(p, a, w)[nutrient],
      )[0];
    if (carried) return [act({ type: 'use', item: carried })];
    const sources = w.buildings
      .filter((b) => !b.construction && usable(b))
      .flatMap((b) =>
        food.flatMap((item) => {
          const own = b.owner === p.id;
          if (!(availableSupply(w, b, item) > 0) || !canCarry(p, item, 1, w)) return [];
          const price = own ? 0 : b.sell[item];
          if (!Number.isSafeInteger(price) || price < 0 || price > p.cash) return [];
          return [
            {
              b,
              item,
              own,
              price,
              score: distance(p, b) + (price / nextNutrition(p, item, w)[nutrient]) * 1000,
            },
          ];
        }),
      )
      .sort((a, b) => alcoholDose(a.item) - alcoholDose(b.item) || a.score - b.score);
    const source = sources[0];
    if (source)
      return visitBuilding(p, source.b, [
        act({
          type: source.own ? 'stock' : 'trade',
          building: source.b.id,
          direction: source.own ? 'withdraw' : 'buy',
          item: source.item,
          quantity: 1,
        } as Extract<Step, { kind: 'act' }>['action']),
        act({ type: 'use', item: source.item }),
      ]);
  }
  const bank = w.buildings.find((b) => b.kind === 'bank' && !b.construction && usable(b));
  if (p.bank > 0 && p.cash < 12000 && bank)
    return visitBuilding(p, bank, [
      act({
        type: 'bank',
        building: bank.id,
        direction: 'withdraw',
        amount: Math.min(p.bank, 10000),
      }),
    ]);
  // Only earn emergency money if a stocked meal exists and cannot be afforded.
  const unaffordable = w.buildings.some(
    (b) =>
      b.owner !== p.id &&
      !b.construction &&
      Object.entries(b.sell).some(
        ([item, price]) =>
          availableSupply(w, b, item) > 0 &&
          price > p.cash &&
          needs.some(([nutrient]) => (items[item]?.[nutrient] ?? 0) > 0),
      ),
  );
  const labour = w.buildings.find(
    (b) => b.kind === 'workhouse' && b.owner !== p.id && !b.construction && usable(b),
  );
  if (unaffordable && labour)
    return visitBuilding(p, labour, [act({ type: 'task', building: labour.id, task: 'labour' })]);
  return [];
}
