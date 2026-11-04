// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { ensurePasture, pastureBlocker } from '../src/shared/pastures';
import {
  pastureFences,
  inPasture,
  pasturePoint,
  pastureCapacity,
} from '../src/shared/pasture-land';
import { roadSite } from '../src/shared/road-routing';
import { livestockSites } from '../src/client/livestock-scene';
import { creatorSchema } from '../src/shared/creator';
import { Store } from '../src/server/store';
function setup(size?: number) {
  const w = createWorld('pasture-size', 'Pasture', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('barn', 'dairy', 80, 80);
  w.buildings = [b];
  w.towns = [];
  w.roads = [];
  w.zones = [];
  w.resources = {};
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  Object.assign(w.settings, { seaLevel: -10, mapSize: 1000 });
  if (size !== undefined) Object.assign(w.settings, { pastureParcelSize: size });
  Object.assign(b, { owner: p.id, rotation: 0, stock: { cows: 4 }, investment: 100000 });
  Object.assign(p, { x: b.x, z: b.z, cash: 1000000 });
  return { w, p, b };
}
function extent(b: ReturnType<typeof makeBuilding>) {
  const points = pastureFences([b]).flatMap((f) => f.points);
  return {
    width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    depth: Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z)),
  };
}
test('pasture dimensions retain defaults and legacy land while newly claimed parcels use the world rule', () => {
  const { w, b } = setup();
  assert.equal((w.settings as any).pastureParcelSize, 16);
  delete (w.settings as any).pastureParcelSize;
  ensurePasture(w, b);
  assert.equal((b.pasture as any).parcelSize, 16);
  assert.deepEqual(extent(b), { width: 16, depth: 16 });
  delete (b.pasture as any).parcelSize;
  Object.assign(w.settings, { pastureParcelSize: 20 });
  ensurePasture(w, b);
  assert.deepEqual(extent(b), { width: 16, depth: 16 });
  delete b.pasture;
  ensurePasture(w, b);
  assert.equal((b.pasture as any).parcelSize, 20);
  assert.deepEqual(extent(b), { width: 20, depth: 20 });
});
test('custom rotated pasture fences reservations and grazing routes agree at small odd and large sizes', () => {
  for (const size of [8, 21, 64]) {
    const { w, b, p } = setup(size);
    ensurePasture(w, b);
    assert.ok(b.pasture);
    assert.deepEqual(extent(b), { width: size, depth: size });
    b.pasture.parcels = 2;
    b.rotation = Math.PI / 2;
    const e = extent(b);
    assert.ok(Math.abs(e.width - size) < 1e-8);
    assert.ok(Math.abs(e.depth - size * 2) < 1e-8);
    const inside = pasturePoint(b, b.pasture.x + size * 1.5 - 0.01, b.pasture.z),
      outside = pasturePoint(b, b.pasture.x + size * 1.5 + 0.01, b.pasture.z);
    assert.equal(inPasture(b, inside.x, inside.z), true);
    assert.equal(inPasture(b, outside.x, outside.z), false);
    assert.equal(roadSite(w).clear(inside), false);
    for (const animal of livestockSites(w, p))
      for (const point of animal.points) assert.equal(inPasture(b, point.x, point.z), true);
  }
});
test('paid adjoining expansion retains its recorded size and ordinary capacity after world edits', () => {
  const { w, p, b } = setup(20);
  ensurePasture(w, b);
  const old = structuredClone(b.pasture),
    stock = structuredClone(b.stock),
    cash = p.cash;
  act(w, p.id, { type: 'settings', patch: { pastureParcelSize: 8 } });
  assert.deepEqual(b.pasture, old);
  assert.deepEqual(b.stock, stock);
  assert.equal(p.cash, cash);
  const message = act(w, p.id, { type: 'livestock', building: b.id, operation: 'expand' });
  assert.match(message, /800 square metres/);
  assert.equal(p.cash, cash - 25000);
  assert.deepEqual(extent(b), { width: 40, depth: 20 });
  assert.equal(pastureCapacity(b), 8);
  const next = pasturePoint(b, b.pasture!.x + 40, b.pasture!.z);
  w.buildings.push(makeBuilding('obstacle', 'home', next.x, next.z));
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'livestock', building: b.id, operation: 'expand' }),
    /building/,
  );
  assert.equal(JSON.stringify(w), before);
});
test('odd parcel boundary samples reject an obstruction at the outer edge and blocked barns remain empty', () => {
  const { w, b } = setup(21);
  const pasture = { x: 40, z: 0, parcels: 1, parcelSize: 21 };
  const corner = pasturePoint(b, 50.5, 10.5);
  w.zones = [{ id: 'corner', kind: 'noBuild', ...corner, radius: 0.01 }];
  assert.match(pastureBlocker(w, b, pasture)!, /no-build/);
  w.zones = [{ id: 'blocked', kind: 'noBuild', x: 80, z: 80, radius: 300 }];
  ensurePasture(w, b);
  assert.equal(b.pasture, undefined);
});
test('pasture size validates and persists through controls observations designs and saves', async () => {
  const { w, p, b } = setup(20);
  ensurePasture(w, b);
  for (const v of [0, 7, 20.5, 65, Infinity]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { pastureParcelSize: v } }));
    assert.equal(JSON.stringify(w), before);
  }
  act(w, p.id, { type: 'settings', patch: { pastureParcelSize: 24 } });
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.deepEqual(dest.buildings[0].pasture, b.pasture);
  assert.equal((dest.settings as any).pastureParcelSize, 24);
  assert.deepEqual(extent(dest.buildings[0]), { width: 20, depth: 20 });
  assert.ok(settingsFields().includes('name="pastureParcelSize"'));
  assert.ok(rulesSummary(w).includes('24'));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.deepEqual(loaded.buildings[0].pasture, b.pasture);
    assert.equal((loaded.settings as any).pastureParcelSize, 24);
    assert.equal(
      (
        observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident')
          .worldRules as any
      ).pastureParcelSize,
      24,
    );
  } finally {
    store.close();
  }
});
