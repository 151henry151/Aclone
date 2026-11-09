// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { constructionRules } from '../src/shared/construction-rules';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { earthworkSiteReason } from '../src/shared/earthworks-site';
import type { Earthwork } from '../src/shared/earthworks-ground';
import { terrainHeight } from '../src/shared/terrain';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { inlandWaterAt } from '../src/shared/inland-water';
function setup() {
  const w = createWorld('earthworks-site', 'Pads', 'owner');
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
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(10),
  };
  const p: Earthwork = {
    id: 'pad-1',
    owner: 'owner',
    created: 0,
    x: 80,
    z: 80,
    width: 16,
    depth: 16,
    rotation: 0,
    target: 10,
    shoulder: 12,
    shoulderGrade: 50,
    progress: 0,
    finish: 'bare',
  };
  return { w, p };
}

test('pad geometry and aggregate budgets obey world rules', () => {
  const { w, p } = setup();
  assert.equal(earthworkSiteReason(w, p), undefined);
  for (const patch of [
    { width: 61 },
    { depth: 61 },
    { shoulder: 31 },
    { target: 17 },
    { shoulderGrade: 51 },
    { width: NaN },
    { progress: 1.1 },
  ])
    assert.ok(earthworkSiteReason(w, { ...p, ...patch }), JSON.stringify(patch));
  Object.assign(w.settings, { earthworksMaximumSide: 10 });
  assert.match(earthworkSiteReason(w, p) ?? '', /size|side/i);
  Object.assign(w.settings, { earthworksMaximumSide: 60, earthworksMaximumCount: 1 });
  w.earthworks = [{ ...p, x: -80, progress: 1 }];
  assert.match(earthworkSiteReason(w, { ...p, id: 'pad-2' }) ?? '', /count|number|limit/i);
  w.earthworks = [];
  w.settings.earthworksMaximumArea = 100;
  assert.match(earthworkSiteReason(w, p) ?? '', /area/i);
});

test('pads and their shoulders protect occupied sites and roads', () => {
  const cases: [string, (w: ReturnType<typeof setup>['w']) => void][] = [
    ['building', (w) => w.buildings.push(makeBuilding('house', 'home', 98, 80))],
    ['road', (w) => (w.roads = [{ a: { x: 99, z: 50 }, b: { x: 99, z: 110 }, width: 2 }])],
    [
      'field',
      (w) => {
        const b = makeBuilding('farm', 'farm', 70, 71);
        w.buildings.push(b);
      },
    ],
    [
      'pasture',
      (w) => {
        const b = makeBuilding('barn', 'dairy', 30, 80);
        b.pasture = { x: 50, z: 0, parcels: 1 };
        w.buildings.push(b);
      },
    ],
    [
      'gathering',
      (w) =>
        (w.additionalResources = [
          {
            id: 'protected-resource',
            item: 'stone',
            name: 'Stone',
            x: 99,
            z: 80,
            capacity: 100,
            regrowth: 100,
          },
        ]),
    ],
    [
      'arrival',
      (w) => {
        w.settings.respawnX = 99;
        w.settings.respawnZ = 80;
        w.settings.spawnClearance = 2;
      },
    ],
    [
      'no-build',
      (w) => (w.zones = [{ id: 'protected', kind: 'noBuild', x: 99, z: 80, radius: 2 }]),
    ],
    [
      'airfield',
      (w) =>
        (w.airfield = {
          x: 99,
          z: 80,
          length: 40,
          width: 8,
          height: 10,
          hangar: 'h',
          apronX: 99,
          apronZ: 80,
        }),
    ],
    [
      'spaceport',
      (w) =>
        (w.spaceportSite = {
          x: 100,
          z: 80,
          height: 10,
          building: 's',
          fence: 100,
          exclusion: 500,
        }),
    ],
    [
      'bluff',
      (w) =>
        (w.coastalBluffs = [
          { id: 'c', x: 80, z: 80, angle: 0, width: 100, inland: 150, height: 30, seed: 1 },
        ]),
    ],
  ];
  for (const [name, change] of cases) {
    const { w, p } = setup();
    change(w);
    assert.ok(earthworkSiteReason(w, p), name);
  }
});

test('same-owner completed pads may be regraded; foreign and unfinished sites stay reserved', () => {
  const { w, p } = setup();
  for (const old of [
    { ...p, progress: 0.5 },
    { ...p, progress: 1, owner: 'other' },
  ]) {
    w.earthworks = [old];
    assert.match(earthworkSiteReason(w, { ...p, id: 'pad-2' }) ?? '', /pad|earthwork|reserved/i);
  }
  w.earthworks = [{ ...p, progress: 1 }];
  assert.equal(earthworkSiteReason(w, { ...p, id: 'pad-2' }), undefined);
});

test('shoulder survey refuses vertical banks instead of hiding an excessive grade', () => {
  const { w, p } = setup();
  assert.match(earthworkSiteReason(w, { ...p, target: 14, shoulder: 1 }) ?? '', /shoulder|grade/i);
  assert.equal(earthworkSiteReason(w, { ...p, target: 14, shoulder: 20 }), undefined);
});

test('portable pads remap ownership and age and preserve completed foundations', () => {
  for (const progress of [0.5, 1]) {
    const { w, p } = setup();
    w.time = 1000;
    p.created = 200;
    p.progress = progress;
    w.earthworks = [p];
    if (progress === 1) {
      const b = makeBuilding('built', 'home', 80, 80);
      b.foundationY = 10.04;
      w.buildings.push(b);
    }
    const target = createWorld('imported', 'Imported', 'new-owner');
    target.time = 5000;
    applyDesign(target, exportDesign(w));
    assert.equal(target.earthworks?.length, 1);
    assert.equal(target.earthworks![0].owner, 'new-owner');
    assert.equal(target.earthworks![0].created, 4200);
    assert.equal(target.earthworks![0].progress, progress);
    assert.equal(terrainHeight(target, 80, 80), 10);
    if (progress === 1) assert.equal(target.buildings[0].foundationY, 10.04);
  }
});

test('invalid portable pads are refused atomically, including duplicates and forbidden wet sites', () => {
  const { w, p } = setup();
  w.earthworks = [p];
  for (const change of [
    (d: any) => (d.earthworks[0].width = 1000),
    (d: any) => (d.earthworks[0].target = -100),
    (d: any) => d.earthworks.push({ ...d.earthworks[0] }),
    (d: any) => (d.earthworks[0].progress = 2),
    (d: any) => (d.settings.seaLevel = 11),
  ]) {
    const d: any = exportDesign(w);
    assert.ok(d.earthworks?.length);
    change(d);
    const target = createWorld('imported', 'Imported', 'new-owner'),
      before = structuredClone(target);
    assert.throws(
      () => applyDesign(target, d),
      /pad|earthwork|size|number|value|duplicate|maximum|Too big|Invalid|water/i,
    );
    assert.deepEqual(target, before);
  }
});

test('pad limits are validated, editable and portable world-builder rules', async () => {
  const { w } = setup();
  const owner = addPlayer(w, 'owner', 'Owner');
  const rules = constructionRules();
  assert.equal(rules.earthworksMaximumSide, 60);
  assert.equal(rules.earthworksMaximumShoulder, 30);
  assert.equal(rules.earthworksMaximumDepth, 6);
  assert.equal(rules.earthworksMaximumCount, 256);
  assert.equal(rules.earthworksMaximumArea, 500000);
  const patch = {
    earthworksMaximumSide: 48,
    earthworksMaximumShoulder: 24,
    earthworksMaximumGrade: 40,
    earthworksMaximumDepth: 4,
    earthworksMaximumCount: 100,
    earthworksMaximumArea: 100000,
  };
  act(w, owner.id, { type: 'settings', patch });
  const { settingsFields } = await import('../src/client/creator-editor');
  const target = createWorld('imported', 'Imported', 'new-owner');
  applyDesign(target, exportDesign(w));
  for (const [key, value] of Object.entries(patch)) {
    assert.equal((target.settings as any)[key], value);
    assert.ok(settingsFields().includes(`name="${key}"`));
  }
  assert.throws(() =>
    act(w, owner.id, { type: 'settings', patch: { earthworksMaximumCount: 1.5 } }),
  );
});

test('river beds, banks and ford heights remain untouched by refused works', () => {
  const w = createWorld('puddlewick', 'P', 'owner');
  expandPuddlewickIsland(w);
  const r = w.northernIsland!.rivers[0],
    at = r.points[Math.floor(r.points.length / 2)];
  const p = { ...setup().p, x: at.x, z: at.z, target: at.level + 2 };
  const before = Array.from({ length: 41 }, (_, i) => terrainHeight(w, at.x + i - 20, at.z));
  const water = inlandWaterAt(w, at.x, at.z);
  assert.ok(earthworkSiteReason(w, p));
  assert.deepEqual(
    Array.from({ length: 41 }, (_, i) => terrainHeight(w, at.x + i - 20, at.z)),
    before,
  );
  assert.deepEqual(inlandWaterAt(w, at.x, at.z), water);
});

test('unfinished pads reserve building sites, farm expansions and pasture parcels', async () => {
  const { constructionSiteReason } = await import('../src/shared/construction-site');
  const { farmExpansionBlocker } = await import('../src/shared/farm-land');
  const { pastureBlocker } = await import('../src/shared/pastures');
  const { w, p } = setup();
  w.earthworks = [{ ...p, progress: 0.5 }];
  const home = makeBuilding('home', 'home', 80, 80);
  assert.match(constructionSiteReason(w, home) ?? '', /earthwork|pad/i);
  const farm = makeBuilding('farm', 'farm', 30, 71);
  assert.match(farmExpansionBlocker(w, farm) ?? '', /earthwork|pad/i);
  const barn = makeBuilding('barn', 'dairy', 30, 80);
  assert.match(pastureBlocker(w, barn, { x: 50, z: 0, parcels: 1 }) ?? '', /earthwork|pad/i);
  w.earthworks = [{ ...p, progress: 1 }];
  assert.equal(constructionSiteReason(w, home), undefined);
});

test('cutting dry land below high water is refused before it can create a new inlet', () => {
  const { w, p } = setup();
  w.settings.seaLevel = 8;
  assert.match(earthworkSiteReason(w, { ...p, target: 7 }) ?? '', /water|flood/i);
  assert.equal(terrainHeight(w, p.x, p.z), 10);
});

test('accepted nearby works preserve river beds, bank samples and shallow ford crossings', async () => {
  const { riverBanks } = await import('../src/shared/inland-water');
  const { inlandBlocksGround } = await import('../src/shared/inland-travel');
  const w = createWorld('puddlewick', 'P', 'owner');
  expandPuddlewickIsland(w);
  const r = w.northernIsland!.rivers[0],
    ford = r.points[12],
    bank = riverBanks(r.points)[12];
  const dx = (bank.right.x - bank.left.x) / ford.width,
    dz = (bank.right.z - bank.left.z) / ford.width;
  const a = { x: ford.x - dx * (ford.width / 2 + 5), z: ford.z - dz * (ford.width / 2 + 5) };
  const b = { x: ford.x + dx * (ford.width / 2 + 5), z: ford.z + dz * (ford.width / 2 + 5) };
  const points = w.northernIsland!.rivers.flatMap((r) =>
    r.points.flatMap((p, i) => {
      const banks = riverBanks(r.points)[i];
      return [p, banks.left, banks.right];
    }),
  );
  const heights = points.map((p) => terrainHeight(w, p.x, p.z));
  assert.equal(inlandBlocksGround(w, a, b), false);
  let work: Earthwork | undefined;
  for (const d of [500, 700, 900])
    for (const [sx, sz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = ford.x + d * sx,
        z = ford.z + d * sz;
      const candidate = {
        ...setup().p,
        x,
        z,
        width: 4,
        depth: 4,
        shoulder: 20,
        target: terrainHeight(w, x, z) + 0.25,
      };
      if (!earthworkSiteReason(w, candidate)) {
        work = candidate;
        break;
      }
    }
  assert.ok(work, 'find a safe dry site outside the protected river bank');
  for (const progress of [0.5, 1]) {
    w.earthworks = [{ ...work, progress }];
    assert.deepEqual(
      points.map((p) => terrainHeight(w, p.x, p.z)),
      heights,
    );
    assert.equal(inlandBlocksGround(w, a, b), false);
  }
});
