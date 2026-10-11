// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation.ts';
import { farmPlotCount, farmExpansionCost, farmPlotPosition } from '../src/shared/farm-land.ts';
import { herdRation, tendHerd } from '../src/shared/livestock.ts';
import { productionReport } from '../src/shared/reports.ts';
import { productionActivity } from '../src/shared/sound-state.ts';
import { migrateEconomy } from '../src/shared/economy.ts';
import { crops } from '../src/shared/farming.ts';

function setup(kind = 'farm') {
  const w = createWorld('hay', 'Hay', 'owner');
  const p = addPlayer(w, 'owner', 'Farmer');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const b = makeBuilding('test', kind, 150, -140);
  w.buildings = [b];
  b.owner = p.id;
  b.investment = 100000;
  p.cash = 1000000;
  p.skills = ['farmer', 'livestock farmer'];
  p.x = b.x;
  p.z = b.z;
  return { w, p, b };
}
test('farm land purchase expands usable saved plots, costs cash and cannot be repeated past the cap', () => {
  const { w, p, b } = setup();
  const cost = farmExpansionCost(b),
    cash = p.cash;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' });
  assert.equal(farmPlotCount(b), 8);
  assert.equal(p.cash, cash - cost);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', crop: 'hay', plot: 7 });
  const saved = JSON.parse(JSON.stringify(w));
  assert.equal(farmPlotCount(saved.buildings[0]), 8);
  assert.equal(saved.buildings[0].plots[7].crop, 'hay');
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', crop: 'hay', plot: 8 }),
    /plot/,
  );
  act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' });
  act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' });
  const finalCash = p.cash;
  assert.equal(farmPlotCount(b), 16);
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' }),
    /maximum/,
  );
  assert.equal(p.cash, finalCash);
});
test('expansion rejects another owner, occupied land, flooded land and inadequate funds without charging', () => {
  for (const reason of ['owner', 'occupied', 'water', 'cash']) {
    const { w, p, b } = setup();
    if (reason === 'owner') b.owner = 'other';
    if (reason === 'cash') p.cash = 0;
    if (reason === 'water') w.settings.seaLevel = 100;
    if (reason === 'occupied') {
      const point = farmPlotPosition(b, 4);
      w.buildings.push(makeBuilding('neighbour', 'home', point.x, point.z));
    }
    const cash = p.cash;
    assert.throws(() => act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' }));
    assert.equal(farmPlotCount(b), 4);
    assert.equal(p.cash, cash);
  }
});
test('hay grows, harvests to farm stock and trades through a funded barn to a dairy', () => {
  const { w, p, b } = setup();
  b.stock = {};
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', crop: 'hay', plot: 0 });
  advance(w, b.plots![0].ready - w.time);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  advance(w, 15);
  assert.ok(b.stock.hay > 10);
  assert.ok(crops.hay.days < crops.wheat.days);
  act(w, p.id, { type: 'stock', building: b.id, item: 'hay', quantity: 5, direction: 'withdraw' });
  const barn = makeBuilding('hay-barn', 'haybarn', p.x + 10, p.z);
  barn.investment = 100000;
  w.buildings.push(barn);
  act(w, p.id, { type: 'trade', building: barn.id, item: 'hay', quantity: 5, direction: 'sell' });
  assert.equal(barn.stock.hay, 5);
  act(w, p.id, { type: 'trade', building: barn.id, item: 'hay', quantity: 5, direction: 'buy' });
  const dairy = makeBuilding('dairy', 'dairy', p.x, p.z + 10);
  dairy.owner = p.id;
  dairy.stock = { cows: 2, water: 10 };
  w.buildings.push(dairy);
  act(w, p.id, {
    type: 'stock',
    building: dairy.id,
    item: 'hay',
    quantity: 5,
    direction: 'deposit',
  });
  assert.equal(tendHerd(w, dairy, 1), true);
  assert.equal(dairy.stock.hay, 3);
  assert.equal(dairy.accounts?.consumed.hay, 2);
});
test('hay and feed mix without double charging; cattle and sheep produce but pigs and hens still need feed', () => {
  for (const [kind, animal, count] of [
    ['dairy', 'cows', 2],
    ['sheepfold', 'sheep', 2],
    ['piggery', 'pigs', 2],
    ['henhouse', 'chickens', 4],
  ] as const) {
    const { w, p, b } = setup(kind);
    b.stock = { [animal]: count, hay: 20, water: 20 };
    const herbivore = ['dairy', 'sheepfold'].includes(kind);
    b.owner = 'someone';
    act(w, p.id, { type: 'job', building: b.id });
    assert.equal(productionActivity(w, b) > 0, herbivore);
    advance(w, 600);
    assert.equal(b.stock.hay, herbivore ? 18 : 20);
    if (herbivore) {
      assert.ok(!productionReport(w, b).some((s) => /Missing .*feed/.test(s)));
      assert.equal(b.stock[kind === 'dairy' ? 'milk' : 'wool'], kind === 'dairy' ? 6 : 4);
      b.stock.hay = 1;
      b.stock.feed = 10;
      assert.deepEqual(herdRation(b), { hay: 1, feed: 1, water: 2 });
      assert.ok(tendHerd(w, b, 1));
      assert.equal(b.stock.feed, 9);
    } else assert.ok(b.herdCondition! < 100);
  }
});
test('hay quote migration is additive, once only, without free stock or overwriting owned prices', () => {
  const { w, b } = setup('dairy');
  delete w.hayPricing;
  b.buy.hay = 123;
  const farm = makeBuilding('farm', 'farm', 0, 0);
  delete farm.sell.hay;
  w.buildings.push(farm);
  const stock = structuredClone(b.stock);
  migrateEconomy(w);
  assert.equal(b.buy.hay, 123);
  assert.ok(farm.sell.hay > 0);
  assert.deepEqual(b.stock, stock);
  delete farm.sell.hay;
  migrateEconomy(w);
  assert.equal(farm.sell.hay, undefined);
});

test('hay breeding consumes the chosen ration once and upkeep matches offline catch-up', () => {
  const { w, p, b } = setup('dairy');
  b.stock = { cows: 2, hay: 80, feed: 20, water: 100 };
  act(w, p.id, { type: 'livestock', building: b.id, operation: 'breed' });
  assert.equal(b.stock.hay, 76);
  assert.equal(b.stock.feed, 20);
  const copy = structuredClone(w);
  advance(w, 3600);
  for (let i = 0; i < 6; i++) advance(copy, 600);
  assert.deepEqual(b.stock, copy.buildings[0].stock);
  assert.equal(b.stock.cows, 3);
});
test('purchased fields block building construction, respect roads and remain driveable', () => {
  const { w, p, b } = setup();
  const centre = farmPlotPosition(b, 4);
  w.roads = [
    { a: { x: centre.x - 20, z: centre.z }, b: { x: centre.x + 20, z: centre.z }, width: 5 },
  ];
  assert.throws(() => act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' }), /road/);
  w.roads = [];
  act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' });
  p.x = centre.x;
  p.z = centre.z;
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /farmland/);
});
