// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { herdNeeds, livestockOutputs, herdReady } from '../src/shared/livestock';
import { trailerAccepts, trailerAction, type Trailer } from '../src/shared/trailers';
import { Store } from '../src/server/store';
import { productionReport } from '../src/shared/reports';
function farm(kind = 'dairy', animal = 'cows', count = 2) {
  const w = createWorld('young-herd', 'Young herd', 'owner');
  w.zones = [];
  w.towns = [];
  w.roads = [];
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, activeWork: false, maxAge: 100000 });
  const owner = addPlayer(w, 'owner', 'Owner'),
    worker = addPlayer(w, 'worker', 'Worker');
  owner.skills = worker.skills = ['livestock farmer'];
  const b = makeBuilding('farm', kind, 100, 100);
  b.owner = owner.id;
  b.investment = 100000000;
  b.capacity = 100000;
  b.pasture = { x: 20, z: 0, parcels: 4 };
  b.stock = { [animal]: count, feed: 10000, water: 10000 };
  b.employees = [worker.id];
  worker.job = b.id;
  Object.assign(owner, { x: 100, z: 100 });
  Object.assign(worker, { x: 100, z: 100, activeUntil: 100000000 });
  w.buildings = [b];
  return { w, b, owner, worker };
}
test('breeding gives a saved young cohort for every species while existing adults stay adults', () => {
  for (const [kind, animal, young, adults] of [
    ['dairy', 'cows', 'calves', 2],
    ['piggery', 'pigs', 'piglets', 2],
    ['sheepfold', 'sheep', 'lambs', 2],
    ['henhouse', 'chickens', 'chicks', 4],
  ] as const) {
    const { w, b, owner } = farm(kind, animal, adults);
    act(w, owner.id, { type: 'livestock', building: b.id, operation: 'breed' });
    const due = b.breedingEnd!;
    advance(w, due - w.time);
    assert.equal(b.stock[young], 1, `${kind} must produce young`);
    assert.equal(b.stock[animal], adults);
    assert.equal(b.young?.[0].item, young);
    assert.equal(b.young?.[0].count, 1);
    assert.equal(b.young?.[0].born, due);
  }
});
test('young grow only with adequate care and mature at their saved game-day boundary', () => {
  const { w, b, owner } = farm();
  Object.assign(w.settings, { calfMaturityDays: 2 });
  act(w, owner.id, { type: 'livestock', building: b.id, operation: 'breed' });
  advance(w, b.breedingEnd! - w.time);
  advance(w, 600);
  assert.equal(b.stock.calves, 1);
  b.stock.feed = b.stock.water = 0;
  advance(w, 600);
  assert.equal(b.stock.calves, 1, 'a hungry day must not mature the calf');
  b.stock.feed = b.stock.water = 10000;
  advance(w, 599);
  assert.equal(b.stock.calves, 1);
  advance(w, 1);
  assert.equal(b.stock.calves ?? 0, 0);
  assert.equal(b.stock.cows, 3);
  assert.equal(b.young?.length ?? 0, 0);
});
test('young use half pasture and rations, produce nothing, and die before adults', () => {
  const { w, b } = farm();
  b.stock.calves = 1;
  b.young = [{ item: 'calves', born: w.time, count: 1, grownDays: 0 }];
  assert.equal(herdNeeds(b, w.settings).feed, 2.5);
  assert.equal(herdNeeds(b, w.settings).water, 2.5);
  assert.deepEqual(livestockOutputs(b, { milk: 6 }), { milk: 6 });
  const emptyAdults = { ...b, stock: { calves: 2 } };
  assert.equal(herdReady(emptyAdults), false);
  const before = b.stock.feed;
  advance(w, 1200);
  assert.equal(before - b.stock.feed, 5, 'two care cycles use one complete young ration');
  b.herdCondition = 20;
  b.stock.feed = b.stock.water = 0;
  advance(w, 600);
  assert.equal(b.stock.calves ?? 0, 0);
  assert.equal(b.stock.cows, 2);
});
test('continuous breeding is owner-controlled, bounded and equivalent under catch-up', () => {
  const { w, b, owner } = farm();
  b.pasture!.parcels = 1;
  Object.assign(w.settings, { calfMaturityDays: 2 });
  act(w, owner.id, { type: 'livestock', building: b.id, operation: 'continuous', enabled: true });
  const copy = structuredClone(w);
  advance(w, 18000);
  for (let i = 0; i < 30; i++) advance(copy, 600);
  assert.deepEqual(b.stock, copy.buildings[0].stock);
  assert.deepEqual(b.young, copy.buildings[0].young);
  assert.ok((b.stock.cows ?? 0) + (b.stock.calves ?? 0) * 0.5 <= 4);
  assert.ok(b.investment >= 0);
  act(w, owner.id, { type: 'livestock', building: b.id, operation: 'continuous', enabled: false });
  assert.equal(b.continuousBreeding, false);
});
test('young fractional rations preserve the existing rounded adult chicken ration', () => {
  const { w, b } = farm('henhouse', 'chickens', 5);
  b.stock.chicks = 1;
  assert.equal(herdNeeds(b, w.settings).feed, 3.25);
  assert.equal(herdNeeds(b, w.settings).water, 3.25);
  const before = b.stock.feed;
  advance(w, 2400);
  assert.equal(before - b.stock.feed, 13);
});
test('young keep their growth through inventory, shop and wagon transfers and save/reopen', () => {
  const { w, b, owner } = farm();
  b.stock.calves = 2;
  b.young = [{ item: 'calves', born: 0, count: 2, grownDays: 12 }];
  b.youngCareAt = w.time;
  const market = makeBuilding('market', 'market', 100, 100);
  market.owner = 'treasury';
  market.buy.calves = market.sell.calves = 100;
  market.investment = 100000;
  market.stock = {};
  w.buildings.push(market);
  owner.cash = 100000;
  act(w, owner.id, {
    type: 'stock',
    building: b.id,
    direction: 'withdraw',
    item: 'calves',
    quantity: 1,
  });
  act(w, owner.id, {
    type: 'trade',
    building: market.id,
    direction: 'sell',
    item: 'calves',
    quantity: 1,
  });
  assert.equal(market.young?.[0].grownDays, 12);
  advance(w, 1200);
  act(w, owner.id, {
    type: 'trade',
    building: market.id,
    direction: 'buy',
    item: 'calves',
    quantity: 1,
  });
  const t: Trailer = {
    id: 'wagon',
    owner: owner.id,
    kind: 'livestock',
    x: 100,
    z: 100,
    heading: 0,
    cargo: {},
  };
  w.trailers = { [t.id]: t };
  trailerAction(w, owner, {
    type: 'trailer',
    operation: 'load',
    id: t.id,
    item: 'calves',
    quantity: 1,
  });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    trailerAction(loaded, loaded.players[owner.id], {
      type: 'trailer',
      operation: 'unload',
      id: t.id,
      building: b.id,
      item: 'calves',
      quantity: 1,
    });
    const herd = loaded.buildings.find((x) => x.id === b.id)!;
    assert.deepEqual(
      herd.young?.map((c) => c.grownDays),
      [14, 12],
    );
    assert.equal(herd.stock.calves, 2);
    advance(loaded, 600);
    assert.deepEqual(
      herd.young?.map((c) => c.grownDays),
      [15, 13],
    );
  } finally {
    store.close();
  }
});
test('livestock wagons count configurable young shares and reject them in ordinary trailers', () => {
  const { w, owner } = farm();
  const t: Trailer = {
    id: 'wagon',
    owner: owner.id,
    kind: 'livestock',
    x: 100,
    z: 100,
    heading: 0,
    cargo: { cows: 5 },
  };
  assert.equal(trailerAccepts(w, t, 'calves', 2), true);
  assert.equal(trailerAccepts(w, t, 'calves', 3), false);
  assert.equal(trailerAccepts(w, { ...t, kind: 'box', cargo: {} }, 'calves', 1), false);
  Object.assign(w.settings, { livestockYoungPastureShare: 0.25 });
  assert.equal(trailerAccepts(w, t, 'calves', 4), true);
  assert.equal(trailerAccepts(w, t, 'calves', 5), false);
});
test('a qualified working owner can care for a continuously breeding herd without employees', () => {
  const { w, b, owner } = farm();
  w.settings.activeWork = true;
  w.settings.ownerOperation = true;
  b.employees = [];
  b.ownerActiveUntil = w.time + 7200;
  b.herdCondition = 90;
  act(w, owner.id, { type: 'livestock', building: b.id, operation: 'continuous', enabled: true });
  advance(w, 600);
  assert.equal(b.herdCondition, 94);
  assert.ok(b.breedingEnd);
});
test('world growth rules validate atomically and calendar changes preserve earned age', () => {
  const { w, b, owner } = farm();
  b.stock.calves = 1;
  b.young = [{ item: 'calves', born: w.time, count: 1, grownDays: 3 }];
  b.youngCareAt = w.time;
  const previous = structuredClone(w.settings);
  assert.throws(() =>
    act(w, owner.id, {
      type: 'settings',
      patch: { calfMaturityDays: 12, livestockYoungRationShare: -1 },
    }),
  );
  assert.deepEqual(w.settings, previous);
  advance(w, 300);
  act(w, owner.id, { type: 'settings', patch: { dayLength: 1200, livestockGrowthMultiplier: 1 } });
  advance(w, 300);
  assert.equal(b.young[0].grownDays, 3.75);
  act(w, owner.id, { type: 'settings', patch: { dayLength: 0 } });
  advance(w, 1200);
  assert.equal(b.young[0].grownDays, 3.75, 'a frozen calendar pauses maturation');
  act(w, owner.id, { type: 'settings', patch: { dayLength: 600, livestockGrowthMultiplier: 0 } });
  advance(w, 600);
  assert.equal(b.young[0].grownDays, 3.75, 'growth can be disabled without resetting ages');
});
test('world adult minimums govern shop reserves and production explanations', () => {
  const { w, b, worker } = farm();
  Object.assign(w.settings, { cowBreedingMinimum: 3 });
  b.stock.cows = 3;
  worker.cash = 1000000;
  assert.throws(
    () =>
      act(w, worker.id, {
        type: 'trade',
        building: b.id,
        direction: 'buy',
        item: 'cows',
        quantity: 1,
      }),
    /3 breeding cows/,
  );
  b.stock.cows = 2;
  assert.match(productionReport(w, b).join(' '), /3 cows/);
});
test('world designs retain young ages, continuous breeding and configured rules', async () => {
  const { w, b } = farm();
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { settingsFields } = await import('../src/client/creator-editor');
  // This test concerns portable livestock state, not siting a new pasture.
  delete b.pasture;
  w.time = 12000;
  b.stock.calves = 2;
  b.young = [{ item: 'calves', count: 2, born: 3000, grownDays: 7.5 }];
  b.continuousBreeding = true;
  Object.assign(w.settings, { calfMaturityDays: 30, livestockYoungRationShare: 0.4 });
  const dest = createWorld('design-young', 'Young design', 'owner');
  applyDesign(dest, exportDesign(w));
  const herd = dest.buildings.find((x) => x.id === b.id)!;
  assert.equal(herd.stock.calves, 2);
  assert.equal(herd.young?.[0].grownDays, 7.5);
  assert.equal(herd.young?.[0].born, dest.time - 9000);
  assert.equal(herd.continuousBreeding, true);
  assert.equal(dest.settings.calfMaturityDays, 30);
  assert.equal(dest.settings.livestockYoungRationShare, 0.4);
  for (const key of ['calfMaturityDays', 'livestockYoungRationShare', 'livestockContinuousAllowed'])
    assert.ok(settingsFields().includes(`name="${key}"`));
});
test('NPC continuous breeding still respects its configured cash, ration and spare-stock budgets', () => {
  const { w, b, owner } = farm();
  owner.npc = true;
  b.continuousBreeding = true;
  b.stock.calves = 2;
  advance(w, 600);
  assert.equal(b.breedingEnd, undefined, 'young already fill the two-animal spare buffer');
  b.stock.calves = 0;
  b.investment = w.settings.npcBreedingCashThreshold!;
  advance(w, 600);
  assert.equal(
    b.breedingEnd,
    undefined,
    'continuous mode does not spend through NPC cash reserves',
  );
});
