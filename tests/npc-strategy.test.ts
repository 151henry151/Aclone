// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding, advance } from '../src/shared/simulation.ts';
import { items } from '../src/shared/catalog.ts';
import { lifeBriefing, careNeeded } from '../src/server/npc/strategy.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { jevInstructions, jevPayload } from '../src/server/npc/jev.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';
function fixture() {
  const w = createWorld('puddlewick', 'Parish', 'owner');
  const p = addPlayer(w, 'npc', 'Neighbour');
  const state = { intent: '', notebook: '', plan: [], index: 0 } as unknown as ResidentState;
  const run = (plan: Step[]) => {
    for (const s of plan) {
      if (s.kind === 'travel')
        Object.assign(
          p,
          (({ x, z }) => ({ x, z }))(w.buildings.find((b) => b.id === s.destination)!),
        );
      if (s.kind === 'act') act(w, p.id, s.action);
    }
  };
  return { w, p, state, run };
}
test('briefing forecasts live survival deadlines and the actual next meal penalty without mutation', () => {
  const { w, p } = fixture();
  w.settings.hungerRate = 10;
  w.settings.thirstRate = 20;
  p.hunger = 20000;
  p.thirst = 30000;
  p.inventory = { bread: 3, water: 2 };
  p.lastFood = 'bread';
  p.repeats = 1;
  const before = JSON.stringify(w);
  const brief = lifeBriefing(w, p);
  assert.equal(brief.survival.secondsToDamageOutside, 1000);
  assert.equal(
    brief.survival.carried.find((x) => x.item === 'bread')!.nextFood,
    items.bread.food! / 2,
  );
  assert.equal(JSON.stringify(w), before);
  assert.equal(careNeeded(w, p), true);
  w.settings.hungerRate = w.settings.thirstRate = 0;
  p.hunger = p.thirst = 0;
  assert.equal(lifeBriefing(w, p).survival.secondsToDamageOutside, null);
  assert.equal(careNeeded(w, p), false);
});
test('hungry residents can buy and eat varied food even when nearer shops are empty', () => {
  const { w, p, state, run } = fixture();
  p.inventory = {};
  p.hunger = 41000;
  p.thirst = 0;
  p.cash = 10000;
  w.buildings.forEach((b) => {
    b.stock = {};
    b.sell = { fish: 100 };
  });
  const shop = makeBuilding('distant', 'market', 200, 200);
  shop.stock = { fish: 10 };
  shop.sell = { fish: 100 };
  w.buildings.push(shop);
  const c = adaptiveChoices(w, p, state).find(
    (c) =>
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'fish',
      ) &&
      c.plan.some((s) => s.kind === 'act' && s.action.type === 'use' && s.action.item === 'fish'),
  );
  assert.ok(c, 'A single executable food errand must buy then eat');
  run(c.plan);
  assert.ok(p.hunger < 41000);
  assert.equal(p.cash, 9900, 'Urgent meal errands buy one serving, preserving cash for water');
});
test('owners get a complete funded input purchase and delivery plan, employees do not pay for employer inputs', () => {
  const { w, p, state, run } = fixture();
  p.cash = 200000;
  p.inventory = {};
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.stock.wheat = 0;
  const seller = w.buildings.find((b) => b.id !== mill.id && b.sell.wheat >= 0)!;
  seller.stock.wheat = 30;
  seller.sell.wheat = 600;
  const find = () =>
    adaptiveChoices(w, p, state).find(
      (c) =>
        c.description.startsWith('Supply my') &&
        c.plan.some(
          (s) => s.kind === 'act' && s.action.type === 'stock' && s.action.building === mill.id,
        ),
    );
  const c = find();
  assert.ok(c);
  run(c.plan);
  assert.ok(mill.stock.wheat >= 5);
  assert.equal(p.inventory.wheat, 0);
  mill.owner = 'someone';
  p.job = mill.id;
  assert.equal(find(), undefined);
});
test('selling or depositing surplus keeps carried meals and drinks available', () => {
  const { w, p, state } = fixture();
  p.inventory = { fish: 1, water: 2 };
  p.hunger = 30000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  for (const c of adaptiveChoices(w, p, state)) {
    assert.ok(
      !c.plan.some(
        (s) =>
          s.kind === 'act' &&
          'item' in s.action &&
          s.action.item === 'fish' &&
          ((s.action.type === 'stock' && s.action.direction === 'deposit') ||
            (s.action.type === 'trade' && s.action.direction === 'sell')),
      ),
      `Must not dispose of the last meal: ${c.description}`,
    );
  }
});
test('survival facts and learned results survive a crowded Jev request without extra model calls', () => {
  const { w, p } = fixture();
  const life = lifeBriefing(w, p);
  const body = jevPayload(
    {
      instructions: jevInstructions,
      observation: {
        life,
        lessons: [{ healthChange: -4000, cashChange: -600, goal: 'Rest' }],
        nearbyBuildings: 'x'.repeat(40000),
        choices: Array.from({ length: 200 }, (_, i) => ({
          id: String(i),
          description: 'Optional plan. '.repeat(100),
          plan: [{ kind: 'wait', seconds: 60 }],
        })),
      },
    },
    'test',
  );
  assert.deepEqual(body.state.life, life);
  assert.ok(body.state.lessons);
  assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 24000);
  assert.equal(Object.keys(body.questions.next_action.criteria).length, 200);
});
test('stocked shelter is distinguished from resting outside with dangerous needs', () => {
  const { w, p } = fixture();
  const b = makeBuilding('home', 'home', p.x, p.z);
  b.owner = p.id;
  b.stock = { bread: 20, water: 30 };
  w.buildings.push(b);
  p.atHome = true;
  p.home = b.id;
  p.hunger = p.thirst = 30000;
  assert.ok(lifeBriefing(w, p).survival.sheltered);
  advance(w, 1);
  assert.equal(careNeeded(w, p), false);
});
test('job briefing names real skill and net wages, and reports why a seemingly good job will not pay', () => {
  const { w, p } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.job = mill.id;
  mill.wage = 2200;
  mill.investment = 0;
  mill.stock.wheat = 0;
  w.settings.wageTax = 0.1;
  const job = lifeBriefing(w, p).economy.jobs[0];
  assert.equal(job.id, mill.id);
  assert.equal(job.netCashPerCycle, 1980);
  assert.equal(job.skill, 'miller');
  assert.ok(job.ownerCapitalShortfall > 0);
  assert.ok(job.blockers.some((b) => b.includes('wheat')));
});
test('need forecasting matches the simulation reaching starvation', () => {
  const { w, p } = fixture();
  w.settings.hungerRate = 10;
  w.settings.thirstRate = 20;
  p.hunger = 0;
  p.thirst = 40000;
  p.health = 60000;
  const seconds = lifeBriefing(w, p).survival.secondsToDamageOutside!;
  advance(w, seconds);
  assert.equal(p.health, 60000);
  assert.equal(p.thirst, 50000);
  advance(w, 1);
  assert.equal(p.health, 59994);
});
