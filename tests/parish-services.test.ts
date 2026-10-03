// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildings, recipes } from '../src/shared/catalog.ts';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  productionInterval,
  makeBuilding,
} from '../src/shared/simulation.ts';
import {
  completePuddlewick,
  starterServices,
  retiredStarterTypes,
} from '../src/server/parish-services.ts';
import { waterworksSite } from '../src/shared/shoreline.ts';
import { roadDistance, townRoads } from '../src/shared/town.ts';
import { buildingBounds, buildingPlan } from '../src/shared/building-shapes.ts';
import { Store } from '../src/server/store.ts';
import { createApp } from '../src/server/app.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const parish = () => createWorld('puddlewick', 'Puddlewick', 'server');
const wanted = () =>
  new Set([
    ...parish()
      .buildings.filter((b) => b.kind !== 'town')
      .map((b) => b.kind),
    ...starterServices,
  ]);
test('Puddlewick adds only the approved services and removes the public council', () => {
  const w = parish(),
    originals = structuredClone(w.buildings.filter((b) => b.kind !== 'town'));
  assert.equal(completePuddlewick(w), true);
  assert.deepEqual(new Set(w.buildings.map((b) => b.kind)), wanted());
  assert.deepEqual(w.buildings.slice(0, originals.length), originals);
  const added = w.buildings.slice(originals.length);
  for (const b of added) {
    assert.equal(b.owner, undefined, 'new businesses remain purchasable');
    if (b.recipe) assert.ok(b.investment > 0);
    assert.ok(!b.construction);
    const bounds = buildingBounds(buildingPlan(b));
    assert.ok(roadDistance(townRoads(w), b.x, b.z) > Math.max(bounds.width, bounds.depth) / 2);
    if (b.recipe) {
      const r = recipes[b.recipe];
      for (const [item, n] of Object.entries(r.inputs)) assert.ok(b.stock[item] >= n);
      for (const [item, n] of Object.entries(r.outputs)) assert.ok(b.stock[item] >= n);
    }
  }
  assert.ok(
    waterworksSite(
      w,
      w.buildings.find((b) => b.kind === 'waterworks')!,
      w.buildings.find((b) => b.kind === 'waterworks')!.rotation,
    ),
  );
  w.settings.hungerRate = w.settings.thirstRate = 0;
  for (const kind of ['mason', 'waterworks']) {
    const b = w.buildings.find((b) => b.kind === kind)!,
      r = recipes[b.recipe!];
    const p = addPlayer(w, kind, kind);
    p.x = b.x;
    p.z = b.z;
    p.skills = [r.skill];
    act(w, p.id, { type: 'job', building: b.id });
    const stock = structuredClone(b.stock),
      cash = p.cash;
    advance(w, productionInterval(w, b));
    for (const [item, n] of Object.entries(r.inputs)) assert.equal(b.stock[item], stock[item] - n);
    for (const [item, n] of Object.entries(r.outputs)) assert.equal(b.stock[item], stock[item] + n);
    assert.ok(p.cash > cash, 'worker paid by business');
  }
});

test('upgrade preserves owned businesses, survives reload and does not respawn demolished additions', () => {
  const w = parish(),
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  Object.assign(mill, {
    owner: 'hank',
    wage: 1000,
    investment: 9999,
    buy: { wheat: 600 },
    stock: { wheat: 118 },
  });
  const mason = makeBuilding('player-mason', 'mason', -192, 48);
  mason.owner = 'hank';
  w.buildings.push(mason);
  const before = structuredClone(w.buildings.filter((b) => b.kind !== 'town'));
  completePuddlewick(w);
  assert.deepEqual(w.buildings.slice(0, before.length), before);
  assert.equal(w.buildings.filter((b) => b.kind === 'mason').length, 1);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const once = JSON.stringify(loaded);
    assert.equal(completePuddlewick(loaded), false);
    assert.equal(JSON.stringify(loaded), once);
    loaded.buildings = loaded.buildings.filter((b) => b.kind !== 'waterworks');
    assert.equal(completePuddlewick(loaded), false);
    assert.ok(!loaded.buildings.some((b) => b.kind === 'waterworks'));
  } finally {
    store.close();
  }
});

test('parish completion respects occupied plots, parked players, no-build zones and custom worlds', () => {
  const w = parish(),
    p = addPlayer(w, 'parked', 'Parked');
  p.x = -192;
  p.z = 48;
  w.zones.push({ id: 'reserved', kind: 'noBuild', x: 0, z: -160, radius: 65 });
  completePuddlewick(w);
  assert.equal(new Set(w.buildings.map((b) => b.kind)).size, wanted().size);
  for (const b of w.buildings.filter((b) => b.id.startsWith('parish-'))) {
    assert.ok(Math.hypot(b.x - p.x, b.z - p.z) > 16);
    assert.ok(Math.hypot(b.x, b.z + 160) > 65);
  }
  for (const world of [
    createWorld('custom', 'Puddlewick', 'owner'),
    createWorld('puddlewick', 'Custom', 'owner'),
  ]) {
    const before = JSON.stringify(world);
    assert.equal(completePuddlewick(world), false);
    assert.equal(JSON.stringify(world), before);
  }
});

test('unbuildable terrain defers missing services without overwriting or marking them complete', () => {
  const w = parish();
  w.settings.seaLevel = 100;
  completePuddlewick(w);
  assert.ok(!w.buildings.some((b) => b.kind === 'waterworks'));
  assert.ok(!w.parishServices?.includes('waterworks'));
  w.settings.seaLevel = -1;
  completePuddlewick(w);
  assert.ok(w.buildings.some((b) => b.kind === 'waterworks'));
});

test('server startup upgrades the saved live parish and persists the completion before play', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-parish-'));
  const store = new Store(join(dir, 'aclone.sqlite'));
  const w = parish(),
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = 'hank';
  mill.wage = 1000;
  mill.buy.wheat = 600;
  store.saveWorld(w);
  store.close();
  try {
    const app = await createApp({ dataDir: dir, port: 0 });
    try {
      const live = app.worlds.get('puddlewick')!;
      assert.deepEqual(new Set(live.buildings.map((b) => b.kind)), wanted());
      assert.equal(live.buildings.find((b) => b.kind === 'mill')!.buy.wheat, 600);
      const saved = app.store.loadWorlds().find((entry) => entry.world.id === 'puddlewick')!.world;
      assert.deepEqual(saved.parishServices, live.parishServices);
      assert.deepEqual(saved.buildings, live.buildings);
    } finally {
      await app.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function previousParish() {
  const w = parish();
  for (const kind of Object.keys(buildings)) {
    if (w.buildings.some((b) => b.kind === kind)) continue;
    const b = makeBuilding('parish-' + kind, kind, -192, 48);
    if (kind === 'waterworks') {
      b.x = -216;
      b.z = 144;
      b.rotation = Math.PI;
    }
    b.investment = 22000;
    w.buildings.push(b);
  }
  w.parishServices = Object.keys(buildings);
  return w;
}
test('retire all accidental public additions once, preserve purchased and custom properties, and clear removed jobs', () => {
  const w = previousParish();
  const p = addPlayer(w, 'worker', 'Worker');
  p.job = 'parish-brewery';
  p.activeUntil = 600;
  const carpenter = w.buildings.find((b) => b.kind === 'carpenter')!;
  carpenter.owner = p.id;
  carpenter.stock.wood = 82;
  carpenter.investment = 77231;
  const owned = structuredClone(carpenter);
  const custom = makeBuilding('custom-notice', 'notice', 10, 30);
  w.buildings.push(custom);
  const initialCash = p.cash;
  completePuddlewick(w);
  assert.deepEqual(
    w.buildings.find((b) => b.id === carpenter.id),
    owned,
  );
  assert.deepEqual(
    w.buildings.find((b) => b.id === custom.id),
    custom,
  );
  for (const kind of retiredStarterTypes)
    if (kind !== 'carpenter' && kind !== 'notice')
      assert.ok(!w.buildings.some((b) => b.kind === kind), kind);
  assert.equal(p.job, undefined);
  assert.equal(p.activeUntil, 0);
  assert.equal(p.cash, initialCash);
  assert.equal(
    w.ledger
      .filter((e) => e.reason === 'retired parish starter building')
      .reduce((n, e) => n + e.amount, 0),
    250000 + (retiredStarterTypes.length - 2) * 22000,
  );
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    assert.equal(completePuddlewick(restored), false);
    assert.deepEqual(restored, w);
    // Do not delete a protected property if its owner subsequently relinquishes it.
    delete restored.buildings.find((b) => b.id === carpenter.id)!.owner;
    assert.equal(completePuddlewick(restored), false);
    assert.ok(restored.buildings.some((b) => b.id === carpenter.id));
  } finally {
    store.close();
  }
});
test('cleanup defers a building with an active task and leaves player-made worlds untouched', () => {
  const w = previousParish(),
    p = addPlayer(w, 'worker', 'Worker');
  p.task = { kind: 'craft', building: 'parish-workshop', end: 10 };
  completePuddlewick(w);
  assert.ok(w.buildings.some((b) => b.kind === 'workshop'));
  assert.ok(!w.parishRetired?.includes('workshop'));
  delete p.task;
  completePuddlewick(w);
  assert.ok(!w.buildings.some((b) => b.kind === 'workshop'));
  const custom = previousParish();
  custom.owner = 'player';
  const before = structuredClone(custom);
  assert.equal(completePuddlewick(custom), false);
  assert.deepEqual(custom, before);
});
