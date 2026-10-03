// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { productionReport } from '../src/shared/reports.ts';
import { migrateEconomy } from '../src/shared/economy.ts';
import { enterpriseChoices } from '../src/server/npc/enterprise.ts';
function setup() {
  const w = createWorld('herd', 'Herd', 'owner'),
    p = addPlayer(w, 'worker', 'Worker'),
    owner = addPlayer(w, 'owner', 'Owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const b = makeBuilding('barn', 'dairy', 0, 0);
  b.owner = owner.id;
  b.investment = 100000;
  b.stock = { cows: 2, feed: 20, water: 20 };
  w.buildings = [b];
  p.x = p.z = 0;
  p.skills = ['livestock farmer'];
  act(w, p.id, { type: 'job', building: b.id });
  return { w, p, b, owner };
}
test('staffed dairy consumes upkeep once and produces milk without consuming cattle', () => {
  const { w, p, b } = setup(),
    cash = p.cash;
  advance(w, 600);
  assert.equal(b.stock.milk, 6);
  assert.equal(b.stock.cows, 2);
  assert.equal(b.stock.feed, 18);
  assert.equal(b.stock.water, 18);
  assert.ok(p.cash > cash);
  assert.equal(b.accounts?.consumed.feed, 2);
});
test('full and unattended dairies still incur upkeep, neglect harms cattle, and caretakers can recover', () => {
  const { w, b } = setup();
  b.stock.milk = b.capacity;
  advance(w, 600);
  assert.equal(b.stock.feed, 18);
  assert.equal(b.stock.milk, b.capacity);
  b.stock.feed = b.stock.water = 0;
  advance(w, 600 * 13);
  assert.equal(b.stock.cows, 1);
  assert.match(w.players.owner.history!.at(-1)!.text, /cow died/);
  assert.match(productionReport(w, b).join(' '), /Two cows/);
  b.stock.cows = 2;
  b.herdCondition = 36;
  b.stock.feed = b.stock.water = 20;
  b.stock.milk = 0;
  w.players.worker.activeUntil = w.time + 1200;
  advance(w, 600);
  assert.equal(b.herdCondition, 40);
  assert.equal(b.stock.milk, 6);
});
test('livestock catch-up matches sequential checks and public quote migration preserves owned shops', () => {
  const { w, b } = setup(),
    copy = structuredClone(w);
  advance(w, 18000);
  for (let i = 0; i < 30; i++) advance(copy, 600);
  assert.deepEqual(b.stock, copy.buildings[0].stock);
  assert.equal(b.herdCondition, copy.buildings[0].herdCondition);
  const market = makeBuilding('m', 'market', 0, 0);
  market.buy = {};
  market.sell = {};
  market.owner = 'owner';
  w.buildings.push(market);
  migrateEconomy(w);
  assert.deepEqual(market.buy, {});
  assert.deepEqual(market.sell, {});
});
test('a dairy owner can choose an ordinary buy-and-deliver plan for missing cattle', () => {
  const { w, b, owner } = setup();
  b.stock = { feed: 20, water: 20 };
  owner.cash = 1000000;
  const market = makeBuilding('market', 'market', 20, 0);
  market.investment = 1000000;
  market.stock.cows = 10;
  w.buildings.push(market);
  assert.ok(
    enterpriseChoices(w, owner).some(
      (c) =>
        c.plan.some(
          (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'cows',
        ) &&
        c.plan.some(
          (s) => s.kind === 'act' && s.action.type === 'stock' && s.action.item === 'cows',
        ),
    ),
  );
});
test('healthy herd breeding produces replacement cattle and reserves the breeding pair from shop sales', () => {
  const { w, b, p, owner } = setup();
  owner.skills = ['livestock farmer'];
  owner.x = owner.z = 0;
  b.stock.feed = b.stock.water = 100;
  p.activeUntil = w.time + 7200;
  act(w, owner.id, { type: 'livestock', operation: 'breed', building: b.id });
  assert.equal(b.stock.feed, 96);
  assert.throws(
    () => act(w, owner.id, { type: 'livestock', operation: 'breed', building: b.id }),
    /already/,
  );
  advance(w, 3600);
  assert.equal(b.stock.cows, 3);
  assert.equal(b.breedingEnd, undefined);
  p.cash = 100000;
  act(w, p.id, { type: 'trade', building: b.id, direction: 'buy', item: 'cows', quantity: 1 });
  assert.equal(b.stock.cows, 2);
  assert.throws(
    () =>
      act(w, p.id, { type: 'trade', building: b.id, direction: 'buy', item: 'cows', quantity: 1 }),
    /breeding cows/,
  );
});

test('new public livestock quotes migrate once without replacing operator prices or stock', () => {
  const { w } = setup();
  delete w.livestockPricing;
  const publicShop = makeBuilding('port', 'market', 40, 0);
  publicShop.owner = 'treasury';
  publicShop.government = true;
  publicShop.buy = { water: 123, milk: 42 };
  publicShop.sell = { water: 999 };
  publicShop.stock = { water: 3 };
  w.buildings.push(publicShop);
  migrateEconomy(w);
  assert.equal(publicShop.buy.milk, 42);
  assert.equal(publicShop.buy.water, 123);
  assert.ok(publicShop.sell.milk > 0);
  assert.deepEqual(publicShop.stock, { water: 3 });
  delete publicShop.sell.milk;
  migrateEconomy(w);
  assert.equal(publicShop.sell.milk, undefined);
});
