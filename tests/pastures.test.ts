// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { defaultCreator } from '../src/shared/creator';
import { ensurePastures, pastureBlocker } from '../src/shared/pastures';
import {
  pastureCapacity,
  pasturePoint,
  inPasture,
  pastureFences,
} from '../src/shared/pasture-land';
import { onFarmLand } from '../src/shared/farm-land';
import { landscapeBlocks } from '../src/shared/landscape';
import { livestockOutputs } from '../src/shared/livestock';
import { livestockSites } from '../src/client/livestock-scene';
import { grazingPose } from '../src/client/pasture-motion';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('pasture', 'Pasture', 'owner');
  w.creator = defaultCreator();
  w.creator.roads = false;
  w.terrain = [];
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'owner', 'Keeper');
  p.cash = 1000000;
  p.skills = ['livestock farmer'];
  const b = makeBuilding('barn', 'dairy', 0, 0);
  b.owner = p.id;
  b.stock = { cows: 2, feed: 100, water: 100 };
  b.investment = 100000;
  w.buildings = [b];
  ensurePastures(w);
  assert.ok(b.pasture);
  return { w, p, b };
}
test('safe pasture migration is idempotent and preserves animals, cash and existing property', () => {
  const { w, b, p } = setup();
  const before = JSON.stringify(b.pasture);
  ensurePastures(w);
  assert.equal(JSON.stringify(b.pasture), before);
  assert.equal(b.stock.cows, 2);
  assert.equal(p.cash, 1000000);
  assert.equal(pastureCapacity(b), 4);
  const q = pasturePoint(b, b.pasture!.x, b.pasture!.z);
  assert.ok(onFarmLand(w, q.x, q.z));
  const store = new Store(':memory:');
  store.saveWorld(w);
  const copy = store.loadWorlds()[0].world;
  store.db.close();
  assert.deepEqual(copy.buildings[0].pasture, b.pasture);
});
test('pasture expansion charges once, reserves real land and rejects occupied adjoining parcels', () => {
  const { w, b, p } = setup();
  const cash = p.cash;
  act(w, p.id, { type: 'livestock', building: b.id, operation: 'expand' });
  assert.equal(b.pasture!.parcels, 2);
  assert.equal(p.cash, cash - 25000);
  assert.equal(pastureCapacity(b), 8);
  const next = pasturePoint(b, b.pasture!.x + 32, b.pasture!.z);
  w.buildings.push(makeBuilding('obstacle', 'home', next.x, next.z));
  assert.throws(
    () => act(w, p.id, { type: 'livestock', building: b.id, operation: 'expand' }),
    /property|building/,
  );
  assert.equal(b.pasture!.parcels, 2);
  assert.equal(p.cash, cash - 25000);
  const stranger = addPlayer(w, 'other', 'Other');
  assert.throws(() =>
    act(w, stranger.id, { type: 'livestock', building: b.id, operation: 'expand' }),
  );
});
test('deposits, purchase bids and breeding cannot bypass pasture capacity or reserved offspring space', () => {
  const { w, b, p } = setup();
  p.inventory.cows = 10;
  act(w, p.id, { type: 'stock', building: b.id, item: 'cows', quantity: 1, direction: 'deposit' });
  act(w, p.id, { type: 'livestock', building: b.id, operation: 'breed' });
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'stock',
        building: b.id,
        item: 'cows',
        quantity: 1,
        direction: 'deposit',
      }),
    /grazing/,
  );
  const q = addPlayer(w, 'seller', 'Seller');
  q.inventory.cows = 1;
  assert.throws(
    () =>
      act(w, q.id, { type: 'trade', building: b.id, item: 'cows', quantity: 1, direction: 'sell' }),
    /grazing/,
  );
  delete b.breedingEnd;
  b.stock.cows = 4;
  assert.throws(
    () => act(w, p.id, { type: 'livestock', building: b.id, operation: 'breed' }),
    /grazing/,
  );
  assert.equal(q.inventory.cows, 1);
  assert.equal(p.inventory.cows, 9);
});
test('larger fed herds yield more, consume more and respect output storage capacity', () => {
  const { w, b, p } = setup();
  w.settings.activeWork = false;
  b.stock.cows = 4;
  // A paid qualified worker makes the production comparison independent of owner operation.
  const worker = addPlayer(w, 'worker', 'Worker');
  worker.skills = ['livestock farmer'];
  act(w, worker.id, { type: 'job', building: b.id });
  advance(w, 600);
  assert.equal(b.stock.milk, 12);
  assert.equal(b.stock.feed, 96);
  assert.equal(b.stock.water, 96);
  b.stock.milk = b.capacity - 1;
  advance(w, 600);
  assert.equal(b.stock.milk, b.capacity - 1);
  assert.equal(b.stock.feed, 92);
  b.stock.cows = 50;
  assert.equal(
    livestockOutputs(b, { milk: 6 }).milk,
    12,
    'legacy excess animals do not get free output',
  );
});
test('animals move and graze within rotated fences and keep continuity across route cycles', () => {
  const { w, b, p } = setup();
  b.rotation = 0.7;
  const sites = livestockSites(w, p);
  assert.equal(sites.length, 2);
  for (const site of sites) {
    let travelled = 0,
      last = grazingPose(site, 0),
      walk = false,
      graze = false;
    for (let t = 0.1; t < 300; t += 0.1) {
      const pose = grazingPose(site, t);
      assert.ok(inPasture(b, pose.x, pose.z, -1.5));
      const distance = Math.hypot(pose.x - last.x, pose.z - last.z);
      assert.ok(distance < 0.2);
      travelled += distance;
      walk ||= pose.walk > 0.5;
      graze ||= pose.graze > 0.5;
      last = pose;
    }
    assert.ok(travelled > 10);
    assert.ok(walk && graze);
  }
  const rail = pastureFences([b])[0],
    mid = { x: (rail.a.x + rail.b.x) / 2, z: (rail.a.z + rail.b.z) / 2 };
  const normal = { x: Math.cos(b.rotation), z: -Math.sin(b.rotation) };
  // Fence collision uses the same geometry as rendering (test an unequivocal crossing).
  const dx = rail.b.x - rail.a.x,
    dz = rail.b.z - rail.a.z,
    l = Math.hypot(dx, dz);
  assert.ok(
    landscapeBlocks(
      w,
      { x: mid.x - dz / l, z: mid.z + dx / l, y: 0 },
      { x: mid.x + dz / l, z: mid.z - dx / l, y: 0 },
      0.1,
      false,
    ),
  );
});
test('world rules bound capacity and price; water and obstacles cannot be purchased as pasture', () => {
  const { w, b, p } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { pastureCapacityMultiplier: 2, pasturePriceMultiplier: 2 },
  });
  assert.equal(pastureCapacity(b, w.settings.pastureCapacityMultiplier), 8);
  assert.throws(() =>
    act(w, p.id, { type: 'settings', patch: { pastureCapacityMultiplier: 100 } }),
  );
  const before = p.cash;
  act(w, p.id, { type: 'livestock', building: b.id, operation: 'expand' });
  assert.equal(before - p.cash, 50000);
  assert.ok(pastureBlocker(w, b, { x: 0, z: 1500, parcels: 1 }));
});

test('pasture designs export and import with rules and cannot be assigned to non-livestock buildings', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, b } = setup();
  w.settings.pastureCapacityMultiplier = 2;
  const design = exportDesign(w),
    copy = createWorld('copy', 'Copy', 'owner');
  applyDesign(copy, design);
  assert.deepEqual(copy.buildings[0].pasture, b.pasture);
  assert.equal(copy.settings.pastureCapacityMultiplier, 2);
  design.buildings[0].kind = 'home';
  assert.throws(() => applyDesign(createWorld('bad', 'Bad', 'owner'), design), /livestock/);
});
