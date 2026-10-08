// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation.ts';
import { recipeGraph, inventChainPlans } from '../src/server/npc/chains.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { businessEstimate, economicMenu } from '../src/server/npc/enterprise.ts';
import { inventHypotheses } from '../src/server/npc/hypotheses.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { World, Player } from '../src/shared/types.ts';

function stateFor(p: Player, w: World): ResidentState {
  return {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    experiences: [],
  } as unknown as ResidentState;
}

function parish() {
  const w = createWorld('chains', 'Chains', 'owner');
  const p = addPlayer(w, 'founder', 'Oscar');
  p.npc = true;
  p.cash = 500000;
  p.hunger = 0;
  p.thirst = 0;
  return { w, p, state: stateFor(p, w) };
}

function constructs<
  T extends {
    plan: { kind: string; operation?: string; parameters?: { name: string; value: unknown }[] }[];
  },
>(choices: T[], kind: string) {
  return choices.filter((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'operation' &&
        s.operation === 'construct' &&
        s.parameters?.some((p) => p.name === 'kind' && p.value === kind),
    ),
  );
}

test('the recipe graph lists producers and consumers for every catalogued good', () => {
  const { w } = parish();
  const graph = recipeGraph(w);
  assert.ok(graph.flour.producerKinds.includes('mill'));
  assert.ok(graph.flour.consumerKinds.includes('bakery'));
  assert.ok(graph.flour.consumerKinds.includes('kitchen'));
  assert.ok(graph.meals.producerKinds.includes('kitchen'));
  assert.equal(graph.meals.residentNeed, 'food');
  assert.ok(graph.wheat.farmCrop);
  assert.ok(graph.logs.gather);
  assert.ok(graph.wood.producerKinds.includes('sawmill'));
  assert.ok(graph.tools.consumerKinds.includes('carpenter'));
  assert.ok(graph.water.producerKinds.includes('waterworks'));
  assert.equal(graph.water.residentNeed, 'drink');
  assert.equal(graph.fuel.residentNeed, 'fuel');
});

test('a missing producer for a demanded input is offered as a founding bundle, for mill and kitchen alike', () => {
  const missingProducer = (
    w: World,
    p: Player,
    state: ResidentState,
    kind: string,
    item: string,
  ) => {
    const ideas = inventChainPlans(w, p, state);
    const found = constructs(ideas, kind);
    assert.ok(found.length, `should invent founding ${kind} to supply ${item}`);
    assert.match(found[0].description, /^Found a /);
    assert.ok(found[0].description.toLowerCase().includes(item));
    return found[0];
  };

  {
    const { w, p, state } = parish();
    w.buildings = w.buildings.filter((b) => b.kind !== 'mill');
    missingProducer(w, p, state, 'mill', 'flour');
    assert.ok(constructs(adaptiveChoices(w, p, state), 'mill').length);
  }

  {
    const { w, p, state } = parish();
    assert.ok(!w.buildings.some((b) => b.kind === 'kitchen'));
    missingProducer(w, p, state, 'kitchen', 'meals');
    assert.ok(constructs(adaptiveChoices(w, p, state), 'kitchen').length);
  }
});

test('an owner whose sink has no bid is offered a posted price and till, not only waiting', () => {
  const { w, p, state } = parish();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  mill.stock.flour = 12;
  mill.sell.flour = 2000;
  bakery.owner = p.id;
  bakery.buy = {};
  bakery.investment = 0;
  bakery.stock.flour = 0;
  const ideas = [...inventChainPlans(w, p, state), ...inventHypotheses(w, p, state)];
  const post = ideas.find(
    (c) =>
      /flour/.test(c.description) &&
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'buildingAdmin' &&
          s.parameters.some((x) => x.name === 'item' && x.value === 'flour') &&
          s.parameters.some((x) => x.name === 'side' && x.value === 'buy'),
      ),
  );
  assert.ok(post, 'owner should post a flour bid at the bakery');
  assert.ok(
    post.plan.some(
      (s) => s.kind === 'act' && s.action.type === 'investment' && s.action.direction === 'deposit',
    ) ||
      ideas.some((c) => c.description.includes('deposit') && c.description.includes(bakery.name)),
  );
});

test('a funded mill-to-bakery flour haul still appears when both ends are live', () => {
  const { w, p, state } = parish();
  p.cash = 8000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  mill.stock.flour = 10;
  mill.sell.flour = 2000;
  bakery.buy.flour = 2100;
  bakery.investment = 50000;
  bakery.stock.flour = 0;
  const haul = inventHypotheses(w, p, state).find(
    (c) =>
      c.plan.some(
        (s) =>
          s.kind === 'act' &&
          s.action.type === 'trade' &&
          s.action.item === 'flour' &&
          s.action.direction === 'buy',
      ) &&
      c.plan.some(
        (s) =>
          s.kind === 'act' &&
          s.action.type === 'trade' &&
          s.action.item === 'flour' &&
          s.action.direction === 'sell',
      ),
  );
  assert.ok(haul);
});

test('a neighbour already founding a workshop is not offered a duplicate workshop', () => {
  const { w, p, state } = parish();
  w.tier = 1;
  w.buildings.push(makeBuilding('carpenter-1', 'carpenter', 90, 40));
  assert.ok(inventChainPlans(w, p, state).some((c) => constructs([c], 'workshop').length));
  const rival = addPlayer(w, 'rival', 'Ada');
  rival.online = true;
  w.supplyIntents = [
    {
      player: rival.id,
      name: rival.name,
      building: '',
      item: 'tools',
      expires: w.time + 600,
      role: 'found',
      kind: 'workshop',
    },
  ];
  assert.equal(constructs(inventChainPlans(w, p, state), 'workshop').length, 0);
  assert.equal(constructs(adaptiveChoices(w, p, state), 'workshop').length, 0);
});

test('a mill still has an operating estimate when bakeries have not posted flour bids', () => {
  const { w } = parish();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  for (const b of w.buildings) delete b.buy.flour;
  mill.stock.wheat = 20;
  const estimate = businessEstimate(w, mill);
  assert.ok(estimate);
  assert.ok(estimate.revenue > estimate.inputs);
  assert.ok(estimate.margin !== undefined);
});

test('chain-closing founding outranks leisure on the Jev shortlist', () => {
  const { w, p, state } = parish();
  const menu = economicMenu(w, p, adaptiveChoices(w, p, state), 'owner');
  const found = menu.findIndex(
    (c) =>
      c.description.startsWith('Found a') &&
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'construct' &&
          s.parameters.some((x) => x.name === 'kind' && x.value === 'kitchen'),
      ),
  );
  const paint = menu.findIndex((c) => c.description.startsWith('Paint my tractor'));
  assert.ok(found >= 0, 'kitchen founding should reach the Jev menu');
  assert.ok(found < 32, 'founding should sit in the primary shortlist, not the rotating tail');
  if (paint >= 0) assert.ok(found < paint);
});
