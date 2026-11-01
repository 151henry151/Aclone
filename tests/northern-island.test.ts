// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, makeBuilding } from '../src/shared/simulation';
import { expandPuddlewickIsland, islandArea } from '../src/server/puddlewick-island';
import { terrainHeight, woodland, landBounds, mapHalf } from '../src/shared/terrain';
import { worldResources, resourceAmount, resourceNode } from '../src/shared/resources';
import {
  inlandWaterAt,
  riverBanks,
  riverSediment,
  inlandGround,
  riverSurfacePoints,
} from '../src/shared/inland-water';
import { inlandBlocksGround, riverDepth } from '../src/shared/inland-travel';
import { surfaceWaterLevel, boatSeaPose } from '../src/shared/ocean';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { chartWorld, sampleMapTerrain } from '../src/client/map-terrain-job';
import { constructionSiteReason } from '../src/shared/construction-site';
import { horizonGeometry } from '../src/client/horizon-land';
import {
  northernHeight,
  regionalMaterials,
  resourceProvinces,
  regionalResourceWeights,
} from '../src/shared/northern-island';
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  return w;
}
const original = setup();
const expanded = structuredClone(original);
expandPuddlewickIsland(expanded);
test('six resource provinces have a specialty and scarcity without changing ordinary materials or total density', () => {
  const n = expanded.northernIsland!;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const weights = regionalResourceWeights(
      n,
      Math.cos(a) * n.radius * 0.6,
      n.centreZ + Math.sin(a) * n.radius * 0.6,
    );
    const province = resourceProvinces[i];
    regionalMaterials.forEach((item, index) =>
      assert.ok(
        Math.abs(
          weights[index] - (item === province.rich ? 1.8 : item === province.scarce ? 0.2 : 1),
        ) < 1e-9,
      ),
    );
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 4) < 1e-9);
    const nodes = n.resources.filter(
      (p) =>
        p.id.startsWith('extra-north-') &&
        Math.round((Math.atan2(p.z - n.centreZ, p.x) / (Math.PI / 3) + 6) % 6) % 6 === i,
    );
    const count = (item: string) => nodes.filter((p) => p.item === item).length;
    assert.ok(nodes.length > 150);
    assert.ok(
      count(province.rich) > count(province.scarce) * 3,
      `${province.name} has a material difference`,
    );
    for (const item of regionalMaterials.filter(
      (item) => item !== province.rich && item !== province.scarce,
    ))
      assert.ok(
        count(item) / nodes.length > 0.15 && count(item) / nodes.length < 0.35,
        `${province.name}: ${item} stays near average`,
      );
    const boundary = a + Math.PI / 6;
    const sample = (delta: number) =>
      regionalResourceWeights(
        n,
        Math.cos(boundary + delta) * 10000,
        n.centreZ + Math.sin(boundary + delta) * 10000,
      );
    sample(-0.0001).forEach((v, index) =>
      assert.ok(Math.abs(v - sample(0.0001)[index]) < 0.002, 'continuous province border'),
    );
  }
});
test('northern mainland adds tenfold land area without moving southern land, towns or resource IDs', () => {
  const w = structuredClone(original),
    before = worldResources(w),
    settlements = structuredClone(w.buildings);
  w.resources = { [before[0].id]: { amount: 4, updated: w.time } };
  assert.equal(expandPuddlewickIsland(w), true);
  assert.deepEqual(w.buildings, settlements);
  assert.ok(w.northernIsland!.area / w.northernIsland!.previousArea > 9.5);
  assert.ok(w.northernIsland!.area / w.northernIsland!.previousArea < 10.5);
  for (let z = -1200; z < 9000; z += 179)
    for (let x = -9000; x < 9000; x += 191) {
      assert.equal(
        terrainHeight(w, x, z),
        terrainHeight(original, x, z),
        `southern height ${x},${z}`,
      );
      assert.equal(woodland(w, x, z), woodland(original, x, z), `southern forest ${x},${z}`);
    }
  for (const n of before)
    assert.deepEqual(
      worldResources(w).find((a) => a.id === n.id),
      n,
    );
  assert.equal(resourceAmount(w, before[0]), 4);
  const saved = JSON.stringify(w);
  assert.equal(expandPuddlewickIsland(w), false);
  assert.equal(JSON.stringify(w), saved);
  const reloaded = JSON.parse(saved);
  assert.equal(expandPuddlewickIsland(reloaded), false);
  assert.deepEqual(worldResources(reloaded), worldResources(w));
  assert.ok(mapHalf(w) + landBounds(w).minZ > 7000, 'ocean outside northern coast');
  assert.ok(w.northernIsland!.resources.length > before.length * 5);
});
test('headwaters descend continuously to the ocean, with narrow fords and deep lower channels', () => {
  const w = expanded,
    n = w.northernIsland!;
  assert.equal(n.rivers.length, 5);
  assert.ok(n.ponds.length >= 12);
  assert.ok(terrainHeight(w, n.mountain.x, n.mountain.z) > 1200);
  for (const r of n.rivers) {
    const banks = riverBanks(r.points);
    assert.ok(r.points[0].level > 700);
    assert.equal(r.points.at(-1)!.level, w.settings.seaLevel);
    assert.ok(terrainHeight(w, r.points.at(-1)!.x, r.points.at(-1)!.z) < w.settings.seaLevel);
    for (let i = 0; i < r.points.length; i++) {
      const p = r.points[i];
      assert.ok(p.z < -1200);
      if (i) assert.ok(p.level <= r.points[i - 1].level);
      assert.ok(terrainHeight(w, p.x, p.z) < p.level, `${r.name} wet bed at ${i}`);
      if (p.level > w.settings.seaLevel + 0.01) {
        for (const b of [banks[i].left, banks[i].right])
          assert.ok(terrainHeight(w, b.x, b.z) > p.level - 1, `${r.name} supported bank at ${i}`);
      }
    }
    const crossing = (i: number) => {
      const p = r.points[i],
        b = banks[i];
      const dx = (b.right.x - b.left.x) / p.width,
        dz = (b.right.z - b.left.z) / p.width;
      return {
        a: { x: p.x - dx * (p.width / 2 + 5), z: p.z - dz * (p.width / 2 + 5) },
        b: { x: p.x + dx * (p.width / 2 + 5), z: p.z + dz * (p.width / 2 + 5) },
      };
    };
    const shallow = crossing(12),
      deep = crossing(Math.floor(r.points.length * 0.6));
    assert.equal(inlandBlocksGround(w, shallow.a, shallow.b), false, 'ford is crossable');
    assert.equal(
      inlandBlocksGround(w, deep.a, deep.b),
      true,
      'swept movement cannot skip deep river',
    );
    assert.equal(
      [deep.a, deep.b].some(
        (bank) => !inlandBlocksGround(w, r.points[Math.floor(r.points.length * 0.6)], bank),
      ),
      true,
      'submerged save can retreat toward the shallower bank',
    );
  }
});
test('ground physics crosses a ford and stops at a deep reach; boats follow the elevated surface', () => {
  const w = structuredClone(expanded);
  w.buildings = [];
  w.settings.vehicleMaintenance = false;
  const r = w.northernIsland!.rivers[0],
    banks = riverBanks(r.points);
  for (const [index, blocked] of [
    [12, false],
    [Math.floor(r.points.length * 0.6), true],
  ] as const) {
    const point = r.points[index],
      b = banks[index];
    const dx = (b.right.x - b.left.x) / point.width,
      dz = (b.right.z - b.left.z) / point.width;
    const p = addPlayer(w, `driver-${index}`, 'Driver');
    Object.assign(p, {
      x: point.x - dx * (point.width / 2 + 5),
      z: point.z - dz * (point.width / 2 + 5),
      heading: Math.atan2(dx, dz),
      fuel: 100,
      engine: true,
      vehicle: 0,
      speed: 0,
    });
    p.y = terrainHeight(w, p.x, p.z);
    for (let i = 0; i < 900; i++) move(w, p, { throttle: 1, steer: 0, boost: false }, 1 / 30);
    const along = (p.x - point.x) * dx + (p.z - point.z) * dz;
    assert.equal(along > point.width / 2, !blocked, `crossing ${index}: ${along}`);
    assert.ok(riverDepth(w, p) < 0.82);
  }
  const p = r.points[180];
  assert.ok(Math.abs(boatSeaPose(w, p.x, p.z, 0, 3, 1.5).y - p.level) < 0.3);
  assert.equal(surfaceWaterLevel(w, p.x, p.z), p.level);
});
test('new resources and forest avoid inland water, and inland ponds reject foundations', () => {
  const w = expanded;
  for (const n of w.northernIsland!.resources.filter((n) => n.id.startsWith('extra-north-'))) {
    assert.equal(inlandWaterAt(w, n.x, n.z), undefined);
    assert.ok(terrainHeight(w, n.x, n.z) > w.settings.seaLevel + 3);
  }
  for (const p of w.northernIsland!.ponds) {
    assert.equal(woodland(w, p.x, p.z), 0);
    assert.match(
      constructionSiteReason(w, makeBuilding('test', 'home', p.x, p.z)) ?? '',
      /dry land/,
    );
  }
  const forest = w.northernIsland!.regions.find((r) => r.forest > 0.9)!;
  assert.ok(woodland(w, forest.x, forest.z) > 0.8);
});
test('portable designs preserve new geography and resource locations, and reject malformed rivers', () => {
  const w = structuredClone(expanded),
    design = exportDesign(w),
    copy = createWorld('copy', 'Copy', 'owner');
  applyDesign(copy, design);
  assert.deepEqual(copy.northernIsland, w.northernIsland);
  assert.deepEqual(worldResources(copy), worldResources(w));
  for (const r of w.northernIsland!.rivers)
    for (const p of r.points.filter((_, i) => i % 21 === 0))
      assert.equal(terrainHeight(copy, p.x, p.z), terrainHeight(w, p.x, p.z));
  const invalid = structuredClone(design);
  invalid.northernIsland!.rivers[0].points[1].level += 100;
  assert.throws(() => applyDesign(copy, invalid));
  w.additionalResources = [resourceNode('extra-future', 'stone', 10, -2000)];
  assert.ok(worldResources(w).some((n) => n.id === 'extra-future'));
  w.resourceRelocations = { [w.northernIsland!.resources[0].id]: { x: 10, z: 12 } };
  assert.equal(worldResources(w)[0].x, 10);
});
test('map workers include rivers without shipping resource catalogues; distant land covers the northern mountain', () => {
  const snapshot = chartWorld(expanded);
  assert.equal(snapshot.northernIsland!.resources.length, 0);
  const p = expanded.northernIsland!.rivers[0].points[180];
  const paths = sampleMapTerrain({
    id: 1,
    world: snapshot,
    width: 300,
    height: 200,
    x: p.x,
    z: p.z,
    offsetX: 150,
    offsetY: 100,
    scale: 0.5,
    contours: true,
    tide: 0,
  });
  assert.ok(paths.inland.length > 100);
  const job = horizonGeometry(expanded);
  let result = job.next(),
    yields = 0;
  while (!result.done) {
    result = job.next();
    yields++;
  }
  const g = result.value;
  g.computeBoundingBox();
  assert.ok(g.boundingBox!.min.z < -35000);
  assert.ok(g.boundingBox!.max.y > 1200);
  assert.ok(yields > 100);
  assert.ok(g.getAttribute('position').count < 800000, 'bounded horizon geometry');
  g.dispose();
});
test('private worlds are untouched and the old terrain footprint is frozen even without a prior ocean migration', () => {
  const w = createWorld('private', 'Private', 'owner');
  assert.equal(expandPuddlewickIsland(w), false);
  const old = setup();
  delete old.terrainMapSize;
  old.settings.mapSize = 12500;
  const h = terrainHeight(old, 2100, 1800);
  assert.equal(expandPuddlewickIsland(old), true);
  assert.equal(old.terrainMapSize, 12500);
  assert.equal(terrainHeight(old, 2100, 1800), h);
});

test('rivers seek lower terrain, meander, and vary channel width with local gradient', () => {
  const n = expanded.northernIsland!,
    sea = expanded.settings.seaLevel;
  for (const r of n.rivers) {
    const first = r.points[0],
      last = r.points.at(-1)!;
    let length = 0,
      climb = 0,
      directClimb = 0,
      previous = northernHeight(n, first.x, first.z, sea);
    let steep = 0,
      flat = 0,
      steepCount = 0,
      flatCount = 0;
    for (let i = 1; i < r.points.length; i++) {
      const p = r.points[i],
        a = r.points[i - 1],
        d = Math.hypot(p.x - a.x, p.z - a.z);
      length += d;
      climb += Math.max(0, northernHeight(n, p.x, p.z, sea) - northernHeight(n, a.x, a.z, sea));
      const t = i / (r.points.length - 1),
        h = northernHeight(
          n,
          first.x + (last.x - first.x) * t,
          first.z + (last.z - first.z) * t,
          sea,
        );
      directClimb += Math.max(0, h - previous);
      previous = h;
      const width = p.width / (4.5 + 36 * t ** 1.35),
        slope = (a.level - p.level) / d;
      if (slope > 0.1) {
        steep += width;
        steepCount++;
      }
      if (slope < 0.008) {
        flat += width;
        flatCount++;
      }
    }
    assert.ok(
      length / Math.hypot(last.x - first.x, last.z - first.z) > 1.06,
      r.name + ' has genuine bends',
    );
    assert.ok(
      climb < directClimb * 0.95,
      r.name + ' avoids ridges compared with a straight route: ' + climb + ' vs ' + directClimb,
    );
    assert.ok(steepCount > 10 && flatCount > 10);
    assert.ok(steep / steepCount < (flat / flatCount) * 0.8, r.name + ' narrows in steep reaches');
    assert.ok(r.points.length <= 600);
  }
});

test('bends have sediment bars on the inside and deeper pools on the outside', () => {
  const w = structuredClone(expanded);
  const points = Array.from({ length: 31 }, (_, i) => {
    const a = (i / 30) * Math.PI;
    return { x: Math.cos(a) * 100, z: -10000 + Math.sin(a) * 100, width: 24, depth: 3, level: 100 };
  });
  w.northernIsland!.rivers = [{ id: 'test-bend', name: 'Bend', points }];
  w.northernIsland!.ponds = [];
  const p = points[15],
    b = riverBanks(points)[15];
  const nx = (b.left.x - p.x) / 12,
    nz = (b.left.z - p.z) / 12;
  const at = (d: number) => ({ x: p.x + nx * d, z: p.z + nz * d });
  const inside = at(7),
    outside = at(-7);
  assert.ok(riverDepth(w, outside) > riverDepth(w, inside) * 1.2, 'deeper outer bend');
  const bar = at(14),
    cut = at(-14);
  assert.ok(riverSediment(w, bar.x, bar.z) > 0.25, 'exposed inner bar');
  assert.equal(riverSediment(w, cut.x, cut.z), 0, 'outer bank remains vegetated');
  assert.ok(
    terrainHeight(w, bar.x, bar.z) < terrainHeight(w, cut.x, cut.z),
    'bar shelves gently; outer bank is steeper',
  );
});

test('raised river shoulders rejoin lower ground without a parallel step or wrinkle', () => {
  const w = structuredClone(expanded);
  w.northernIsland!.ponds = [];
  w.northernIsland!.rivers = [
    {
      id: 'shoulder',
      name: 'Shoulder',
      points: [
        { x: 0, z: -10000, level: 100, width: 24, depth: 3 },
        { x: 500, z: -10000, level: 100, width: 24, depth: 3 },
      ],
    },
  ];
  // Original land is below the channel here. The former 20 m fill cutoff
  // produced a nearly ten-metre discontinuity on this downhill bank.
  let previous = inlandGround(w, 250, -10000 + 12, 90);
  for (let d = 12.05; d < 335; d += 0.05) {
    const height = inlandGround(w, 250, -10000 + d, 90);
    assert.ok(Math.abs(height - previous) < 0.05, 'continuous bank-to-valley blend');
    previous = height;
  }
  assert.equal(inlandGround(w, 250, -9600, 90), 90);
});
test('smooth rendered river samples stay over the carved bed between survey points', () => {
  const w = expanded;
  for (const r of w.northernIsland!.rivers) {
    const samples = riverSurfacePoints(r.points);
    for (let i = 5; i < samples.length - 5; i += 31) {
      const p = samples[i];
      assert.ok(terrainHeight(w, p.x, p.z) < p.level - 0.05, r.name + ' has no buried surface');
      assert.ok(inlandWaterAt(w, p.x, p.z), 'rendered centre is wet in physics');
    }
  }
});

test('old headlands whose shoulders reach the preserved south retain their terrain', () => {
  const w = setup();
  w.coastalBluffs = [
    {
      id: 'boundary-bluff',
      x: 1500,
      z: -1350,
      angle: Math.PI,
      width: 180,
      inland: 350,
      height: 110,
      seed: 41,
    },
  ];
  const points = Array.from({ length: 12 }, (_, i) => ({ x: 1450 + i * 9, z: -1190 + i * 8 }));
  const before = points.map((p) => terrainHeight(w, p.x, p.z));
  expandPuddlewickIsland(w);
  assert.ok(w.coastalBluffs.some((b) => b.id === 'boundary-bluff'));
  assert.deepEqual(
    points.map((p) => terrainHeight(w, p.x, p.z)),
    before,
  );
});
