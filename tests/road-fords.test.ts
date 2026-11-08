// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { creatorSchema } from '../src/shared/creator';
import { riverBanks, inlandWaterAt } from '../src/shared/inland-water';
import { terrainHeight } from '../src/shared/terrain';
import { inlandBlocksGround } from '../src/shared/inland-travel';
import { roadSite, roadRoute, roadSamples, roadComponents } from '../src/shared/road-routing';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { rulesSummary } from '../src/shared/rulesets';
import { roadFords } from '../src/shared/road-fords';

function world() {
  const w = createWorld('puddlewick', 'Ford routing', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.towns = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  delete w.airfield;
  delete w.spaceportSite;
  return w;
}
function crossing(w: ReturnType<typeof world>, index = 12) {
  const river = w.northernIsland!.rivers[0],
    p = river.points[index],
    banks = riverBanks(river.points)[index],
    dx = (banks.right.x - banks.left.x) / p.width,
    dz = (banks.right.z - banks.left.z) / p.width;
  return {
    a: { x: p.x - (dx - 4 * dz) * (p.width / 2 + 12), z: p.z - (dz + 4 * dx) * (p.width / 2 + 12) },
    b: { x: p.x + (dx - 4 * dz) * (p.width / 2 + 12), z: p.z + (dz + 4 * dx) * (p.width / 2 + 12) },
  };
}
const baseline = world();
test('a physical shallow ford and its complete approaches are valid dirt-road terrain', () => {
  const w = structuredClone(baseline),
    { a, b } = crossing(w);
  const length = Math.hypot(b.x - a.x, b.z - a.z),
    steps = Math.ceil(length / 2);
  const height = (i: number) =>
    terrainHeight(w, a.x + ((b.x - a.x) * i) / steps, a.z + ((b.z - a.z) * i) / steps);
  for (let i = 1; i <= steps; i++)
    assert.ok(
      Math.abs(height(i) - height(i - 1)) / (length / steps) <= 0.35,
      'fixture approaches meet the existing road grade',
    );
  assert.equal(inlandBlocksGround(w, a, b, 2.5), false, 'real movement accepts the shallow ford');
  assert.ok(
    roadSite(w).segment(a, b),
    'road planner accepts the traversable ford, not only dry land',
  );
  assert.ok(roadRoute(w, a, b), 'route can cross the complete ford');
});
test('deep reaches stay blocked and the configurable ford depth is also used by movement', () => {
  const w = structuredClone(baseline),
    { a, b } = crossing(w);
  Object.assign(w.settings, { groundWaterDepth: 0.1 });
  assert.equal(inlandBlocksGround(w, a, b, 2.5), true, 'lower world depth applies to vehicles');
  assert.equal(roadSite(w).segment(a, b), false);
  Object.assign(w.settings, { groundWaterDepth: 0.8 });
  assert.equal(inlandBlocksGround(w, a, b, 2.5), false);
  const deep = crossing(w, 340);
  assert.equal(roadSite(w).segment(deep.a, deep.b), false);
  assert.equal(inlandBlocksGround(w, deep.a, deep.b, 2.5), true);
  Object.assign(w.settings, { roadFords: false });
  assert.equal(roadSite(w).segment(a, b), false, 'world can prevent new ford roads');
});
test('ford rules validate atomically and survive portable world designs', () => {
  const w = structuredClone(baseline),
    p = addPlayer(w, 'owner', 'Owner');
  act(w, p.id, {
    type: 'settings',
    patch: { groundWaterDepth: 0.45, roadFords: false, roadMaxGrade: 0.2 },
  });
  assert.equal((w.settings as any).groundWaterDepth, 0.45);
  assert.equal((w.settings as any).roadFords, false);
  const before = JSON.stringify(w.settings);
  assert.throws(() =>
    act(w, p.id, { type: 'settings', patch: { groundWaterDepth: -1, roadFords: true } }),
  );
  assert.equal(JSON.stringify(w.settings), before);
  const target = createWorld('imported', 'Imported', 'owner');
  applyDesign(target, exportDesign(w));
  assert.equal((target.settings as any).groundWaterDepth, 0.45);
  assert.equal((target.settings as any).roadFords, false);
  assert.match(rulesSummary(w), /0.45/);
});

test('ford surveys retain clock-stable caches but invalidate changed obstacles and depth', () => {
  const w = structuredClone(baseline);
  // Keep a real shallow reach with its actual sloping banks, not a mocked crossing.
  const river = w.northernIsland!.rivers[0];
  w.northernIsland!.rivers = [{ ...river, points: river.points.slice(8, 20) }];
  const initial = roadFords(w, roadSite(w), 5);
  assert.ok(initial.length > 0, 'physical reach contains a usable full-width ford');
  for (const ford of initial) {
    assert.ok(roadSite(w).segment(ford.a, ford.b));
    assert.equal(inlandBlocksGround(w, ford.a, ford.b, 2.5), false);
  }
  w.settings.time += 60;
  assert.equal(roadFords(w, roadSite(w), 5), initial, 'clock changes reuse the survey');
  const first = initial[0];
  w.buildings.push(
    makeBuilding(
      'ford-obstruction',
      'warehouse',
      (first.a.x + first.b.x) / 2,
      (first.a.z + first.b.z) / 2,
    ),
  );
  const obstructed = roadFords(w, roadSite(w), 5);
  assert.notEqual(obstructed, initial);
  assert.ok(
    !obstructed.some((f) => f.id === first.id),
    'a blocked crossing is not cached as usable',
  );
  w.buildings = [];
  w.settings.groundWaterDepth = 0.01;
  assert.equal(
    roadFords(w, roadSite(w), 5).length,
    0,
    'changed depth rejects formerly shallow crossings',
  );
  w.settings.groundWaterDepth = 0.8;
  const restored = roadFords(w, roadSite(w), 5);
  assert.deepEqual(restored, initial, 'restoring the same geometry gives the same survey');
  const loaded = JSON.parse(JSON.stringify(w));
  assert.deepEqual(roadFords(loaded, roadSite(loaded), 5), initial, 'restart is deterministic');
});

test('a distant settlement reaches a usable ford rather than attempting a deep direct crossing', () => {
  const w = structuredClone(baseline);
  const river = w.northernIsland!.rivers[0],
    p = river.points[220],
    banks = riverBanks(river.points)[220];
  const dx = (banks.right.x - banks.left.x) / p.width,
    dz = (banks.right.z - banks.left.z) / p.width;
  const a = { x: p.x - dx * 1200, z: p.z - dz * 1200 },
    b = { x: p.x + dx * 1200, z: p.z + dz * 1200 };
  assert.ok(roadSite(w).clear(a) && roadSite(w).clear(b), 'both town approaches are dry and clear');
  assert.equal(inlandBlocksGround(w, a, b, 2.5), true, 'direct river crossing is too deep');
  const path = roadRoute(w, a, b);
  assert.ok(path, 'distant town receives an actual connected ford route');
  for (let i = 1; i < path.length; i++) {
    assert.ok(
      roadSite(w).segment(path[i - 1], path[i]),
      'whole route meets lane, grade and water rules',
    );
    assert.equal(
      inlandBlocksGround(w, path[i - 1], path[i], 2.5),
      false,
      'actual ground movement accepts every segment',
    );
  }
});

test('road growth yields within the server tick budget while surveying a distant town', async () => {
  const { growRoads } = await import('../src/shared/roads');
  let w = structuredClone(baseline);
  const town = createWorld('town-template', 'Template', 'owner').towns[0];
  const river = w.northernIsland!.rivers[0],
    p = river.points[220],
    banks = riverBanks(river.points)[220];
  const dx = (banks.right.x - banks.left.x) / p.width,
    dz = (banks.right.z - banks.left.z) / p.width;
  const a = { x: p.x - dx * 1200, z: p.z - dz * 1200 },
    b = { x: p.x + dx * 1200, z: p.z + dz * 1200 };
  w.towns = [
    { ...structuredClone(town), ...a, id: 'origin', radius: 50 },
    { ...structuredClone(town), ...b, id: 'destination', radius: 50 },
  ];
  w.roads = [{ a: { x: a.x - 5, z: a.z }, b: { x: a.x + 5, z: a.z }, width: 5 }];
  const start = performance.now();
  growRoads(w, 0, w.settings.dayLength);
  const elapsed = performance.now() - start;
  assert.ok(elapsed <= 100, `road survey blocked the server tick for ${elapsed.toFixed(1)} ms`);
  // Restart while planning: the queued construction allowance must not vanish.
  w = JSON.parse(JSON.stringify(w));
  const deadline = performance.now() + 90000;
  let calls = 0,
    max = elapsed;
  while ((w.roadGrowth ?? 0) < 2 && performance.now() < deadline) {
    const tick = performance.now();
    growRoads(w, w.settings.dayLength, w.settings.dayLength * 2);
    max = Math.max(max, performance.now() - tick);
    assert.ok(max <= 100, `resumed road work blocked for ${max.toFixed(1)} ms`);
    w.settings.time = (w.settings.time + 1) % 86400;
    calls++;
  }
  assert.equal(
    w.roadGrowth,
    2,
    'pending survey eventually completes after reload and clock changes',
  );
  const laid = w.roads!.reduce((n, r) => n + Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), 0) - 10;
  assert.ok(Math.abs(laid - 24) < 1e-6, 'both days retain their exact construction allowance');
  console.log({ calls, maxTickMs: max, laid });
  // Complete the same persisted route at an explicitly faster per-world rate.
  // The preceding assertion retains the default 12 m/day conservation check.
  w.settings.roadGrowthPerDay = 1000;
  const completionDeadline = performance.now() + 90000;
  while ((w.roadGrowth ?? 0) < 10 && performance.now() < completionDeadline) {
    const tick = performance.now();
    growRoads(w, w.settings.dayLength * 2, w.settings.dayLength * 10);
    assert.ok(performance.now() - tick <= 100, 'construction also yields within the tick budget');
  }
  assert.equal(w.roadGrowth, 10, 'full crossing construction eventually finishes');
  assert.equal(w.roadProject, undefined);
  assert.equal(roadComponents(w.roads!).length, 1, 'both settlements join the same road network');
  for (const road of w.roads!)
    assert.equal(
      inlandBlocksGround(w, road.a, road.b, road.width / 2),
      false,
      'every laid segment is traversable',
    );
  assert.deepEqual(JSON.parse(JSON.stringify(w)).roads, w.roads, 'complete crossing persists');
});

test('a dry centreline beside a deep bank cannot hide an impassable lane edge', () => {
  const w = structuredClone(baseline),
    r = w.northernIsland!.rivers[0],
    p = r.points[340],
    banks = riverBanks(r.points)[340],
    dx = (banks.right.x - banks.left.x) / p.width,
    dz = (banks.right.z - banks.left.z) / p.width;
  const c = { x: p.x - dx * (p.width / 2 + 0.5), z: p.z - dz * (p.width / 2 + 0.5) },
    a = { x: c.x - dz, z: c.z + dx },
    b = { x: c.x + dz, z: c.z - dx };
  assert.equal(inlandWaterAt(w, a.x, a.z), undefined, 'start centre is on dry bank');
  assert.equal(inlandWaterAt(w, b.x, b.z), undefined, 'end centre is on dry bank');
  assert.equal(inlandBlocksGround(w, a, b, 2.5), true, 'vehicle edge cannot pass');
  assert.equal(roadSite(w).segment(a, b), false, 'refuse a road with an impassable lane edge');
});

test('a connected route traverses two separate rivers with usable full-width approaches', () => {
  const w = structuredClone(baseline),
    river = w.northernIsland!.rivers[0],
    p = river.points[12],
    banks = riverBanks(river.points)[12],
    dx = (banks.right.x - banks.left.x) / p.width,
    dz = (banks.right.z - banks.left.z) / p.width;
  w.northernIsland!.rivers = [
    river,
    {
      ...structuredClone(river),
      id: 'second-river',
      points: river.points.map((p) => ({ ...p, x: p.x + dx * 500, z: p.z + dz * 500 })),
    },
  ];
  const { a, b: originalEnd } = crossing(w),
    b = { x: originalEnd.x + dx * 500, z: originalEnd.z + dz * 500 };
  const path = roadRoute(w, a, b);
  assert.ok(path, 'both rivers receive one continuous route');
  const crossed = new Set<string>();
  const site = roadSite(w);
  for (let i = 1; i < path.length; i++) {
    assert.ok(site.segment(path[i - 1], path[i]), 'every lane and approach is safe');
    assert.equal(inlandBlocksGround(w, path[i - 1], path[i], 2.5), false);
    for (const point of roadSamples({ a: path[i - 1], b: path[i], width: 5 }, 1)) {
      const river = inlandWaterAt(w, point.x, point.z)?.river;
      if (river) crossed.add(river);
    }
  }
  assert.deepEqual(
    [...crossed].sort(),
    [river.id, 'second-river'].sort(),
    'crosses both rivers rather than bypassing their endpoints',
  );
});

test('absent fords and stricter grade or width rules cannot create false crossings', () => {
  const w = structuredClone(baseline),
    river = w.northernIsland!.rivers[0];
  w.northernIsland!.rivers = [{ ...river, points: river.points.slice(8, 20) }];
  assert.ok(roadFords(w, roadSite(w), 5).length > 0);
  w.settings.roadMaxGrade = 0.01;
  assert.equal(roadFords(w, roadSite(w), 5).length, 0, 'steep full approaches are rejected');
  w.settings.roadMaxGrade = 0.35;
  w.northernIsland!.rivers = [{ ...river, points: river.points.slice(330, 350) }];
  assert.equal(roadFords(w, roadSite(w), 5).length, 0, 'all-deep river has no usable ford');
  assert.equal(
    roadFords(w, roadSite(w, 20), 20).length,
    0,
    'a wider lane cannot bypass deep-water refusal',
  );
});

test('editing river coordinates invalidates cached crossing geography as well as the ford list', () => {
  const w = structuredClone(baseline),
    river = w.northernIsland!.rivers[0];
  w.northernIsland!.rivers = [{ ...river, points: river.points.slice(8, 20) }];
  assert.ok(roadFords(w, roadSite(w), 5).length > 0);
  for (const p of w.northernIsland!.rivers[0].points) p.x += 500;
  const edited = roadFords(w, roadSite(w), 5),
    reloaded = JSON.parse(JSON.stringify(w));
  assert.deepEqual(
    edited,
    roadFords(reloaded, roadSite(reloaded), 5),
    'an in-place river edit matches a fresh survey after reload',
  );
});
