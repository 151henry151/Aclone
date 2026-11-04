// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import {
  farmPlotCount,
  farmExpansionCost,
  farmExpansionBlocker,
  farmPlotPosition,
  onFarmLand,
} from '../src/shared/farm-land';
import { creatorSchema } from '../src/shared/creator';
import { Store } from '../src/server/store';
function setup(count = 4) {
  const w = createWorld('farm-limit', 'Farm limit', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('farm', 'farm', 80, 80);
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
  Object.assign(w.settings, { seaLevel: -10, mapSize: 1000, hungerRate: 0, thirstRate: 0 });
  Object.assign(b, {
    owner: p.id,
    farmPlots: count,
    rotation: 0,
    stock: {},
    investment: 1000000,
    plots: Array.from({ length: count }, () => ({
      planted: 0,
      ready: 0,
      water: 0,
      fertilized: false,
    })),
  });
  Object.assign(p, { x: b.x, z: b.z, cash: 1000000, skills: ['farmer'] });
  return {
    w,
    p,
    b,
    expand: () => act(w, p.id, { type: 'farm', building: b.id, operation: 'expand' }),
  };
}
test('farm limit defaults and missing keys cap at sixteen while custom four and eight stop exact purchases', () => {
  for (const missing of [false, true]) {
    const { w, expand } = setup(16);
    if (missing) delete (w.settings as any).maximumFarmPlots;
    else assert.equal((w.settings as any).maximumFarmPlots, 16);
    const before = JSON.stringify(w);
    assert.throws(expand, /maximum 16/);
    assert.equal(JSON.stringify(w), before);
  }
  for (const limit of [4, 8]) {
    const { w, p, b, expand } = setup();
    Object.assign(w.settings, { maximumFarmPlots: limit });
    if (limit === 8) {
      const cash = p.cash,
        cost = farmExpansionCost(b);
      expand();
      assert.equal(p.cash, cash - cost);
    }
    assert.equal(farmPlotCount(b), limit);
    const before = JSON.stringify(w);
    assert.throws(expand, new RegExp(`maximum ${limit}`));
    assert.equal(JSON.stringify(w), before);
  }
});
test('larger farms preserve usable planted land when caps fall and save all twenty plots', () => {
  const { w, p, b, expand } = setup(16);
  Object.assign(w.settings, { maximumFarmPlots: 20 });
  const cash = p.cash,
    cost = farmExpansionCost(b);
  expand();
  assert.equal(farmPlotCount(b), 20);
  assert.equal(p.cash, cash - cost);
  assert.equal(b.plots!.length, 20);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', crop: 'wheat', plot: 19 });
  const crop = structuredClone(b.plots![19]);
  act(w, p.id, { type: 'settings', patch: { maximumFarmPlots: 4 } });
  assert.equal(farmPlotCount(b), 20);
  assert.deepEqual(b.plots![19], crop);
  assert.throws(expand, /maximum 4/);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    assert.equal(farmPlotCount(saved.buildings[0]), 20);
    assert.deepEqual(saved.buildings[0].plots![19], JSON.parse(JSON.stringify(crop)));
  } finally {
    store.close();
  }
  w.time = crop.ready;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 19 });
  advance(w, 15);
  assert.ok(b.stock.wheat > 0);
  assert.equal(b.plots![19].crop, undefined);
  assert.equal(farmPlotCount({ ...b, farmPlots: 64 }), 64);
});
test('custom farm limits preserve land ownership affordability and full field clearance', () => {
  for (const reason of ['owner', 'cash', 'occupied', 'water']) {
    const { w, p, b, expand } = setup(16);
    Object.assign(w.settings, { maximumFarmPlots: 20 });
    if (reason === 'owner') {
      b.owner = 'other';
      b.employees = [p.id];
    }
    if (reason === 'cash') p.cash = 0;
    if (reason === 'water') w.settings.seaLevel = 10;
    if (reason === 'occupied') {
      const site = farmPlotPosition(b, 16);
      w.buildings.push(makeBuilding('obstacle', 'home', site.x, site.z));
    }
    const before = JSON.stringify(w);
    assert.throws(expand, /owner|cash|property|dry ground/);
    assert.equal(JSON.stringify(w), before);
  }
});
test('twenty plot geometry is reserved for buildings and roads and renders every purchased field', async () => {
  const { w, p, b } = setup(20);
  const site = farmPlotPosition(b, 19);
  assert.equal(onFarmLand(w, site.x, site.z), true);
  const { roadSite } = await import('../src/shared/road-routing');
  const survey = roadSite(w);
  assert.equal(survey.clear(site), false);
  const { FarmFields } = await import('../src/client/fields');
  const fields = new FarmFields();
  fields.update(w, p);
  assert.equal(fields.group.children[0].children.length, 20);
  fields.group.traverse((o: any) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  Object.assign(p, site);
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /farmland/);
});
test('farm limit validation editor observation and design reload retain rule and purchased count', async () => {
  const { w, p, b } = setup(20);
  const edit = (v: unknown) => act(w, p.id, { type: 'settings', patch: { maximumFarmPlots: v } });
  for (const v of [0, 3, 6, 16.5, 68, Infinity]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(v));
    assert.equal(JSON.stringify(w), before);
  }
  edit(24);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const d = exportDesign(w),
    dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, d);
  assert.equal((dest.settings as any).maximumFarmPlots, 24);
  assert.equal(farmPlotCount(dest.buildings[0]), 20);
  assert.ok(settingsFields().includes('name="maximumFarmPlots"'));
  assert.ok(rulesSummary(w).includes('24'));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal((store.loadWorlds()[0].world.settings as any).maximumFarmPlots, 24);
    assert.equal(
      (
        observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident')
          .worldRules as any
      ).maximumFarmPlots,
      24,
    );
  } finally {
    store.close();
  }
});
