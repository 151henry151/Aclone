// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import {
  stakeClaim,
  operatingReserve,
  collectableReturn,
  migrateOutsideClaims,
  ownerWithdrawable,
} from '../src/shared/stakes';
import { Store } from '../src/server/store';
function fixture() {
  const w = createWorld('investment-rules', 'Investments', 'owner'),
    p = addPlayer(w, 'owner', 'Investor'),
    b = makeBuilding('shop', 'market', 0, 0);
  w.script = '';
  b.owner = 'neighbour';
  b.government = false;
  b.recipe = undefined;
  b.wage = 0;
  b.buy = {};
  b.investment = 0;
  w.buildings = [b];
  Object.assign(p, { x: 0, z: 0, cash: 1000000 });
  const deposit = (amount: number) =>
    act(w, p.id, { type: 'investment', building: b.id, direction: 'deposit', amount });
  const collect = (amount: number) =>
    act(w, p.id, { type: 'investment', building: b.id, direction: 'withdraw', amount });
  return { w, p, b, deposit, collect };
}
test('outside investment defaults preserve 8% and the 20d minimum reserve without migration', () => {
  const { w, b } = fixture();
  assert.equal(w.settings.outsideReturnPercent, 8);
  assert.equal(w.settings.outsideOperatingReserve, 2000);
  delete w.settings.outsideReturnPercent;
  delete w.settings.outsideOperatingReserve;
  assert.equal(stakeClaim(10000, w), 10800);
  assert.equal(operatingReserve(w, b), 2000);
});
test('new deposits quote the live return while existing claims and top-ups keep agreed totals through reload', () => {
  const { w, p, b, deposit } = fixture();
  act(w, p.id, { type: 'settings', patch: { outsideReturnPercent: 25 } });
  deposit(10000);
  assert.equal(b.stakes![0].claim, 12500);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal(store.loadWorlds()[0].world.buildings[0].stakes![0].claim, 12500);
    act(w, p.id, { type: 'settings', patch: { outsideReturnPercent: 10.5 } });
    assert.equal(b.stakes![0].claim, 12500);
    deposit(10000);
    assert.equal(b.stakes![0].principal, 20000);
    assert.equal(b.stakes![0].claim, 23550);
    assert.equal(ownerWithdrawable(w, b), 0);
    store.saveWorld(w);
    assert.equal(store.loadWorlds()[0].world.buildings[0].stakes![0].claim, 23550);
  } finally {
    store.close();
  }
});
test('legacy launch claims retain their historical repair even with a configured new return', () => {
  const { w, b } = fixture();
  w.settings.outsideReturnPercent = 40;
  b.stakes = [{ investor: 'old', principal: 10000, claim: 12500, paid: 100, opened: 0 }];
  migrateOutsideClaims(w);
  assert.equal(b.stakes[0].claim, 10800);
});
test('configured reserve protects operating cash and zero return or floor remain valid', () => {
  const { w, p, b, deposit, collect } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: { outsideOperatingReserve: 9000, outsideReturnPercent: 0 },
  });
  deposit(5000);
  assert.equal(b.stakes![0].claim, 5000);
  assert.equal(collectableReturn(w, b, p.id), 0);
  b.investment = 9000;
  assert.equal(collectableReturn(w, b, p.id), 0);
  assert.throws(() => collect(1), /return|earn/);
  b.investment = 10000;
  assert.equal(collectableReturn(w, b, p.id), 1000);
  collect(1000);
  assert.equal(b.investment, 9000);
  act(w, p.id, { type: 'settings', patch: { outsideOperatingReserve: 0 } });
  assert.equal(operatingReserve(w, b), 0);
  assert.equal(collectableReturn(w, b, p.id), 3000);
});
test('investment rules validate, appear in creation/editor and summary, and round-trip designs', async () => {
  const { w, p } = fixture();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of ['outsideReturnPercent', 'outsideOperatingReserve'])
    assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { outsideReturnPercent: -1 },
    { outsideReturnPercent: 101 },
    { outsideOperatingReserve: -1 },
    { outsideOperatingReserve: 0.5 },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.deepEqual(w.settings, before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: { outsideReturnPercent: 12.5, outsideOperatingReserve: 8765 },
  });
  assert.match(rulesSummary(w), /12.5%/);
  assert.match(rulesSummary(w), /8765/);
  const dest = createWorld('dest', 'Destination', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.equal(dest.settings.outsideReturnPercent, 12.5);
  assert.equal(dest.settings.outsideOperatingReserve, 8765);
});
