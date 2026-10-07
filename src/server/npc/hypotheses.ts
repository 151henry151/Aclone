// SPDX-License-Identifier: GPL-3.0-or-later
import { worldItems } from '../../shared/world-catalogue.ts';
import { worldResources, resourceAmount } from '../../shared/resources.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { recipes } from '../../shared/catalog.ts';
import { propertyQuote } from '../../shared/property.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
import { travelPrep, livingReserve, affordableLoad } from './travel.ts';
import { workplace } from './workplace.ts';
import { blockedStep } from './recovery.ts';
import { operation } from './player-operations.ts';
import { spareSupplies } from './strategy.ts';

const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });

export type Idea = FarmerChoice & { expectedCash?: number; idea?: string };

const visit = (p: Player, b: Building, steps: Step[]): Step[] => [
  ...travelPrep(p),
  ...(distance(p, b) >= 14 ? [{ kind: 'travel' as const, destination: b.id }] : []),
  ...steps,
];

/** Score past tries so a failed loop is tried less often than a fresh or winning one. */
export function rankIdeas(ideas: Idea[], experiences: ResidentState['experiences'] = []) {
  const score = (idea: Idea) => {
    let weight = 1 + Math.max(0, idea.expectedCash ?? 0) / 2000;
    for (const e of experiences ?? []) {
      const related =
        (idea.description && e.goal.includes(idea.description.slice(0, 24))) ||
        (idea.idea && e.goal.toLowerCase().includes(idea.idea.toLowerCase()));
      if (!related) continue;
      weight *= e.cashChange > 0 ? 2.2 : 0.25;
    }
    return weight;
  };
  return [...ideas].sort((a, b) => score(b) - score(a));
}

/** Invent currently legal experiments from the live parish: any good, any building. */
export function inventHypotheses(w: World, p: Player, state: ResidentState): Idea[] {
  const ideas: Idea[] = [];
  const reserve = livingReserve(w, p);
  const add = (idea: string, description: string, plan: Step[], expectedCash = 0) => {
    if (
      plan.length > 12 ||
      plan.length < 1 ||
      plan.some((s) => blockedStep(state.recovery, s, w.time))
    )
      return;
    ideas.push({
      id: `idea_${ideas.length}`,
      idea,
      description,
      plan,
      expectedCash,
      reconsiderSeconds: 180,
    });
  };

  if (p.vehicle === 5 && p.fuel > 0)
    add(
      'remount',
      'Mount my tractor again; walking is slower and I still have fuel.',
      [act({ type: 'vehicle', slot: 0 })],
    );

  if (p.fuel < 10) {
    const can = Object.entries(p.inventory).find(([item, n]) => n > 0 && worldItems(w)[item]?.fuel);
    if (can)
      add('refuel', `Use carried ${can[0]} to refill the tractor.`, [act({ type: 'use', item: can[0] })]);
    const shop = w.buildings
      .filter((b) => !b.construction && (b.stock.fuel ?? 0) > 0 && (b.sell.fuel ?? 0) > 0 && p.cash >= b.sell.fuel)
      .sort((a, b) => a.sell.fuel - b.sell.fuel)[0];
    if (shop)
      add(
        'buy fuel',
        `Buy and use 1 fuel at ${shop.name} so I can drive.`,
        visit(p, shop, [
          act({ type: 'trade', building: shop.id, item: 'fuel', quantity: 1, direction: 'buy' }),
          act({ type: 'use', item: 'fuel' }),
        ]),
        -shop.sell.fuel,
      );
  }

  if (p.job) {
    const workplaceBuilding = w.buildings.find((b) => b.id === p.job);
    const job = workplaceBuilding && workplace(w, p, workplaceBuilding);
    if (workplaceBuilding && job?.employedHere && !job.workActiveNextCycle)
      add(
        'renew shift',
        `Renew my expired shift at ${workplaceBuilding.name} so it can produce at full speed.`,
        visit(p, workplaceBuilding, [act({ type: 'work', building: workplaceBuilding.id })]),
        workplaceBuilding.wage,
      );
  }

  const catalogue = worldItems(w);
  for (const item of Object.keys(catalogue)) {
    const sellers = w.buildings.filter(
      (b) =>
        !b.construction &&
        b.owner !== p.id &&
        (b.stock[item] ?? 0) > 0 &&
        Number.isSafeInteger(b.sell[item]) &&
        b.sell[item] > 0,
    );
    const buyers = w.buildings.filter(
      (b) =>
        !b.construction &&
        b.owner !== p.id &&
        Number.isSafeInteger(b.buy[item]) &&
        b.buy[item] > 0 &&
        b.investment >= b.buy[item] &&
        (b.stock[item] ?? 0) < b.capacity,
    );
    for (const seller of sellers) {
      for (const buyer of buyers) {
        if (buyer.id === seller.id || buyer.buy[item] <= seller.sell[item]) continue;
        if (!canCarry(p, item, 1, w)) continue;
        const n = Math.min(
          8,
          seller.stock[item],
          buyer.capacity - (buyer.stock[item] ?? 0),
          Math.floor(buyer.investment / buyer.buy[item]),
          affordableLoad(p.cash, seller.sell[item], reserve, 8),
        );
        if (n <= 0) continue;
        const expected = n * (buyer.buy[item] - seller.sell[item]);
        add(
          item,
          `Experiment: buy ${n} ${item} at ${seller.name} (${seller.sell[item]}) and sell at ${buyer.name} (${buyer.buy[item]}). Expected ${expected} cash if prices hold.`,
          [
            ...visit(p, seller, [
              act({ type: 'trade', building: seller.id, item, quantity: n, direction: 'buy' }),
            ]),
            { kind: 'travel', destination: buyer.id },
            act({ type: 'trade', building: buyer.id, item, quantity: n, direction: 'sell' }),
          ],
          expected,
        );
      }
    }
  }

  for (const b of w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government)) {
    const recipe = b.production ?? recipes[b.recipe ?? ''];
    const postedBids = Object.entries(b.buy).filter(([, price]) => price > 0);
    const cheapestBid = postedBids.length ? Math.min(...postedBids.map(([, price]) => price)) : 0;
    if (cheapestBid > 0 && b.investment < cheapestBid && p.cash >= cheapestBid) {
      const amount = Math.min(
        10000,
        Math.max(cheapestBid * 4, 2000),
        Math.max(0, p.cash - (p.hunger >= 25000 || p.thirst >= 25000 ? 0 : 1)),
      );
      if (amount >= cheapestBid)
        add(
          'fund shop',
          `Experiment: deposit ${amount} into my ${b.name} so posted bids can actually pay sellers. The till is ${b.investment} and the cheapest bid is ${cheapestBid}.`,
          visit(p, b, [act({ type: 'investment', building: b.id, direction: 'deposit', amount })]),
          -amount,
        );
    }
    if (recipe && b.kind !== 'farm') {
      for (const item of Object.keys(recipe.inputs)) {
        const seller = w.buildings
          .filter(
            (s) =>
              s.id !== b.id &&
              !s.construction &&
              (s.stock[item] ?? 0) > 0 &&
              (s.sell[item] ?? 0) > 0,
          )
          .sort((a, c) => a.sell[item] - c.sell[item])[0];
        if (!seller) continue;
        if (!(b.buy[item] > 0)) {
          const price = seller.sell[item];
          add(
            `post ${item} bid`,
            `Experiment: post a ${item} bid of ${price} at my ${b.name} so neighbours can sell here.`,
            visit(p, b, [
              operation('buildingAdmin', { building: b.id, item, side: 'buy', price }),
            ]),
          );
        }
      }
      if (!b.employees.length) {
        const wage = Math.max(b.wage + 400, 2400);
        add(
          'raise wage',
          `Experiment: raise ${b.name} wage to ${wage} so a qualified neighbour will work here.`,
          visit(p, b, [operation('buildingAdmin', { building: b.id, wage })]),
        );
      }
    }
    if (!recipe || b.kind === 'farm') continue;
    for (const [item, need] of Object.entries(recipe.inputs)) {
      const missing = Math.max(0, need * 2 - (b.stock[item] ?? 0));
      if (missing <= 0) continue;
      const seller = w.buildings
        .filter(
          (s) =>
            s.id !== b.id &&
            !s.construction &&
            (s.stock[item] ?? 0) > 0 &&
            (s.sell[item] ?? 0) > 0,
        )
        .sort((a, c) => a.sell[item] - c.sell[item])[0];
      if (!seller) continue;
      const price = seller.sell[item];
      let cash = p.cash;
      const plan: Step[] = [];
      if (cash < price && b.investment >= price + 2000) {
        const take = Math.min(10000, b.investment - 2000, price * Math.min(4, missing));
        plan.push(
          ...visit(p, b, [act({ type: 'investment', building: b.id, direction: 'withdraw', amount: take })]),
        );
        cash += take;
      }
      const n = Math.min(
        missing,
        seller.stock[item],
        affordableLoad(cash, price, 0, 8),
        b.capacity - (b.stock[item] ?? 0),
      );
      if (n <= 0) continue;
      plan.push(
        ...visit(p, seller, [
          act({ type: 'trade', building: seller.id, item, quantity: n, direction: 'buy' }),
        ]),
        { kind: 'travel', destination: b.id },
        act({ type: 'stock', building: b.id, item, quantity: n, direction: 'deposit' }),
      );
      add(
        `restock ${item}`,
        `Experiment: move ${n} ${item} from ${seller.name} into my ${b.name} so it can produce.`,
        plan,
        -n * price,
      );
    }
    for (const [item, n] of Object.entries(recipe.outputs)) {
      const have = b.stock[item] ?? 0;
      if (have <= 0) continue;
      const buyer = w.buildings
        .filter(
          (s) =>
            s.id !== b.id &&
            s.owner !== p.id &&
            (s.buy[item] ?? 0) > 0 &&
            s.investment >= s.buy[item] &&
            (s.stock[item] ?? 0) < s.capacity,
        )
        .sort((a, c) => c.buy[item] - a.buy[item])[0];
      if (!buyer) continue;
      const qty = Math.min(have, 8, Math.floor(buyer.investment / buyer.buy[item]));
      if (qty <= 0 || !canCarry(p, item, qty, w)) continue;
      add(
        `sell ${item}`,
        `Experiment: take ${qty} ${item} from my ${b.name} and sell at ${buyer.name}.`,
        [
          ...visit(p, b, [
            act({ type: 'stock', building: b.id, item, quantity: qty, direction: 'withdraw' }),
          ]),
          { kind: 'travel', destination: buyer.id },
          act({ type: 'trade', building: buyer.id, item, quantity: qty, direction: 'sell' }),
        ],
        qty * buyer.buy[item],
      );
    }
  }

  if ((p.inventory.tackle ?? 0) > 0)
    add(
      'fish',
      'Experiment: fish for a few catches, then sell or eat them. Bites are not guaranteed.',
      [{ kind: 'fish', catches: 3 }],
    );
  {
    const n = spareSupplies(p, 'fish', w);
    const buyer = w.buildings
      .filter(
        (b) =>
          (b.buy.fish ?? 0) > 0 &&
          b.investment >= b.buy.fish &&
          (b.stock.fish ?? 0) < b.capacity,
      )
      .sort((a, c) => c.buy.fish - a.buy.fish)[0];
    if (buyer) {
      const qty = Math.min(n, 8, Math.floor(buyer.investment / buyer.buy.fish));
      if (qty > 0)
        add(
          'sell fish',
          `Experiment: sell ${qty} fish at ${buyer.name} for ${qty * buyer.buy.fish}.`,
          visit(p, buyer, [
            act({ type: 'trade', building: buyer.id, item: 'fish', quantity: qty, direction: 'sell' }),
          ]),
          qty * buyer.buy.fish,
        );
    }
  }

  for (const b of w.buildings.filter(
    (b) =>
      !b.construction &&
      !b.government &&
      b.owner !== p.id &&
      (!b.owner || b.forSale) &&
      (b.recipe || b.production) &&
      b.kind !== 'farm',
  )) {
    const quote = propertyQuote(w, b);
    const till = Math.max(
      ...Object.values(b.buy).filter((price) => price > 0),
      b.wage || 0,
      2000,
    );
    if (p.cash < quote.total + till) continue;
    const deposit = Math.min(10000, Math.max(till * 4, 2000), p.cash - quote.total - 1);
    if (deposit <= 0) continue;
    add(
      `buy ${b.kind}`,
      `Experiment: buy ${b.name} for ${quote.total} and deposit ${deposit} so it can pay sellers and wages.`,
      visit(p, b, [
        act({ type: 'buyBuilding', building: b.id }),
        act({ type: 'investment', building: b.id, direction: 'deposit', amount: deposit }),
      ]),
      -quote.total - deposit,
    );
  }

  for (const node of [...worldResources(w)]
    .filter((n) => resourceAmount(w, n) >= 3 && canCarry(p, n.item, 3, w))
    .slice(0, 4)) {
    const buyer = w.buildings
      .filter((b) => (b.buy[node.item] ?? 0) > 0 && b.investment >= b.buy[node.item])
      .sort((a, c) => c.buy[node.item] - a.buy[node.item])[0];
    if (!buyer) continue;
    add(
      `gather ${node.item}`,
      `Experiment: gather ${node.item} at ${node.id} and sell at ${buyer.name}.`,
      [
        ...travelPrep(p),
        { kind: 'travel', destination: node.id },
        act({ type: 'gather', node: node.id }),
        { kind: 'travel', destination: buyer.id },
        act({ type: 'trade', building: buyer.id, item: node.item, quantity: 3, direction: 'sell' }),
      ],
      3 * buyer.buy[node.item],
    );
  }

  return rankIdeas(ideas, state.experiences).slice(0, 36);
}
