// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { harbourSupply } from '../src/shared/harbour-supply.ts';
import { carePlan } from '../src/server/npc/care.ts';
import { enterpriseChoices, economicMenu, businessEstimate } from '../src/server/npc/enterprise.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { offlineReadiness, homecomingPlan } from '../src/server/npc/homecoming.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import type { Step } from '../src/server/npc/decision.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { World, Player } from '../src/shared/types.ts';
function run(w: World, p: Player, plan: Step[]) {
  for (const s of plan) {
    if (s.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === s.destination)!;
      p.x = b.x;
      p.z = b.z;
    }
    if (s.kind === 'act') act(w, p.id, s.action);
    if (s.kind === 'wait') advance(w, s.seconds);
  }
}
test('paid shortage shipments recover a drained parish without resetting stock, ownership or prices', () => {
  const w = createWorld('puddlewick', 'Town', 'server');
  const h = w.buildings.find((b) => b.kind === 'market')!;
  for (const b of w.buildings) {
    b.stock.water = 0;
    b.stock.bread = 0;
    b.stock.fuel = 0;
  }
  addPlayer(w, 'human', 'Human');
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = 'human';
  mill.buy.wheat = 123;
  mill.investment = 876;
  const capital = h.investment;
  harbourSupply(w, 1);
  assert.equal(h.stock.water, 6);
  assert.ok(h.investment < capital);
  assert.equal(
    w.ledger
      .filter((e) => e.reason.startsWith('shortage shipment'))
      .reduce((n, e) => n + e.amount, 0),
    capital - h.investment,
  );
  const snapshot = JSON.stringify(w);
  harbourSupply(w, 1799);
  assert.equal(JSON.stringify(w), snapshot);
  const local = makeBuilding('producer', 'waterworks', 0, 0);
  local.owner = 'human';
  local.stock.water = 100;
  w.buildings.push(local);
  h.stock.water = 0;
  harbourSupply(w, 1800);
  assert.equal(h.stock.water, 0, 'local supply prevents imports');
  assert.equal(mill.owner, 'human');
  assert.equal(mill.buy.wheat, 123);
  assert.equal(mill.investment, 876);
  w.owner = 'custom';
  local.stock.water = 0;
  harbourSupply(w, 3600);
  assert.equal(h.stock.water, 0);
});
test('urgent thirst wins over small hunger, alternatives and owned supplies are usable', () => {
  const w = createWorld('test', 'Town', 'owner');
  const p = addPlayer(w, 'npc', 'NPC');
  p.thirst = 50000;
  p.hunger = 26000;
  p.inventory = { bread: 3, water: 2 };
  assert.deepEqual(carePlan(w, p), [{ kind: 'act', action: { type: 'use', item: 'water' } }]);
  p.inventory = {};
  for (const b of w.buildings) b.stock = {};
  const port = w.buildings.find((b) => b.kind === 'starport')!;
  port.stock.tea = 2;
  p.cash = 100000;
  run(w, p, carePlan(w, p));
  assert.ok(p.thirst < 50000);
  assert.equal(port.stock.tea, 1);
  p.thirst = 50000;
  port.stock = {};
  const house = w.buildings.find((b) => b.kind === 'home')!;
  house.owner = p.id;
  house.stock.water = 3;
  run(w, p, carePlan(w, p));
  assert.ok(p.thirst < 50000);
  assert.equal(house.stock.water, 2);
});
test('zero AI budget still allows several meals without invoking a provider', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const w = createWorld('puddlewick', 'Town', 'server');
  let calls = 0;
  const residents = new Residents(
    store,
    universe,
    new Map([[w.id, w]]),
    [
      {
        config: npcConfigSchema.parse({ presence: 'always', activeAlone: true }),
        brain: {
          async decide(): Promise<never> {
            calls++;
            throw Error('No calls expected');
          },
        },
      },
    ],
    { dailyUsd: 0 },
  );
  try {
    const p = w.players[residents.status()[0].playerId];
    p.thirst = 50000;
    p.hunger = 48000;
    p.inventory = { water: 6, bread: 6 };
    let now = Date.now();
    for (let i = 0; i < 50; i++) {
      residents.tick(0.5, (now += 1000));
      await residents.settled();
    }
    assert.ok(p.thirst < 25000);
    assert.ok(p.hunger < 25000);
    assert.equal(calls, 0);
    assert.equal(p.online, true);
  } finally {
    residents.close();
    store.close();
  }
});
test('a purchased mill gets capital, input delivery, qualified work and a profitable output sale', () => {
  const w = createWorld('test', 'Town', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const owner = addPlayer(w, 'owner1', 'Owner');
  owner.cash = 2000000;
  owner.inventory = {};
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.stock = {};
  mill.investment = 0;
  const e = businessEstimate(w, mill)!;
  assert.ok(e.margin > 0);
  const purchase = enterpriseChoices(w, owner).find(
    (c) =>
      c.description.startsWith('Acquire and fund') &&
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'buyBuilding' && s.action.building === mill.id,
      ),
  )!;
  assert.ok(purchase);
  run(w, owner, purchase.plan);
  assert.equal(mill.owner, owner.id);
  assert.ok(mill.investment >= e.reserve);
  run(
    w,
    owner,
    enterpriseChoices(w, owner).find(
      (c) => c.description.startsWith('Supply my') && c.description.includes(mill.name),
    )!.plan,
  );
  const worker = addPlayer(w, 'worker', 'Worker');
  worker.skills = ['miller'];
  worker.cash = 50000;
  const job = enterpriseChoices(w, worker).find((c) =>
    c.plan.some(
      (s) => s.kind === 'act' && s.action.type === 'job' && s.action.building === mill.id,
    ),
  )!;
  assert.ok(job);
  run(w, worker, job.plan);
  assert.ok(mill.stock.flour >= 3);
  assert.ok(worker.cash > 50000);
  const before = owner.cash;
  run(
    w,
    owner,
    enterpriseChoices(w, owner).find(
      (c) => c.description.startsWith('Sell my output') && c.description.includes(mill.name),
    )!.plan,
  );
  assert.ok(owner.cash > before);
  assert.equal(owner.inventory.flour, 0);
});
test('menus remove impossible waits and bare business purchases; keep funded vacancies and housing', () => {
  const w = createWorld('test', 'Town', 'owner');
  const p = addPlayer(w, 'npc', 'NPC');
  p.cash = 2000000;
  p.skills = ['miller'];
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.job = mill.id;
  mill.employees = [p.id];
  mill.investment = 0;
  mill.stock = {};
  const state = { intent: '', plan: [], index: 0, notebook: '' } as unknown as ResidentState;
  const menu = economicMenu(w, p, adaptiveChoices(w, p, state), 'owner');
  assert.ok(menu.length <= 44);
  assert.ok(menu.some((c) => c.description.startsWith('Establish a home')));
  assert.ok(
    !menu.some(
      (c) =>
        /^(Keep my active job|Renew my shift)/.test(c.description) &&
        c.description.includes(mill.name),
    ),
  );
});
test('offline pantry planning accounts for repeated-food penalties and survives a full day', () => {
  const w = createWorld('test', 'Town', 'owner');
  const p = addPlayer(w, 'npc', 'NPC');
  p.cash = 1000000;
  p.inventory = {};
  const house = w.buildings.find((b) => b.kind === 'home')!;
  house.owner = p.id;
  house.stock = {};
  for (let i = 0; i < 60 && !offlineReadiness(w, p, 86400).stocked; i++)
    run(w, p, homecomingPlan(w, p, 86400));
  assert.equal(offlineReadiness(w, p, 86400).stocked, true);
  run(w, p, homecomingPlan(w, p, 86400));
  p.online = false;
  advance(w, 86400);
  assert.equal(p.deaths, 0);
  assert.ok(p.health > 0);
  assert.equal(house.owner, p.id);
});

test('public emergency imports remain payable when every store and the treasury are empty', () => {
  const w = createWorld('puddlewick', 'Town', 'server');
  const p = addPlayer(w, 'visitor', 'Visitor');
  const b = w.buildings.find((b) => b.kind === 'market' && b.government)!;
  for (const s of w.buildings) {
    s.stock.water = 0;
    s.stock.bread = 0;
  }
  b.investment = 0;
  p.x = b.x;
  p.z = b.z;
  p.cash = 100000;
  p.inventory.water = 0;
  const price = b.sell.water;
  const cash = p.cash;
  act(w, p.id, { type: 'trade', building: b.id, direction: 'buy', item: 'water', quantity: 3 });
  assert.equal(p.cash, cash - price * 3);
  assert.equal(p.inventory.water, 3);
  assert.equal(b.stock.water, 0);
  assert.ok(b.investment >= 0);
  p.thirst = 45000;
  p.inventory.water = 0;
  assert.ok(carePlan(w, p).some((s) => s.kind === 'act' && s.action.type === 'trade'));
  p.cash = 0;
  const before = JSON.stringify(b);
  assert.throws(
    () =>
      act(w, p.id, { type: 'trade', building: b.id, direction: 'buy', item: 'water', quantity: 1 }),
    /cash/,
  );
  assert.equal(JSON.stringify(b), before);
});
