// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, terrainHeight } from '../src/shared/simulation';
import { landscapeSchema, landscapeRoads, scatterObjects } from '../src/shared/landscape';
import { creatorSchema } from '../src/shared/creator';
import { exportDesign, applyDesign, configureRules } from '../src/server/world-design';
import { Store } from '../src/server/store';
const defaults = {
  terrainStampLimit: 256,
  landscapePathLimit: 16,
  landscapeBarrierLimit: 16,
  landscapeSurfaceLimit: 64,
  landscapeScatterGroupLimit: 16,
  landscapeScatterPerGroupLimit: 64,
  landscapeScatterLimit: 128,
  landscapeLinePointLimit: 16,
  landscapePointLimit: 128,
  landscapeBarrierLengthLimit: 1200,
};
const maximum = {
  terrainStampLimit: 512,
  landscapePathLimit: 64,
  landscapeBarrierLimit: 64,
  landscapeSurfaceLimit: 256,
  landscapeScatterGroupLimit: 64,
  landscapeScatterPerGroupLimit: 128,
  landscapeScatterLimit: 512,
  landscapeLinePointLimit: 32,
  landscapePointLimit: 512,
  landscapeBarrierLengthLimit: 4800,
};
function setup() {
  const w = createWorld('land-rules', 'Landscape capacities', 'owner');
  w.script = '';
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  w.terrain = [];
  w.settings.mapSize = 10000;
  w.creator = creatorSchema.parse({
    roads: false,
    scenery: false,
    models: [
      {
        id: 'rock',
        name: 'Rock',
        parts: [{ shape: 'sphere', color: '#888888' }],
      },
    ],
  });
  w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(8) });
  const p = addPlayer(w, 'owner', 'Owner');
  return { w, p };
}
const line = (i: number, count = 2) => ({
  id: 'line' + i,
  points: Array.from({ length: count }, (_, j) => ({ x: -100 + j * 2, z: -100 + i * 4 })),
  width: 1,
  curved: false,
});
const surface = (i: number) => ({
  id: 'surface' + i,
  x: -100 + i * 2,
  z: 100,
  radius: 1,
  material: 'sand',
});
const scatter = (i: number, count = 1) => ({
  id: 'scatter' + i,
  model: 'rock',
  x: -100 + i * 200,
  z: -200,
  radius: 80,
  count,
  seed: i,
});
const edit = (w: ReturnType<typeof setup>['w'], landscape: unknown) =>
  act(w, 'owner', { type: 'landscape', landscape });
const settings = (w: ReturnType<typeof setup>['w'], patch: Record<string, number>) =>
  act(w, 'owner', { type: 'settings', patch });

test('capacity defaults and legacy fallbacks preserve existing limits', async () => {
  const { w } = setup();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value, key);
  const { landscapeRules } = await import('../src/shared/landscape-rules');
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  assert.deepEqual(landscapeRules(w.settings), defaults);
  assert.throws(() => edit(w, { paths: Array.from({ length: 17 }, (_, i) => line(i)) }));
  w.terrain = Array.from({ length: 256 }, () => ({ x: 0, z: 0, radius: 1, height: 0 }));
  assert.throws(
    () => act(w, 'owner', { type: 'terrain', x: 0, z: 0, radius: 1, height: 1 }),
    /limit/,
  );
});

test('each raised landscape limit admits its extra content and overflow stays atomic', () => {
  const cases: [string, unknown, unknown][] = [
    [
      'landscapePathLimit',
      { paths: Array.from({ length: 17 }, (_, i) => line(i)) },
      { paths: Array.from({ length: 18 }, (_, i) => line(i)) },
    ],
    [
      'landscapeBarrierLimit',
      { barriers: Array.from({ length: 17 }, (_, i) => line(i)) },
      { barriers: Array.from({ length: 18 }, (_, i) => line(i)) },
    ],
    [
      'landscapeSurfaceLimit',
      { surfaces: Array.from({ length: 65 }, (_, i) => surface(i)) },
      { surfaces: Array.from({ length: 66 }, (_, i) => surface(i)) },
    ],
    [
      'landscapeScatterGroupLimit',
      { scatter: Array.from({ length: 17 }, (_, i) => scatter(i)) },
      { scatter: Array.from({ length: 18 }, (_, i) => scatter(i)) },
    ],
    ['landscapeScatterPerGroupLimit', { scatter: [scatter(0, 65)] }, { scatter: [scatter(0, 66)] }],
    [
      'landscapeScatterLimit',
      { scatter: [scatter(0, 64), scatter(1, 64), scatter(2, 1)] },
      { scatter: [scatter(0, 64), scatter(1, 64), scatter(2, 2)] },
    ],
    ['landscapeLinePointLimit', { paths: [line(0, 17)] }, { paths: [line(0, 18)] }],
    [
      'landscapePointLimit',
      { paths: [...Array.from({ length: 8 }, (_, i) => line(i, 16)), line(9)] },
      { paths: [...Array.from({ length: 8 }, (_, i) => line(i, 16)), line(9, 3)] },
    ],
    [
      'landscapeBarrierLengthLimit',
      {
        barriers: [
          {
            ...line(0),
            points: [
              { x: 0, z: 0 },
              { x: 1201, z: 0 },
            ],
          },
        ],
      },
      {
        barriers: [
          {
            ...line(0),
            points: [
              { x: 0, z: 0 },
              { x: 1202, z: 0 },
            ],
          },
        ],
      },
    ],
  ];
  for (const [key, accepted, rejected] of cases) {
    const { w } = setup();
    assert.throws(() => edit(w, accepted), key);
    settings(w, { [key]: (defaults as any)[key] + (key === 'landscapePointLimit' ? 2 : 1) });
    edit(w, accepted);
    const before = structuredClone(w);
    assert.throws(() => edit(w, rejected), key);
    assert.deepEqual(w, before, key);
  }
});

test('terrain capacity, disabled categories and invalid settings preserve content atomically', () => {
  const { w } = setup();
  settings(w, { terrainStampLimit: 257, landscapePathLimit: 0 });
  w.terrain = Array.from({ length: 256 }, () => ({ x: 0, z: 0, radius: 1, height: 0 }));
  act(w, 'owner', { type: 'terrain', x: 0, z: 0, radius: 1, height: 1 });
  assert.equal(terrainHeight(w, 0, 0), 9);
  const before = structuredClone(w);
  assert.throws(
    () => act(w, 'owner', { type: 'terrain', x: 0, z: 0, radius: 1, height: 1 }),
    /257/,
  );
  assert.throws(() => edit(w, { paths: [line(0)] }));
  assert.deepEqual(w, before);
  for (const [key, max] of Object.entries(maximum))
    for (const value of [-1, 0.5, NaN, Infinity, max + 1]) {
      assert.throws(() => settings(w, { [key]: value }), key + ' ' + value);
      assert.deepEqual(w, before);
    }
});

test('lowering protects saved content and undo history, while permitted edits keep undo usable', () => {
  const { w } = setup();
  settings(w, { landscapeSurfaceLimit: 65 });
  edit(w, { surfaces: Array.from({ length: 65 }, (_, i) => surface(i)) });
  let before = structuredClone(w);
  assert.throws(() => settings(w, { landscapeSurfaceLimit: 64 }), /existing|saved|current/i);
  assert.deepEqual(w, before);
  edit(w, {});
  before = structuredClone(w);
  assert.throws(() => settings(w, { landscapeSurfaceLimit: 64 }), /undo/i);
  assert.deepEqual(w, before);
  settings(w, { landscapeSurfaceLimit: 66 });
  act(w, 'owner', { type: 'landscape', operation: 'undo' });
  assert.equal(w.landscape!.surfaces.length, 65);
});

test('raised capacities round trip through creation, editor, summaries, observations, saves and portable designs', async () => {
  const { w, p } = setup();
  settings(w, maximum);
  edit(w, { surfaces: Array.from({ length: 65 }, (_, i) => surface(i)) });
  w.terrain = Array.from({ length: 257 }, () => ({ x: 0, z: 0, radius: 1, height: 0 }));
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  for (const [key, value] of Object.entries(maximum))
    assert.match(settingsFields(w.settings), new RegExp(`name="${key}"[^>]*value="${value}"`));
  assert.match(rulesSummary(w), /512 terrain stamps/);
  const dest = createWorld('copy', 'Copy', 'other');
  applyDesign(dest, exportDesign(w));
  const created = createWorld('created', 'Created', 'other');
  configureRules(created, maximum);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const observed = observe(
      w,
      p,
      { plan: [], index: 0 } as any,
      new NpcMemory(store),
      'resident',
    ).worldRules;
    for (const rules of [dest.settings, created.settings, saved.settings, observed])
      for (const [key, value] of Object.entries(maximum))
        assert.equal((rules as any)[key], value, key);
    assert.equal(dest.terrain.length, 257);
    assert.equal(dest.landscape!.surfaces.length, 65);
    for (const change of [
      (d: any) => {
        d.settings.terrainStampLimit = 256;
      },
      (d: any) => {
        d.settings.landscapeSurfaceLimit = 64;
      },
    ]) {
      const bad = structuredClone(exportDesign(w));
      change(bad);
      const before = structuredClone(dest);
      assert.throws(() => applyDesign(dest, bad));
      assert.deepEqual(dest, before);
    }
  } finally {
    store.close();
  }
});

test('supported ceilings fit transport and generate finite terrain, roads and solid scatter', () => {
  const { w } = setup();
  settings(w, maximum);
  const paths = Array.from({ length: 64 }, (_, i) => line(i, 4)),
    barriers = Array.from({ length: 64 }, (_, i) => ({ ...line(i + 64, 4), kind: 'fence' }));
  edit(w, {
    heightmap: Array(1089).fill(8),
    paths,
    barriers,
    surfaces: Array.from({ length: 256 }, (_, i) => surface(i)),
    scatter: Array.from({ length: 64 }, (_, i) => ({
      ...scatter(i, 8),
      x: (i % 8) * 180 - 700,
      z: Math.floor(i / 8) * 180 - 700,
      solid: true,
    })),
  });
  w.terrain = Array.from({ length: 512 }, (_, i) => ({
    x: (i % 32) * 10,
    z: Math.floor(i / 32) * 10,
    radius: 1,
    height: 1,
  }));
  assert.ok(
    Buffer.byteLength(JSON.stringify({ type: 'landscape', landscape: w.landscape })) < 524288,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(exportDesign(w))) < 524288);
  assert.equal(landscapeRoads(w).length, 192);
  const objects = scatterObjects(w);
  assert.ok(objects.length > 0 && objects.length <= 512);
  for (const o of objects) assert.ok(Number.isFinite(terrainHeight(w, o.x, o.z)));
  const before = structuredClone(w);
  assert.throws(
    () =>
      edit(w, {
        paths: [
          {
            ...line(0),
            points: [
              { x: 0, z: 0 },
              { x: 0, z: 0 },
            ],
          },
        ],
      }),
    /Separate/,
  );
  assert.throws(() => edit(w, { scatter: [{ ...scatter(0), model: 'missing' }] }), /model/);
  assert.throws(() => edit(w, { heightmap: [1, 2] }));
  assert.deepEqual(w, before);
});
