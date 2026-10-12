// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { travelPrep } from '../src/server/npc/travel.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { careerChoices, startCareer, continueCareer } from '../src/server/npc/projects.ts';
import { enterpriseChoices } from '../src/server/npc/enterprise.ts';
import { capitalChoices } from '../src/server/npc/prosperity.ts';
import {
  recordBusinessFreight,
  settleBusinessProceeds,
} from '../src/server/npc/business-freight.ts';
import { productionBudget } from '../src/server/npc/business-policy.ts';
import { constructionBudget } from '../src/server/npc/construction-projects.ts';
import { pickBuildSite } from '../src/server/npc/chains.ts';
import { homecomingPlan } from '../src/server/npc/homecoming.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { strandedCargo } from '../src/server/npc/cargo.ts';
import { Navigator } from '../src/server/npc/navigation.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Action } from '../src/shared/types.ts';
function setup() {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'p', 'P');
  p.cash = 5_000_000;
  p.inventory = {};
  p.hunger = p.thirst = 0;
  const s = {
    world: w.id,
    playerId: p.id,
    plan: [],
    index: 0,
    intent: '',
    notebook: '',
    observedDeaths: 0,
  } as unknown as ResidentState;
  return { w, p, s };
}
test('unsupported vehicle recovers before a ground journey, including after saved-state reload', () => {
  const { w, p } = setup();
  p.vehicle = 8;
  p.fuel = 20;
  p.engine = true;
  const steps = travelPrep(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(steps, [{ kind: 'act', action: { type: 'vehicle', slot: 0 } }]);
  for (const step of steps) if (step.kind === 'act') act(w, p.id, step.action);
  assert.equal(p.vehicle, 0);
  assert.equal(new Navigator(w, p, { x: 20, z: 20 }, 3).step(w, p, 0.1).error, undefined);
  p.vehicle = 8;
  p.fuel = 0;
  assert.deepEqual(travelPrep(p), [{ kind: 'act', action: { type: 'vehicle', slot: 5 } }]);
});
test('NPC menu excludes unsupported vehicles and offers one affordable cottage design, not six duplicates', () => {
  const { w, p, s } = setup();
  const menu = adaptiveChoices(w, p, s);
  assert.equal(menu.filter((c) => c.description.startsWith('Build Small cottage')).length, 1);
  assert.ok(
    !menu.some((c) =>
      c.plan.some(
        (step) =>
          step.kind === 'operation' &&
          step.operation === 'vehicle' &&
          step.parameters.some((v) => v.name === 'slot' && v.value !== 0 && v.value !== 5),
      ),
    ),
  );
  assert.equal(capitalChoices(w, p).length, 0, 'already wealthy: no pointless tiny withdrawals');
});
test('a chosen cottage project survives care interruption and has executable material deliveries', () => {
  const { w, p, s } = setup();
  const choice = adaptiveChoices(w, p, s).find((c) =>
    c.description.startsWith('Build Small cottage'),
  )!;
  for (const step of choice.plan) {
    if (step.kind === 'move') Object.assign(p, { x: step.x, z: step.z });
    else if (step.kind === 'act') act(w, p.id, step.action);
    else if (step.kind === 'operation') act(w, p.id, operationAction(step));
  }
  const site = w.buildings.find((b) => b.owner === p.id && b.construction)!;
  assert.ok(site);
  startCareer(w, p, s, { kind: 'housing', target: site.id });
  const reload = JSON.parse(JSON.stringify(s));
  p.hunger = p.thirst = 0;
  const next = continueCareer(w, p, reload, enterpriseChoices(w, p));
  assert.ok(next && next.careerGoal?.target === site.id);
  assert.ok(
    homecomingPlan(w, p, 86400, reload).length,
    'logout preparation finishes existing housing',
  );
  const cash = p.cash;
  for (let n = 0; site.construction && n < 30; n++) {
    const delivery = continueCareer(w, p, reload, enterpriseChoices(w, p));
    assert.ok(delivery, 'the accepted foundation still has a next material delivery');
    for (const step of delivery.plan) {
      if (step.kind === 'travel') {
        const b = w.buildings.find((b) => b.id === step.destination)!;
        assert.ok(b);
        Object.assign(p, { x: b.x, z: b.z });
      } else if (step.kind === 'move') Object.assign(p, { x: step.x, z: step.z });
      else if (step.kind === 'act') act(w, p.id, step.action);
      else if (step.kind === 'operation') act(w, p.id, operationAction(step));
    }
  }
  assert.equal(
    site.construction,
    undefined,
    'ordinary purchases and deliveries complete the house',
  );
  assert.ok(p.cash < cash, 'materials were paid for, not granted');
});
test('cash raised for housing stops at the costed goal and preserves operating reserves', () => {
  const { w, p } = setup(),
    b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.investment = 2_000_000;
  p.cash = 5000;
  const quote = constructionBudget(w, p, 'home', pickBuildSite(w, p, 'home')!)!;
  const choice = capitalChoices(w, p)[0];
  assert.ok(choice);
  const a = choice.plan.find((s) => s.kind === 'act' && s.action.type === 'investment')!;
  assert.ok(a.kind === 'act' && a.action.type === 'investment');
  assert.equal(a.action.amount, quote.total - p.cash);
  Object.assign(p, { x: b.x, z: b.z });
  act(w, p.id, a.action);
  assert.equal(capitalChoices(w, p).length, 0);
});
test('export proceeds return in full to their owner business after changed quotes and interrupted plans', () => {
  const { w, p, s } = setup(),
    b = w.buildings.find((b) => b.kind === 'bakery')!,
    buyer = w.buildings.find((b) => b.kind === 'starport')!;
  b.owner = p.id;
  b.stock.bread = 20;
  b.investment = 100000;
  buyer.investment = 1_000_000;
  buyer.stock.bread = 0;
  function perform(a: Action) {
    const before = structuredClone(w);
    act(w, p.id, a);
    recordBusinessFreight(before, w, p, s, a);
  }
  Object.assign(p, { x: b.x, z: b.z });
  perform({ type: 'stock', building: b.id, item: 'bread', quantity: 10, direction: 'withdraw' });
  buyer.buy.bread = 5000;
  Object.assign(p, { x: buyer.x, z: buyer.z });
  perform({ type: 'trade', building: buyer.id, item: 'bread', quantity: 10, direction: 'sell' });
  assert.equal(s.businessProceeds?.[b.id], 50000);
  const saved = JSON.parse(JSON.stringify(s));
  const settle = settleBusinessProceeds(w, p, saved);
  const step = settle.find((s) => s.kind === 'act')!;
  assert.equal(
    step.kind === 'act' && step.action.type === 'investment' && step.action.amount,
    50000,
  );
  Object.assign(p, { x: b.x, z: b.z });
  const before = structuredClone(w);
  if (step.kind === 'act') {
    act(w, p.id, step.action);
    recordBusinessFreight(before, w, p, saved, step.action);
  }
  assert.equal(b.investment, 150000);
  assert.equal(saved.businessProceeds[b.id], 0);
  assert.deepEqual(settleBusinessProceeds(w, p, saved), []);
});
test('active workers do not repeatedly ask to renew a covered production cycle', () => {
  const { w, p, s } = setup(),
    b = w.buildings.find((b) => b.kind === 'mill')!;
  p.skills = ['miller'];
  b.investment = 100000;
  b.stock.wheat = 50;
  Object.assign(p, { x: b.x, z: b.z });
  act(w, p.id, { type: 'job', building: b.id });
  assert.ok(
    !careerChoices(w, p, s).some(
      (c) => c.careerGoal?.kind === 'employment' && c.careerGoal.target === b.id,
    ),
  );
  advance(w, 1300);
  assert.ok(
    careerChoices(w, p, s).some(
      (c) => c.careerGoal?.kind === 'employment' && c.careerGoal.target === b.id,
    ),
  );
});
test('waterworks estimate explicitly includes its ideal crew', () => {
  const { w } = setup();
  const b = makeBuilding('pump', 'waterworks', 50, 50);
  w.buildings.push(b);
  const budget = productionBudget(w, b)!;
  assert.ok(budget.idealMargin > 0);
  assert.equal(budget.idealWorkers, 2);
});

test('obsolete heavy vehicles unload through ordinary actions before returning to a supported tractor', () => {
  const { w, p } = setup();
  p.vehicle = 8;
  p.fuel = 100;
  p.inventory = { stone: 180 };
  for (const b of w.buildings) b.x = 9999;
  const steps = strandedCargo(p, w);
  assert.ok(steps.length);
  for (const step of steps) if (step.kind === 'act') act(w, p.id, step.action);
  for (const step of travelPrep(p)) if (step.kind === 'act') act(w, p.id, step.action);
  assert.equal(p.vehicle, 0);
  assert.ok(p.inventory.stone < 180);
});
test('farm export loads can exceed 100d and return the whole receipt to working capital', async () => {
  const { farmEnterprises } = await import('../src/server/npc/farm-enterprise.ts');
  const { w, p } = setup();
  const farm = w.buildings.find((b) => b.kind === 'farm')!,
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  farm.owner = p.id;
  farm.stock = { wheat: 20 };
  mill.buy.wheat = 2000;
  mill.stock.wheat = 0;
  mill.investment = 1000000;
  for (const b of w.buildings) if (b !== mill) b.buy.wheat = 0;
  const choice = farmEnterprises(w, p).find((c) => c.description.startsWith('Sell my output'))!;
  assert.ok(choice);
  const sale = choice.plan.find((s) => s.kind === 'act' && s.action.type === 'trade')!;
  assert.ok(sale.kind === 'act' && sale.action.type === 'trade');
  assert.equal(sale.action.quantity, 20);
  const capital = farm.investment;
  for (const s of choice.plan) {
    if (s.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === s.destination)!;
      Object.assign(p, { x: b.x, z: b.z });
    } else if (s.kind === 'act') act(w, p.id, s.action);
  }
  assert.equal(mill.stock.wheat, 20);
  assert.equal(farm.investment, capital + 40000);
});
