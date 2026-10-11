// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { calendar, DAY_SECONDS } from '../src/shared/environment.ts';
import { crops, cropStatus } from '../src/shared/farming.ts';
import { defaults } from '../src/shared/catalog.ts';

const winter = (334 - 59 - defaults.time / 86400) * DAY_SECONDS;
function setup() {
  const w = createWorld('winter-farm', 'Winter farm', 'owner');
  w.settings.hungerRate = 0;
  w.settings.thirstRate = 0;
  const p = addPlayer(w, 'worker', 'Farmer');
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  b.owner = 'owner';
  b.employees = [p.id];
  b.investment = 100000;
  b.stock = { wheat: 10, hay: 20 };
  p.skills = ['farmer'];
  p.x = b.x;
  p.z = b.z;
  w.time = winter - 30;
  b.plots = Object.keys(crops).map((crop, i) => ({
    crop,
    planted: winter - 70 * DAY_SECONDS,
    ready: i % 2 ? winter + DAY_SECONDS : winter - DAY_SECONDS,
    water: 2,
    fertilized: true,
    drainage: true,
  }));
  return { w, p, b };
}

test('winter kills ripe and growing crops, preserves stored goods and plot drainage', () => {
  const { w, b } = setup();
  assert.equal(calendar(w).season, 'Autumn');
  advance(w, 29);
  assert.ok(b.plots!.every((plot) => plot.crop));
  const investment = b.investment;
  advance(w, 1);
  assert.equal(calendar(w).season, 'Winter');
  assert.ok(b.plots!.every((plot) => !plot.crop && plot.drainage));
  assert.deepEqual(b.stock, { wheat: 10, hay: 20 });
  assert.equal(b.investment, investment);
  assert.equal(cropStatus(w, b, 0).yield, 0);
});

test('winter losses persist through reload and catch-up into a later spring', () => {
  const { w, b } = setup();
  const restored = JSON.parse(JSON.stringify(w));
  advance(w, 100 * DAY_SECONDS);
  for (let i = 0; i < 100; i++) advance(restored, DAY_SECONDS);
  assert.equal(calendar(w).season, 'Spring');
  assert.deepEqual(b.plots, restored.buildings.find((v: any) => v.id === b.id).plots);
  assert.ok(b.plots!.every((plot) => !plot.crop));
  const p = w.players.worker;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', crop: 'wheat', plot: 0 });
  assert.equal(b.plots![0].crop, 'wheat');
  assert.equal(b.plots![0].drainage, true);
});

test('saved winter crops cannot be harvested, watered or fertilized before the first tick', () => {
  for (const operation of ['harvest', 'water', 'fertilize']) {
    const { w, p, b } = setup();
    w.time = winter;
    assert.equal(cropStatus(w, b, 0).yield, 0);
    assert.throws(
      () => act(w, p.id, { type: 'farm', building: b.id, operation, plot: 0 }),
      /winter|empty/i,
    );
    assert.equal(p.task, undefined);
  }
});

test('harvest finishing before winter succeeds during catch-up; at or after winter fails', () => {
  for (const finishOffset of [-1, 0, 1]) {
    const { w, p, b } = setup();
    w.time = winter + finishOffset - 15;
    const cash = p.cash;
    act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
    advance(w, 60);
    assert.equal(p.task, undefined);
    assert.equal(b.plots![0].crop, undefined);
    assert.equal(b.stock.wheat > 10, finishOffset < 0);
    assert.equal(p.cash > cash, finishOffset < 0);
  }
});

test('winter cancels an unfinished harvest immediately without paying or locking the worker', () => {
  const { w, p, b } = setup();
  w.time = winter - 5;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  advance(w, 5);
  assert.equal(p.task, undefined);
  assert.equal(b.plots![0].harvest, undefined);
  advance(w, 15);
  assert.equal(b.stock.wheat, 10);
});
