// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, terrainHeight } from '../src/shared/simulation.ts';
import { worldResources } from '../src/shared/resources.ts';
import { careerChoices, startCareer, continueCareer } from '../src/server/npc/projects.ts';
import { farmDuty } from '../src/server/npc/farmer.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';
function setup() {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'npc', 'NPC');
  p.cash = 100000;
  p.inventory = { bread: 6, water: 10 };
  p.fuel = 0;
  p.vehicle = 5;
  const state = { world: w.id, playerId: p.id, plan: [], index: 0 } as unknown as ResidentState;
  return { w, p, state };
}
function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, plan: Step[]) {
  for (const s of plan) {
    if (s.kind === 'travel') {
      const b =
        w.buildings.find((b) => b.id === s.destination) ??
        worldResources(w).find((n) => n.id === s.destination)!;
      assert.ok(b);
      p.x = b.x;
      p.z = b.z;
      p.y = terrainHeight(w, p.x, p.z);
    } else if (s.kind === 'wait') advance(w, s.seconds);
    else if (s.kind === 'act') {
      act(w, p.id, s.action);
      if (p.task) advance(w, p.task.end - w.time + 0.01);
    }
  }
}
test('a gathering career buys equipment, gathers and sells through ordinary game actions', () => {
  const { w, p, state } = setup();
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  shop.sell.chainsaw = 1000;
  shop.stock.chainsaw = 4;
  shop.buy.logs = 1500;
  shop.investment = 100000;
  const choice = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
  );
  assert.ok(choice);
  startCareer(w, p, state, choice.careerGoal!);
  const before = p.cash;
  run(w, p, choice.plan);
  assert.equal(p.inventory.chainsaw, 1);
  assert.equal(p.inventory.logs ?? 0, 0);
  assert.equal(p.cash - before, 17000);
  // Let the harvested grove replenish before repeating the same career.
  advance(w, 3600);
  const persisted = JSON.parse(JSON.stringify(state));
  const next = continueCareer(w, p, persisted);
  assert.ok(next);
  assert.ok(
    !next.plan.some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'chainsaw',
    ),
  );
  run(w, p, next.plan);
  assert.equal(p.cash - before, 35000);
  const original = state.career;
  startCareer(w, p, state, {
    source: choice.careerGoal!.source,
    kind: 'gather',
    target: choice.careerGoal!.target,
    item: 'logs',
  });
  assert.equal(state.career, original, 'same goal retains outcomes regardless of field order');
  p.deaths++;
  assert.equal(continueCareer(w, p, state), undefined);
  assert.equal(state.career, undefined);
});
test('trading continues with carried cargo after source empties and abandons a vanished margin', () => {
  const { w, p, state } = setup();
  const source = w.buildings.find((b) => b.kind === 'mill')!,
    buyer = w.buildings.find((b) => b.kind === 'bakery')!;
  source.stock.flour = 4;
  source.sell.flour = 1000;
  for (const b of w.buildings) b.buy.flour = 0;
  buyer.buy.flour = 3000;
  buyer.investment = 100000;
  buyer.stock.flour = 0;
  const choice = careerChoices(w, p, state).find(
    (c) =>
      c.careerGoal?.kind === 'trade' &&
      c.careerGoal.source === source.id &&
      c.careerGoal.target === buyer.id,
  )!;
  assert.ok(choice);
  startCareer(w, p, state, choice.careerGoal!);
  const purchase = choice.plan.findIndex(
    (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'buy',
  );
  run(w, p, choice.plan.slice(0, purchase + 1));
  assert.equal(source.stock.flour, 0);
  const next = continueCareer(w, p, state);
  assert.ok(next);
  assert.ok(
    !next.plan.some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'buy',
    ),
  );
  run(w, p, next.plan);
  assert.equal(buyer.stock.flour, 4);
  buyer.buy.flour = 500;
  assert.equal(continueCareer(w, p, state), undefined);
});
test('farm planting favours a funded wheat shortage over already saturated crops', () => {
  const { w, p, state } = setup();
  const farm = w.buildings.find((b) => b.kind === 'farm')!,
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.skills = ['farmer'];
  farm.owner = p.id;
  farm.investment = 100000;
  farm.plots = [];
  farm.stock = { wheat: 0, potatoes: 495, hops: 406, tea: 153 };
  mill.stock.wheat = 0;
  mill.buy.wheat = 1000;
  mill.investment = 100000;
  const plan = farmDuty(w, p, farm, state);
  assert.ok(
    plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'farm' &&
        s.action.operation === 'plant' &&
        s.action.crop === 'wheat',
    ),
  );
});

test('a full gathering load is sold before looking for more cargo room', () => {
  const { w, p, state } = setup();
  const buyer = w.buildings.find((b) => b.kind === 'market')!;
  buyer.buy.logs = 1500;
  buyer.investment = 100000;
  p.inventory = { logs: 47, chainsaw: 1, water: 1 };
  const choice = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
  );
  assert.ok(choice);
  assert.ok(!choice.plan.some((s) => s.kind === 'act' && s.action.type === 'gather'));
  run(w, p, choice.plan);
  assert.equal(p.inventory.logs, 0);
});

test('a large trading catalogue cannot crowd all employment careers out', () => {
  const { w, p, state } = setup();
  p.skills = ['miller'];
  p.cash = 1000000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.investment = 100000;
  mill.stock.wheat = 20;
  // Use normal low-weight catalogue goods, with many seller/consumer pairings.
  const goods = Object.keys(w.buildings[0].sell).slice(0, 40);
  for (const b of w.buildings.filter((b) =>
    ['market', 'starport', 'pub', 'garage'].includes(b.kind),
  )) {
    for (const item of goods) {
      b.sell[item] = 100;
      b.buy[item] = 300;
      b.stock[item] = 20;
    }
    b.investment = 1000000;
  }
  const choices = careerChoices(w, p, state);
  assert.ok(choices.length <= 60);
  assert.ok(
    choices.some((c) => c.careerGoal?.kind === 'employment' && c.careerGoal.target === mill.id),
  );
});

test('a farm career learns, takes the job, plants and reserves the harvest wage', async () => {
  const { crops } = await import('../src/shared/farming.ts');
  const { w, p, state } = setup();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  farm.stock = { potatoes: 400, hops: 400, tea: 400 };
  farm.plots = [];
  farm.investment = crops.wheat.seed + farm.wage;
  mill.stock.wheat = 0;
  mill.investment = 100000;
  const school = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'employment' && c.careerGoal.target === farm.id,
  );
  assert.ok(school, 'seasonal farming is a career, not an excluded automatic factory');
  startCareer(w, p, state, school.careerGoal!);
  run(w, p, school.plan);
  assert.ok(p.skills.includes('farmer'));
  const job = continueCareer(w, p, state)!;
  assert.ok(job);
  run(w, p, job.plan);
  assert.equal(p.job, farm.id);
  const plant = continueCareer(w, p, state)!;
  assert.ok(plant);
  run(w, p, plant.plan);
  assert.equal(farm.plots![0].crop, 'wheat');
  assert.equal(farm.investment, farm.wage, 'seeds leave the harvest wage intact');
  p.inventory.water = 0;
  assert.deepEqual(
    farmDuty(w, p, farm, state),
    [],
    'do not spend harvest wages on optional fertilizer or another plot',
  );
  advance(w, farm.plots![0].ready - w.time + 1);
  const harvest = continueCareer(w, p, state)!;
  assert.ok(harvest);
  run(w, p, harvest.plan);
  assert.ok(farm.stock.wheat > 0);
  assert.equal(farm.investment, 0);
});

test('farm ownership has a funded purchase and seasonal operating career, with exports returning to its till', async () => {
  const { farmEnterprises } = await import('../src/server/npc/farm-enterprise.ts');
  const { w, p } = setup();
  p.cash = 1000000;
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.owner = undefined;
  farm.investment = 0;
  farm.stock.wheat = 0;
  const purchase = farmEnterprises(w, p).find((c) => c.description.startsWith('Acquire and fund'));
  assert.ok(purchase);
  run(w, p, purchase.plan);
  assert.equal(farm.owner, p.id);
  assert.ok(farm.investment > 0);
  p.skills = ['farmer'];
  assert.ok(
    farmEnterprises(w, p).some((c) =>
      c.plan.some((s) => s.kind === 'act' && s.action.type === 'farm'),
    ),
  );
  farm.stock.wheat = 20;
  const output = farmEnterprises(w, p).find((c) => c.description.startsWith('Sell my output'))!;
  assert.ok(output);
  const before = farm.investment,
    cash = p.cash;
  run(w, p, output.plan);
  assert.ok(farm.investment > before);
  assert.equal(p.cash, cash, 'export receipts stay in the farm');
  w.time = 300 * 600; // Winter: no new warm-season crop is required to sell stored output.
  farm.stock.wheat = 20;
  assert.ok(farmEnterprises(w, p).some((c) => c.description.startsWith('Sell my output')));
});

test('a career yields to a pending player agreement and can resume once it is completed', () => {
  const { w, p, state } = setup();
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  p.inventory.chainsaw = 1;
  shop.buy.logs = 1500;
  shop.investment = 100000;
  const choice = careerChoices(w, p, state).find((c) => c.careerGoal?.kind === 'gather')!;
  assert.ok(choice);
  startCareer(w, p, state, choice.careerGoal!);
  state.commitments = [{ world: w.id, status: 'pending' }] as ResidentState['commitments'];
  const career = state.career;
  assert.equal(continueCareer(w, p, state), undefined);
  assert.equal(state.career, career);
  state.commitments![0].status = 'completed';
  assert.ok(continueCareer(w, p, state));
});

test('career reviews wait for a completed errand, survive reload and vary by resident', async () => {
  const { strategicReviewDue, reviewInterval } = await import('../src/server/npc/prosperity.ts');
  const { w, p, state } = setup();
  state.strategyReviewedAt = w.time;
  const period = reviewInterval(p.id);
  w.time += period - 1;
  assert.equal(strategicReviewDue(w, p, state), false);
  w.time++;
  assert.equal(strategicReviewDue(w, p, JSON.parse(JSON.stringify(state))), true);
  state.plan = [{ kind: 'travel', destination: 'market' }];
  assert.equal(strategicReviewDue(w, p, state), false, 'finish the accepted trip first');
  state.index = 1;
  assert.equal(strategicReviewDue(w, p, state), true);
  state.routine = 'care';
  assert.equal(strategicReviewDue(w, p, state), false);
  assert.ok(reviewInterval(p.id, 'employee') > period);
  assert.notEqual(reviewInterval('mabel'), reviewInterval('rowan'));
});
