// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { constructionRefund } from '../src/shared/construction';
import { spawnReserved, buildingSpawnReason } from '../src/shared/spawn-reserve';
import { farmExpansionBlocker } from '../src/shared/farm-land';
import { pastureBlocker } from '../src/shared/pastures';
import { pickBuildSite } from '../src/server/npc/chains';
import { nearestWaterworksSite } from '../src/shared/shoreline';
import { Store } from '../src/server/store';
const defaults = {
  constructionMinimumSpacing: 12,
  constructionPlacementReach: 4,
  spawnClearance: 12,
  townCentreClearance: 8,
  constructionRefundShare: 0.75,
};
function setup() {
  const w = createWorld('construction-rules', 'Construction', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.roads = [];
  w.resources = {};
  w.tier = 10;
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  Object.assign(w.settings, { seaLevel: -10, mapSize: 1000 });
  Object.assign(p, { x: 80, z: 80, cash: 1000000 });
  return { w, p };
}
test('construction defaults and missing settings retain strict centre spacing and base refunds', () => {
  for (const missing of [false, true]) {
    const { w, p } = setup();
    for (const [key, value] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[key];
      else assert.equal((w.settings as any)[key], value, key);
    }
    const b = makeBuilding('tiny', 'home', 68, 80);
    b.creatorBounds = { width: 2, depth: 2, height: 2 };
    w.buildings = [b];
    assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /Too close/);
    p.x += 0.01;
    act(w, p.id, { type: 'construct', kind: 'home' });
    assert.equal(
      constructionRefund(w, w.buildings[1]),
      Math.floor(w.buildings[1].constructionCost! * 0.75),
    );
    assert.equal(spawnReserved(w, 11.99, 17), true);
    assert.equal(spawnReserved(w, 12, 17), false);
  }
});
test('custom and zero spacing enforce server boundaries while preserving footprint collisions', () => {
  const { w, p } = setup();
  const b = makeBuilding('tiny', 'home', 60, 80);
  b.creatorBounds = { width: 2, depth: 2, height: 2 };
  w.buildings = [b];
  Object.assign(w.settings, { constructionMinimumSpacing: 20 });
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /Too close/);
  assert.equal(JSON.stringify(w), before);
  p.x += 0.01;
  act(w, p.id, { type: 'construct', kind: 'home' });
  w.buildings = [b];
  Object.assign(w.settings, { constructionMinimumSpacing: 0 });
  p.x = 72;
  act(w, p.id, { type: 'construct', kind: 'home' });
  w.buildings = [b];
  p.x = 61;
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /building|property/i);
});
test('shoreline placement reach is inclusive configurable and zero requires the actual site', () => {
  for (const [reach, distance, allowed] of [
    [4, 4, true],
    [4, 4.01, false],
    [6, 5, true],
    [0, 0, true],
    [0, 0.01, false],
  ] as const) {
    const w = createWorld('shore', 'Shore', 'owner'),
      p = addPlayer(w, 'owner', 'Owner');
    w.buildings = [];
    Object.assign(p, { x: distance, z: 144, cash: 1000000 });
    Object.assign(w.settings, { constructionPlacementReach: reach });
    const place = () => act(w, p.id, { type: 'construct', kind: 'waterworks', x: 0, z: 144 });
    if (allowed) {
      place();
      assert.equal(w.buildings[0].x, 0);
    } else {
      const before = JSON.stringify(w);
      assert.throws(place, /within .*metres/);
      assert.equal(JSON.stringify(w), before);
    }
  }
});
test('custom spawn and town clearances protect rotated footprints fields and pastures', () => {
  const { w } = setup();
  Object.assign(w.settings, { spawnClearance: 20 });
  assert.equal(spawnReserved(w, 19.99, 17), true);
  assert.equal(spawnReserved(w, 20, 17), false);
  const b = makeBuilding('rotated', 'home', 27, 17);
  b.creatorBounds = { width: 4, depth: 40, height: 4 };
  b.rotation = Math.PI / 2;
  assert.match(buildingSpawnReason(w, b)!, /respawn/);
  Object.assign(w.settings, { spawnClearance: 6 });
  assert.equal(buildingSpawnReason(w, b), undefined);
  Object.assign(w.settings, { spawnClearance: 0 });
  assert.equal(spawnReserved(w, 0, 17), false);
  const town = createWorld('town', 'Town', 'owner').towns[0];
  w.towns = [{ ...town, x: 200, z: 200 }];
  assert.equal(spawnReserved(w, 207.99, 200), true);
  assert.equal(spawnReserved(w, 208, 200), false);
  Object.assign(w.settings, { townCentreClearance: 16 });
  assert.equal(spawnReserved(w, 215.99, 200), true);
  assert.equal(spawnReserved(w, 216, 200), false);
  Object.assign(w.settings, { townCentreClearance: 0 });
  assert.equal(spawnReserved(w, 200, 200), false);
  w.zones = [{ id: 'explicit', kind: 'spawn', x: 300, z: 300, radius: 10 }];
  assert.equal(spawnReserved(w, 309, 300), true);
  const farm = makeBuilding('farm', 'farm', 80, 80),
    barn = makeBuilding('barn', 'dairy', 80, 80);
  farm.rotation = barn.rotation = 0;
  assert.equal(farmExpansionBlocker(w, farm), undefined);
  assert.equal(pastureBlocker(w, barn, { x: 30, z: 0, parcels: 1 }), undefined);
  Object.assign(w.settings, { spawnClearance: 200 });
  assert.match(farmExpansionBlocker(w, farm)!, /respawn/);
  assert.match(pastureBlocker(w, barn, { x: 30, z: 0, parcels: 1 })!, /respawn/);
});
test('resident construction sites respect configured centre spacing', () => {
  const { w, p } = setup();
  w.buildings = [makeBuilding('existing', 'home', p.x, p.z)];
  Object.assign(w.settings, { constructionMinimumSpacing: 200 });
  const site = pickBuildSite(w, p, 'home');
  assert.ok(site);
  assert.ok(Math.hypot(site.x - p.x, site.z - p.z) > 200);
});
test('custom refunds use original receipts or conservative legacy bases and cancel exactly once', () => {
  for (const share of [0.25, 0])
    for (const legacy of [false, true]) {
      const { w, p } = setup();
      act(w, p.id, { type: 'construct', kind: 'home' });
      const b = w.buildings[0],
        base = b.constructionCost!;
      const item = Object.keys(b.construction!)[0];
      p.inventory = { [item]: 1 };
      act(w, p.id, { type: 'supply', building: b.id });
      if (legacy) {
        delete b.constructionCost;
        b.price = Math.floor(base / 2);
      } else b.price = 99999999;
      Object.assign(w.settings, { constructionRefundShare: share });
      const expected = Math.floor((legacy ? b.price : base) * share),
        cash = p.cash;
      assert.equal(constructionRefund(w, b), expected);
      act(w, p.id, { type: 'cancelConstruction', building: b.id });
      assert.equal(p.cash, cash + expected);
      assert.equal(p.inventory[item], 0);
      assert.equal(w.buildings.length, 0);
      assert.throws(() => act(w, p.id, { type: 'cancelConstruction', building: b.id }));
      assert.equal(p.cash, cash + expected);
    }
});
test('construction rules validate atomically and persist through editor observations designs and reload', async () => {
  const { w, p } = setup();
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  for (const key of Object.keys(defaults))
    for (const value of [-1, key === 'constructionRefundShare' ? 1.01 : 1000.01, NaN, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [key]: value }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    constructionMinimumSpacing: 24.5,
    constructionPlacementReach: 6.5,
    spawnClearance: 18.5,
    townCentreClearance: 9.5,
    constructionRefundShare: 0.25,
  };
  edit(patch);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      observation = observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident'),
      html = settingsFields(),
      summary = rulesSummary(w);
    for (const [key, value] of Object.entries(patch)) {
      assert.ok(html.includes(`name="${key}"`), key);
      assert.ok(
        summary.includes(String(key === 'constructionRefundShare' ? value * 100 : value)),
        key,
      );
      assert.equal((dest.settings as any)[key], value);
      assert.equal((loaded.settings as any)[key], value);
      assert.equal((observation.worldRules as any)[key], value);
    }
  } finally {
    store.close();
  }
});

test('shoreline site searches respect changed construction spacing without stale cached filters', () => {
  const w = createWorld('shore-filter', 'Shore', 'owner');
  w.buildings = [];
  const point = { x: 0, z: 144 },
    first = nearestWaterworksSite(w, point);
  assert.ok(first);
  w.buildings = [makeBuilding('neighbour', 'home', first.x + 30, first.z)];
  Object.assign(w.settings, { constructionMinimumSpacing: 200 });
  const site = nearestWaterworksSite(w, point);
  assert.ok(site);
  assert.ok(Math.hypot(site.x - w.buildings[0].x, site.z - w.buildings[0].z) > 200);
});

test('refund percentage text does not expose floating-point artifacts', async () => {
  const { w } = setup();
  Object.assign(w.settings, { constructionRefundShare: 0.29 });
  const { buildMenuHtml } = await import('../src/client/build-menu');
  const { rulesSummary } = await import('../src/shared/rulesets');
  assert.match(buildMenuHtml(w.settings), /29% of its base cash cost/);
  assert.match(rulesSummary(w), /refund 29%/);
});
