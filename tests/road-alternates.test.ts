// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { landscapeSchema } from '../src/shared/landscape';
import { growRoads } from '../src/shared/roads';
import { finishRoadGrowth } from './road-work-helpers';
import { pointDistance, roadSite } from '../src/shared/road-routing';
import type { World } from '../src/shared/types';

function triangle() {
  const w = createWorld('alternate-roads', 'Alternate roads', 'owner');
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
  w.buildings = [];
  w.zones = [];
  w.terrain = [];
  delete w.airfield;
  delete w.spaceportSite;
  Object.assign(w.settings, { mapSize: 4000, seaLevel: -10 });
  const a = { x: -300, z: 0 },
    b = { x: 0, z: -600 },
    c = { x: 300, z: 0 };
  w.towns = [a, b, c].map((p, i) => ({
    ...structuredClone(w.towns[0]),
    ...p,
    id: 'town-' + i,
    name: 'Town ' + i,
    radius: 40,
  }));
  w.roads = [
    { a, b, width: 5 },
    { a: b, b: c, width: 5 },
  ];
  return w;
}
function length(w: World) {
  return w.roads!.reduce((sum, r) => sum + pointDistance(r.a, r.b), 0);
}
function day(w: World) {
  const start = (w.roadGrowth ?? 0) * w.settings.dayLength;
  growRoads(w, start, start + w.settings.dayLength);
  finishRoadGrowth(w, start + w.settings.dayLength);
}
test('an already connected triangle grows a useful loop gradually and preserves both original roads', () => {
  let w = triangle();
  const original = structuredClone(w.roads!),
    before = length(w);
  day(w);
  assert.ok(w.roadProject, 'connected destinations still receive a useful shortcut');
  assert.equal(w.roadProject.kind, 'alternate');
  assert.ok(Math.abs(length(w) - before - 12) < 1e-6, 'share the canonical daily allowance');
  assert.deepEqual(w.roads!.slice(0, 2), original);
  w = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < 90 && w.roadProject; i++) day(w);
  assert.equal(w.roadProject, undefined);
  assert.deepEqual(w.roads!.slice(0, 2), original);
  const site = roadSite(w);
  for (const r of w.roads!.slice(2)) assert.ok(site.segment(r.a, r.b));
  const completed = structuredClone(w.roads);
  for (let i = 0; i < 3; i++) day(w);
  assert.deepEqual(w.roads, completed, 'a completed loop does not spawn redundant parallel links');
});
test('disable, absolute and relative saving thresholds reject a candidate before construction', () => {
  for (const patch of [
    { roadAlternateRoutes: false },
    { roadAlternateSavingMetres: 1000 },
    { roadAlternateSavingFraction: 0.9 },
  ]) {
    const w = triangle(),
      original = structuredClone(w.roads);
    Object.assign(w.settings, patch);
    day(w);
    assert.equal(w.roadProject, undefined);
    assert.deepEqual(w.roads, original);
  }
});
test('an efficient connected triangle and a mid-segment junction do not create pointless roads', () => {
  const w = triangle();
  w.roads!.push({ a: { x: -400, z: 0 }, b: { x: 400, z: 0 }, width: 5 });
  const original = structuredClone(w.roads);
  day(w);
  assert.equal(w.roadProject, undefined);
  assert.deepEqual(w.roads, original);
});
test('a disconnected town gets connection work before optional shortcuts', () => {
  const w = triangle();
  w.towns.push({ ...structuredClone(w.towns[0]), id: 'disconnected', x: 600, z: 100 });
  day(w);
  assert.equal(w.roadProject?.kind, 'town');
  assert.equal(w.roadProject?.town, 'disconnected');
});
test('a policy change pauses an unfinished alternate while preserving its laid roads', () => {
  const w = triangle();
  day(w);
  assert.ok(w.roadProject, 'start the useful route');
  const roads = structuredClone(w.roads);
  Object.assign(w.settings, { roadAlternateRoutes: false });
  day(w);
  assert.deepEqual(w.roads, roads);
  assert.equal(
    w.roadProject,
    undefined,
    'discard the remaining proposal for a new survey on enable',
  );
});
test('spaceport access participates without depending on town or destination names', () => {
  const w = triangle();
  w.towns.pop();
  const fence = 30;
  w.spaceportSite = {
    x: 300 - fence / Math.SQRT2,
    z: -fence / Math.SQRT2,
    height: 10,
    building: 'port',
    exclusion: 30,
    fence,
  };
  day(w);
  assert.equal(w.roadProject?.kind, 'alternate');
});
test('parallel-road limit rejects a shortcut and its world-builder override permits it', () => {
  const w = triangle();
  Object.assign(w.settings, {
    roadAlternateParallelDistance: 500,
    roadAlternateParallelFraction: 0,
  });
  const original = structuredClone(w.roads);
  day(w);
  assert.equal(w.roadProject, undefined);
  assert.deepEqual(w.roads, original);
  Object.assign(w.settings, { roadAlternateParallelFraction: 1 });
  day(w);
  assert.equal((w as World).roadProject?.kind, 'alternate');
});
test('an impassable ridge defeats an apparent straight-line shortcut', () => {
  const w = triangle();
  // Keep the existing V journey south of a solid barrier.
  w.landscape!.barriers = [
    {
      id: 'wall',
      kind: 'wall',
      points: [
        { x: 0, z: -570 },
        { x: 0, z: 600 },
      ],
      height: 3,
      width: 3,
    },
  ];
  w.landscape = landscapeSchema.parse(w.landscape);
  const original = structuredClone(w.roads);
  day(w);
  assert.equal(w.roadProject, undefined);
  assert.deepEqual(w.roads, original);
});
test('actual terrain detour length can erase a promising straight-line saving', async () => {
  const w = triangle();
  w.towns[1].z = -150;
  w.roads![0].b.z = -150;
  w.roads![1].a.z = -150;
  Object.assign(w.settings, { roadAlternateSavingMetres: 20, roadAlternateSavingFraction: 0.05 });
  w.landscape!.barriers = [
    {
      id: 'barrier',
      kind: 'wall',
      points: [
        { x: 0, z: -130 },
        { x: 0, z: 600 },
      ],
      height: 3,
      width: 3,
    },
  ];
  w.landscape = landscapeSchema.parse(w.landscape);
  const { roadRoute } = await import('../src/shared/road-routing');
  const route = roadRoute(w, w.towns[0], w.towns[2]);
  assert.ok(route, 'an actual terrain-safe detour exists');
  const proposed = route.slice(1).reduce((n, p, i) => n + pointDistance(route[i], p), 0);
  assert.ok(length(w) - 600 > 20, 'straight-line arithmetic alone would approve');
  assert.ok(
    length(w) - proposed < 20 || (length(w) - proposed) / length(w) < 0.05,
    'surveyed detour fails benefit',
  );
  const original = structuredClone(w.roads);
  day(w);
  assert.equal(w.roadProject, undefined);
  assert.deepEqual(w.roads, original);
});
test('alternate rules validate atomically, survive portable designs and explain their live values', async () => {
  const { addPlayer, act } = await import('../src/shared/simulation');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { roadRules } = await import('../src/shared/road-rules');
  const { settingsFields } = await import('../src/client/creator-editor');
  const w = triangle(),
    p = addPlayer(w, 'owner', 'Builder');
  const patch = {
    roadAlternateRoutes: false,
    roadAlternateSavingFraction: 0.3,
    roadAlternateSavingMetres: 250,
    roadAlternateParallelFraction: 0.1,
    roadAlternateParallelDistance: 25,
  };
  act(w, p.id, { type: 'settings', patch });
  const target = triangle();
  applyDesign(target, exportDesign(w));
  for (const [key, value] of Object.entries(patch)) {
    assert.equal((roadRules(target.settings) as any)[key], value);
    assert.ok(settingsFields(w.settings).includes(`name="${key}"`));
  }
  const before = JSON.stringify(w.settings);
  for (const patch of [
    { roadAlternateSavingFraction: 2 },
    { roadAlternateSavingMetres: -1 },
    { roadAlternateParallelDistance: 501 },
    { roadAlternateRoutes: 1 },
  ]) {
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.equal(JSON.stringify(w.settings), before);
  }
  assert.match(rulesSummary(w), /alternate routes off.*30%.*250 m.*10%.*25 m/);
});

test('parallel scoring stays bounded on a finely segmented existing network', async () => {
  const { planAlternateRoadSteps } = await import('../src/shared/road-alternates');
  const w = triangle();
  w.roads = w.roads!.flatMap((r) =>
    Array.from({ length: 1000 }, (_, i) => ({
      a: { x: r.a.x + ((r.b.x - r.a.x) * i) / 1000, z: r.a.z + ((r.b.z - r.a.z) * i) / 1000 },
      b: {
        x: r.a.x + ((r.b.x - r.a.x) * (i + 1)) / 1000,
        z: r.a.z + ((r.b.z - r.a.z) * (i + 1)) / 1000,
      },
      width: r.width,
    })),
  );
  const work = planAlternateRoadSteps(w);
  let count = 0,
    result = work.next();
  while (!result.done) {
    count++;
    result = work.next();
  }
  assert.equal(result.value?.kind, 'alternate', 'segmentation cannot remove a useful route');
  assert.ok(count < 200000, `avoid testing every road against every path sample (${count} steps)`);
});

test('survey the strongest possible saving first and prune candidates that cannot beat it', async () => {
  const { planAlternateRoadSteps } = await import('../src/shared/road-alternates');
  const w = triangle();
  const points = [
    { x: 0, z: 0 },
    { x: 600, z: 0 },
    { x: 600, z: 600 },
    { x: 0, z: 600 },
  ];
  w.towns = points.map((p, i) => ({ ...structuredClone(w.towns[0]), ...p, id: 'town-' + i }));
  w.roads = points.slice(1).map((p, i) => ({ a: points[i], b: p, width: 5 }));
  const work = planAlternateRoadSteps(w);
  let count = 0,
    result = work.next();
  while (!result.done) {
    count++;
    result = work.next();
  }
  assert.equal(result.value?.kind, 'alternate');
  assert.deepEqual(result.value.path[0], points[0]);
  assert.deepEqual(result.value.path.at(-1), points[3]);
  assert.ok(
    count < 10000,
    `do not terrain-survey weaker candidates after the winner (${count} steps)`,
  );
});
