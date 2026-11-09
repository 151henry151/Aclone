import { worldItems } from '../src/shared/world-catalogue';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, advance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { terrainHeight } from '../src/shared/terrain';
import { constructionRules } from '../src/shared/construction-rules';
import { earthworkReserved } from '../src/shared/earthworks-reservations';
import { surveyEarthwork, workEarthwork } from '../src/shared/earthworks-work';
import { gatheringRules } from '../src/shared/gathering-rules';

function setup(target = 9) {
  const w = createWorld('earthwork-work', 'Earthwork', 'owner');
  Object.assign(w, {
    buildings: [],
    towns: [],
    zones: [],
    terrain: [],
    roads: [],
    airfield: undefined,
    spaceportSite: undefined,
  });
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -40,
    spawnClearance: 0,
    townCentreClearance: 0,
    arrivalAnimation: 'off',
    vehicleMaintenance: false,
    hungerRate: 0,
    thirstRate: 0,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(10),
  };
  const p = addPlayer(w, 'owner', 'Operator');
  Object.assign(p, {
    x: 80,
    z: 80,
    y: 10,
    heading: 0,
    vehicle: 38,
    fleet: [0, 5, 38, 39],
    fuel: 100,
    fuelVehicle: 38,
    engine: true,
    skills: ['plant operator'],
    online: true,
    speed: 1,
    inventory: {},
  });
  const input = { x: 80, z: 80, width: 8, depth: 8, rotation: 0, target, shoulder: 12 };
  return { w, p, input };
}
function confirm(f: ReturnType<typeof setup>) {
  act(f.w, f.p.id, { type: 'earthwork', operation: 'confirm', ...f.input });
  return f.w.earthworks![0];
}
function pass(f: ReturnType<typeof setup>, count = 1) {
  for (let i = 0; i < count; i++) {
    const before = { x: f.p.x, z: f.p.z };
    f.p.z = f.p.z === 80 ? 81 : 80;
    f.p.y = terrainHeight(f.w, f.p.x, f.p.z);
    f.p.speed = 1;
    workEarthwork(f.w, f.p, before, 1);
    f.w.time++;
  }
}
test('survey integrates cut and fill including shoulders without mutation, and clamps target to permitted depth', () => {
  for (const [target, kind] of [
    [9, 'cut'],
    [11, 'fill'],
    [10, 'level'],
  ] as const) {
    const f = setup(target),
      before = structuredClone(f.w),
      s = surveyEarthwork(f.w, f.p, f.input);
    assert.equal(s.reason, undefined);
    assert.deepEqual(f.w, before);
    assert.equal(kind === 'fill' ? s.cut : s.fill, 0);
    if (kind !== 'level') assert.ok(s.volume > 64, 'shoulders contribute volume');
    else assert.equal(s.volume, 0);
    assert.ok(s.travel >= 0 && s.fuel >= 0);
    assert.equal(s.minimum, 10);
    assert.equal(s.maximum, 10);
  }
  const f = setup(1000),
    s = surveyEarthwork(f.w, f.p, f.input);
  assert.equal(s.pad.target, 10 + constructionRules(f.w.settings).earthworksMaximumDepth);
});
test('only qualified fuelled slow authoritative movement with a lowered implement changes terrain', () => {
  for (const blocked of [
    'raised',
    'fuel',
    'licence',
    'fast',
    'stationary',
    'outside',
    'prediction',
  ]) {
    const f = setup(),
      pad = confirm(f);
    f.p.earthmovingImplement = true;
    if (blocked === 'raised') f.p.earthmovingImplement = false;
    if (blocked === 'fuel') f.p.fuel = 0;
    if (blocked === 'licence') f.p.skills = ['excavator'];
    if (blocked === 'fast') f.p.speed = 100;
    if (blocked === 'outside') f.p.x = 150;
    const before = { x: f.p.x, z: f.p.z };
    if (blocked !== 'stationary') f.p.z++;
    workEarthwork(f.w, f.p, before, 1, blocked === 'prediction');
    assert.equal(f.w.earthworks![0].progress, 0, blocked);
    assert.equal(pad.work!.done, 0, blocked);
  }
  const f = setup();
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 4);
  assert.ok(f.w.earthworks![0].progress > 0);
  assert.ok(terrainHeight(f.w, 80, 80) < 10);
});
test('fill-only work stops until actual inventory or owned nearby trailer supplies the shortfall atomically', () => {
  const f = setup(11);
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 10);
  assert.equal(f.w.earthworks![0].progress, 0);
  const pad = f.w.earthworks![0],
    n = Math.ceil(pad.work!.fill / constructionRules(f.w.settings).earthworksFillVolume);
  f.p.inventory.dirt = n;
  act(f.w, f.p.id, {
    type: 'earthwork',
    operation: 'deliver',
    id: pad.id,
    item: 'dirt',
    quantity: n,
  });
  assert.equal(f.p.inventory.dirt ?? 0, 0);
  assert.equal(
    f.w.earthworks![0].work!.delivered,
    n * constructionRules(f.w.settings).earthworksFillVolume,
  );
  const before = structuredClone(f.w);
  assert.throws(
    () =>
      act(f.w, f.p.id, {
        type: 'earthwork',
        operation: 'deliver',
        id: pad.id,
        item: 'dirt',
        quantity: 1,
      }),
    /suppl|enough|fill/i,
  );
  assert.deepEqual(f.w, before);
  pass(f, 1500);
  assert.equal(f.w.earthworks![0].progress, 1);
  assert.equal(terrainHeight(f.w, 80, 80), 11);
  assert.equal(earthworkReserved(f.w, 80, 80), false);
});
test('cut material supplies balanced fill; surplus yield remains below quarry work and a full bucket stops without loss', () => {
  const f = setup(10);
  f.w.landscape!.heightmap = Array.from({ length: 1089 }, (_, i) => 10 + ((i % 33) - 16) * 0.1);
  f.input.target = terrainHeight(f.w, 80, 80);
  const s = surveyEarthwork(f.w, f.p, f.input);
  assert.ok(s.cut > 0 && s.fill > 0);
  assert.ok(Math.abs(s.cut - s.fill) < 1e-6);
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 1500);
  assert.equal(f.w.earthworks![0].progress, 1);
  const g = setup();
  g.p.vehicle = 39;
  g.p.fuelVehicle = 39;
  g.w.settings.earthworksBucketCapacity = worldItems(g.w).dirt.weight;
  confirm(g);
  g.p.earthmovingImplement = true;
  pass(g, 1500);
  const pad = g.w.earthworks![0];
  assert.ok(pad.progress > 0 && pad.progress < 1);
  const cargo = g.p.earthmovingCargo![39]!;
  assert.ok((cargo.dirt ?? 0) > 0);
  const before = structuredClone(cargo),
    progress = pad.progress;
  pass(g, 10);
  assert.deepEqual(g.p.earthmovingCargo![39], before);
  assert.equal(g.w.earthworks![0].progress, progress);
  const r = gatheringRules(g.w.settings);
  assert.ok(
    pad.work!.spoilProduced <=
      ((pad.work!.seconds * r.gatheringSkilledYield) / r.gatheringSkilledSeconds) *
        constructionRules(g.w.settings).earthworksQuarryYieldShare +
        1e-8,
  );
});
test('abandon preserves the scar and materials, consented resumption survives a saved-world round trip', () => {
  let f = setup();
  const pad = confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 10);
  const height = terrainHeight(f.w, 80, 80);
  act(f.w, f.p.id, { type: 'earthwork', operation: 'abandon', id: pad.id });
  pass(f, 10);
  assert.equal(terrainHeight(f.w, 80, 80), height);
  assert.equal(earthworkReserved(f.w, 80, 80), false);
  f = { ...f, w: JSON.parse(JSON.stringify(f.w)) };
  f.p = f.w.players.owner;
  const q = addPlayer(f.w, 'helper', 'Helper');
  Object.assign(q, { x: 80, z: 80, vehicle: 39, skills: ['plant operator'] });
  assert.throws(
    () => act(f.w, q.id, { type: 'earthwork', operation: 'resume', id: pad.id }),
    /permission|consent/i,
  );
  act(f.w, f.p.id, { type: 'earthwork', operation: 'consent', id: pad.id, operator: q.id });
  act(f.w, q.id, { type: 'earthwork', operation: 'resume', id: pad.id });
  assert.equal(f.w.earthworks![0].work!.active, true);
  assert.equal(terrainHeight(f.w, 80, 80), height);
});
test('gravel completion weathers over configured game days and a paused day clock preserves it', () => {
  const f = setup(10);
  const pad = confirm(f);
  f.p.inventory.gravel = 1000;
  act(f.w, f.p.id, { type: 'earthwork', operation: 'gravel', id: pad.id });
  assert.equal(f.w.earthworks![0].finish, 'gravel');
  f.w.settings.dayLength = 0;
  advance(f.w, 3600);
  assert.equal(f.w.earthworks![0].finish, 'gravel');
  f.w.settings.dayLength = 10;
  advance(f.w, constructionRules(f.w.settings).earthworksGrassDays * 10);
  assert.equal(f.w.earthworks![0].finish, 'grass');
});

test('unfinished earthworks block new road segments until completed or abandoned', async () => {
  const { roadSite } = await import('../src/shared/road-routing');
  const f = setup();
  const pad = confirm(f);
  assert.equal(roadSite(f.w).segment({ x: 55, z: 80 }, { x: 105, z: 80 }), false);
  act(f.w, f.p.id, { type: 'earthwork', operation: 'abandon', id: pad.id });
  assert.equal(roadSite(f.w).segment({ x: 55, z: 80 }, { x: 105, z: 80 }), true);
});
test('dozer surplus forms a bounded shoulder berm and collecting real spoil lowers it', () => {
  const f = setup();
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 1500);
  const pad = f.w.earthworks![0],
    berm = pad.berm;
  assert.ok(berm && berm.height > 0);
  assert.equal(terrainHeight(f.w, 80, 80), 9, 'berm remains outside the level footprint');
  const height = terrainHeight(f.w, berm.x, berm.z),
    n = pad.work!.spoil.dirt;
  assert.ok(n > 0);
  act(f.w, f.p.id, {
    type: 'earthwork',
    operation: 'collect',
    id: pad.id,
    item: 'dirt',
    quantity: n,
  });
  assert.equal(f.p.inventory.dirt, n);
  assert.ok(terrainHeight(f.w, berm.x, berm.z) < height);
});
test('saved work and bucket goods survive actual storage, while portable design does not duplicate paid spoil', async () => {
  const { Store } = await import('../src/server/store');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const f = setup();
  f.p.vehicle = 39;
  f.p.fuelVehicle = 39;
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 200);
  const store = new Store(':memory:');
  try {
    store.saveWorld(f.w);
    const w = store.loadWorlds()[0].world;
    assert.deepEqual(w.earthworks, f.w.earthworks);
    assert.deepEqual(w.players.owner.earthmovingCargo, f.p.earthmovingCargo);
  } finally {
    store.close();
  }
  const imported = createWorld('new-pad', 'New pad', 'new-owner');
  applyDesign(imported, exportDesign(f.w));
  assert.equal(imported.earthworks![0].progress, f.w.earthworks![0].progress);
  assert.deepEqual(imported.earthworks![0].work!.spoil, {});
  assert.equal(imported.earthworks![0].work!.active, false);
});
test('owned tipping trailers supply fill and receive spoil without a second cargo system', () => {
  const f = setup(11),
    pad = confirm(f);
  f.w.trailers = {
    tip: { id: 'tip', kind: 'dump', owner: f.p.id, x: 82, z: 80, heading: 0, cargo: { gravel: 2 } },
  };
  act(f.w, f.p.id, {
    type: 'earthwork',
    operation: 'deliver',
    id: pad.id,
    item: 'gravel',
    quantity: 2,
    trailer: 'tip',
  });
  assert.equal(f.w.trailers.tip.cargo.gravel ?? 0, 0);
  assert.equal(
    f.w.earthworks![0].work!.delivered,
    2 * constructionRules(f.w.settings).earthworksFillVolume,
  );
  const g = setup();
  g.p.vehicle = 39;
  g.p.fuelVehicle = 39;
  const cut = confirm(g);
  g.p.earthmovingImplement = true;
  pass(g, 200);
  const n = g.p.earthmovingCargo![39]!.dirt;
  assert.ok(n > 0);
  g.w.trailers = {
    tip: { id: 'tip', kind: 'dump', owner: g.p.id, x: 82, z: 80, heading: 0, cargo: {} },
  };
  act(g.w, g.p.id, {
    type: 'earthwork',
    operation: 'unload',
    id: cut.id,
    item: 'dirt',
    quantity: n,
    trailer: 'tip',
  });
  assert.equal(g.w.trailers.tip.cargo.dirt, n);
  assert.equal(g.p.earthmovingCargo![39]!.dirt ?? 0, 0);
});

test('map worker terrain payload excludes changing work clocks and economic inventories', async () => {
  const { chartWorld } = await import('../src/client/map-terrain-job');
  const f = setup();
  const pad = confirm(f);
  const before = JSON.stringify(chartWorld(f.w).earthworks);
  pad.work!.done = 1;
  pad.work!.seconds = 2;
  pad.work!.spoil.dirt = 4;
  assert.equal(
    JSON.stringify(chartWorld(f.w).earthworks),
    before,
    'unfinished pass accounting must not restart map terrain rendering',
  );
  f.w.earthworks = [{ ...pad, progress: 0.5 }];
  assert.notEqual(JSON.stringify(chartWorld(f.w).earthworks), before);
});

test('ordinary movement earns work while prediction leaves shared terrain untouched', () => {
  const f = setup();
  confirm(f);
  f.p.earthmovingImplement = true;
  f.p.speed = 0;
  const snapshot = structuredClone(f.w),
    prediction = structuredClone(f.p),
    before = structuredClone(snapshot);
  for (let i = 0; i < 60; i++) {
    move(f.w, f.p, { throttle: 1, steer: 0, boost: false }, 0.05);
    f.w.time += 0.05;
    move(snapshot, prediction, { throttle: 1, steer: 0, boost: false }, 0.05, true);
  }
  assert.ok(f.w.earthworks![0].progress > 0);
  assert.ok(f.p.fuel < 100);
  assert.deepEqual(snapshot, before);
});
test('stone provinces increase configurable working effort and low health reduces actual moved volume', async () => {
  const { earthworkMaterial } = await import('../src/shared/earthworks-work');
  const f = setup();
  f.w.northernIsland = {
    version: 1,
    seed: 1,
    radius: 9000,
    centreZ: -5000,
    preserveZ: -100,
    blendZ: -1000,
    mountain: { x: 0, z: -5000, height: 200, radius: 500 },
    regions: [],
    rivers: [],
    ponds: [],
    resources: [],
    previousArea: 1,
    area: 2,
  };
  const stone = earthworkMaterial(f.w, 2000, -5000);
  assert.equal(stone.material, 'stone');
  assert.ok(stone.effort > 2);
  f.w.settings.earthworksStoneEffort = 1;
  assert.equal(earthworkMaterial(f.w, 2000, -5000).effort, 1);
  const healthy = setup(),
    injured = setup();
  confirm(healthy);
  confirm(injured);
  healthy.p.earthmovingImplement = injured.p.earthmovingImplement = true;
  injured.p.health /= 2;
  pass(healthy, 4);
  pass(injured, 4);
  assert.ok(
    Math.abs(healthy.w.earthworks![0].work!.done / 2 - injured.w.earthworks![0].work!.done) < 1e-8,
  );
});

test('working dust stops when the implement lifts, movement stops or the site is abandoned', async () => {
  const { earthworkDust } = await import('../src/shared/earthworks-work');
  const f = setup();
  const pad = confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 4);
  assert.equal(earthworkDust(f.w, f.p), true);
  f.p.earthmovingImplement = false;
  assert.equal(earthworkDust(f.w, f.p), false);
  f.p.earthmovingImplement = true;
  f.p.speed = 0;
  assert.equal(earthworkDust(f.w, f.p), false);
  f.p.speed = 1;
  act(f.w, f.p.id, { type: 'earthwork', operation: 'abandon', id: pad.id });
  assert.equal(earthworkDust(f.w, f.p), false);
});

test('portable designs retain the spoil berm shape without exporting its collectible goods', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const f = setup();
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 1500);
  const pad = f.w.earthworks![0],
    berm = pad.berm!;
  const imported = createWorld('berm-design', 'Berm', 'new-owner');
  applyDesign(imported, exportDesign(f.w));
  assert.equal(terrainHeight(imported, berm.x, berm.z), terrainHeight(f.w, berm.x, berm.z));
  assert.deepEqual(imported.earthworks![0].work!.spoil, {});
  const design = exportDesign(f.w);
  design.earthworks![0].berm!.x = 200;
  const before = structuredClone(imported);
  assert.throws(() => applyDesign(imported, design), /berm|shoulder/i);
  assert.deepEqual(imported, before);
});

test('a portable pad named survey cannot bypass unfinished or foreign-site exclusion', () => {
  const f = setup();
  const pad = confirm(f);
  f.w.earthworks = [{ ...pad, id: 'survey', owner: 'someone-else' }];
  const before = structuredClone(f.w);
  assert.throws(
    () => act(f.w, f.p.id, { type: 'earthwork', operation: 'confirm', ...f.input }),
    /reserved|foreign|unfinished/i,
  );
  assert.deepEqual(f.w, before);
});

test('spoil berms preserve the surveyed maximum shoulder grade on deep cuts', async () => {
  const { earthworkSiteReason } = await import('../src/shared/earthworks-site');
  const f = setup(4);
  f.input.shoulder = 20;
  f.w.settings.earthworksDozerVolume = 10;
  assert.equal(surveyEarthwork(f.w, f.p, f.input).reason, undefined);
  confirm(f);
  f.p.earthmovingImplement = true;
  pass(f, 10000);
  const pad = f.w.earthworks![0];
  assert.equal(pad.progress, 1);
  assert.ok((pad.work!.spoil.dirt ?? 0) > 0);
  assert.equal(
    earthworkSiteReason(f.w, pad),
    undefined,
    'spoil must not steepen a valid shoulder beyond its limit',
  );
});
