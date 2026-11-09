// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { constructionSiteReason, foundationProfile } from '../src/shared/construction-site';
import { constructionRules } from '../src/shared/construction-rules';
import { creatorSchema } from '../src/shared/creator';
import { farmExpansionBlocker } from '../src/shared/farm-land';
import { pastureBlocker } from '../src/shared/pastures';
import { Store } from '../src/server/store';

function setup(grade: number, rotation = 0) {
  const w = createWorld('slope', 'Slope', 'owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.roads = [];
  w.resources = {};
  w.terrain = [];
  w.airfield = undefined;
  w.spaceportSite = undefined;
  w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -40,
    solidScenery: 'off',
    spawnClearance: 0,
    townCentreClearance: 0,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) =>
      Math.max(
        -39,
        Math.min(
          39,
          10 +
            grade *
              ((((i % 33) / 32) * 1000 - 580) * Math.cos(rotation) -
                ((Math.floor(i / 33) / 32) * 1000 - 580) * Math.sin(rotation)),
        ),
      ),
    ),
  };
  const p = addPlayer(w, 'builder', 'Builder');
  Object.assign(p, { x: 80, z: 80, cash: 1000000 });
  return { w, p };
}

test('size-aware grade refuses small steep sites that fit under the old two-metre ceiling', () => {
  const { w } = setup(0.25);
  const b = makeBuilding('site', 'home', 80, 80);
  b.creatorBounds = { width: 4, depth: 4, height: 3 };
  assert.ok(foundationProfile(w, b).rise < 2);
  assert.match(constructionSiteReason(w, b) ?? '', /Ground rises 1\.0 m \(25%\).*0\.8 m/);
});

test('both rotated footprint axes honour grades, allowance and absolute rise ceiling', () => {
  for (const rotation of [0, Math.PI / 4, Math.PI / 2])
    for (const span of [4, 12, 30])
      for (const grade of [0.05, 0.12, 0.25])
        for (const axis of [0, Math.PI / 2]) {
          const { w } = setup(grade, rotation + axis);
          const b = makeBuilding('site', 'home', 80, 80);
          b.rotation = rotation;
          b.creatorBounds = { width: span, depth: span, height: 3 };
          const reason = constructionSiteReason(w, b);
          const pass = grade <= 0.12 && grade * span <= 2;
          assert.equal(!reason, pass, JSON.stringify({ rotation, span, grade, axis, reason }));
        }
});

test('server refuses steep foundations without payment; owner bypass is explicit and slope-only', () => {
  const { w, p } = setup(0.25);
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /Ground rises.*%/);
  assert.equal(JSON.stringify(w), before);
  const owner = addPlayer(w, 'owner', 'Owner');
  Object.assign(owner, { x: 80, z: 80, cash: 1000000 });
  act(w, owner.id, { type: 'settings', patch: { constructionOwnerSlopeBypass: false } });
  assert.throws(() => act(w, owner.id, { type: 'construct', kind: 'home' }), /Ground rises/);
  act(w, owner.id, { type: 'settings', patch: { constructionOwnerSlopeBypass: true } });
  w.zones = [{ id: 'protected', kind: 'noBuild', x: 80, z: 80, radius: 20 }];
  assert.throws(() => act(w, owner.id, { type: 'construct', kind: 'home' }), /prohibited/);
  w.zones = [];
  act(w, owner.id, { type: 'construct', kind: 'home' });
  assert.equal(w.buildings.length, 1);
});

test('new farm fields and pasture parcels use their own configurable grade limits', () => {
  const { w } = setup(0.25);
  const farm = makeBuilding('farm', 'farm', 80, 80),
    barn = makeBuilding('barn', 'dairy', 80, 80);
  const field = farmExpansionBlocker(w, farm);
  assert.match(field ?? '', /fields.*Ground rises.*%/i);
  assert.match(
    pastureBlocker(w, barn, { x: 40, z: 0, parcels: 1 }) ?? '',
    /pasture.*Ground rises.*%/i,
  );
  Object.assign(w.settings, {
    farmMaximumGrade: 30,
    farmMaximumRise: 4,
    pastureMaximumGrade: 30,
    pastureMaximumRise: 5,
  });
  assert.equal(farmExpansionBlocker(w, farm), undefined);
  assert.equal(pastureBlocker(w, barn, { x: 40, z: 0, parcels: 1 }), undefined);
});

test('new slope rules validate and survive design/database round trips without moving old foundations', async () => {
  const { w } = setup(0.25),
    owner = addPlayer(w, 'owner', 'Owner');
  const patch = {
    constructionMaximumGrade: 9,
    constructionSlopeAllowance: 0.2,
    constructionOwnerSlopeBypass: false,
    farmMaximumGrade: 15,
    farmMaximumRise: 2.5,
    pastureMaximumGrade: 18,
    pastureMaximumRise: 4.5,
  };
  for (const bad of [
    { constructionMaximumGrade: -1 },
    { farmMaximumGrade: Infinity },
    { pastureMaximumRise: 21 },
    { constructionOwnerSlopeBypass: 1 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, owner.id, { type: 'settings', patch: bad }));
    assert.equal(JSON.stringify(w), before);
  }
  act(w, owner.id, { type: 'settings', patch });
  const b = makeBuilding('old', 'home', 80, 80);
  b.foundationY = 2.345;
  w.buildings.push(b);
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { settingsFields } = await import('../src/client/creator-editor');
  const dest = createWorld('other', 'Other', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    for (const [key, value] of Object.entries(patch)) {
      assert.equal((dest.settings as any)[key], value);
      assert.equal((restored.settings as any)[key], value);
      assert.ok(settingsFields().includes(`name="${key}"`));
    }
    assert.equal(restored.buildings[0].foundationY, 2.345);
    assert.equal(dest.buildings[0].foundationY, 2.345);
  } finally {
    store.close();
  }
  const rules = constructionRules() as any;
  assert.equal(rules.constructionMaximumGrade, 12);
  assert.equal(rules.constructionSlopeAllowance, 0.35);
  assert.equal(rules.constructionOwnerSlopeBypass, true);
});

test('interior humps are sampled and initial farm fields are checked separately', () => {
  const { w } = setup(0);
  const b = makeBuilding('bump', 'home', 80, 80);
  b.creatorBounds = { width: 12, depth: 12, height: 3 };
  w.terrain = [{ x: 80, z: 80, radius: 3, height: 1.8 }];
  assert.match(constructionSiteReason(w, b) ?? '', /Ground rises/);
  const { w: fieldWorld } = setup(0.05);
  Object.assign(fieldWorld.settings, {
    constructionMaximumGrade: 100,
    constructionMaximumRise: 20,
    farmMaximumGrade: 0,
  });
  assert.match(
    constructionSiteReason(fieldWorld, makeBuilding('farm', 'farm', 80, 80)) ?? '',
    /New fields/,
  );
});

test('rule edits and design import preserve previously purchased pasture on a steep site', async () => {
  const { w } = setup(0.25);
  const b = makeBuilding('old-barn', 'dairy', 80, 80);
  b.pasture = { x: 40, z: 0, parcels: 1, parcelSize: 16 };
  b.foundationY = 4.2;
  w.buildings = [b];
  Object.assign(w.settings, { pastureMaximumGrade: 0, pastureMaximumRise: 0 });
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const dest = createWorld('pasture-copy', 'Pasture copy', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.deepEqual(dest.buildings[0].pasture, b.pasture);
  assert.equal(dest.buildings[0].foundationY, 4.2);
  assert.match(pastureBlocker(w, b, { ...b.pasture, parcels: 2 }, 1) ?? '', /New pasture/);
});

test('owner layout relocation and editor placement obey disabled bypass without revalidating a rename', () => {
  const { w } = setup(0.25),
    owner = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('old', 'home', 80, 80);
  b.foundationY = 2.5;
  w.buildings = [b];
  w.settings.constructionOwnerSlopeBypass = false;
  act(w, owner.id, {
    type: 'creatorBuilding',
    building: b.id,
    patch: { name: 'Existing cottage', x: b.x, z: b.z, rotation: 0, model: '' },
  });
  assert.equal(b.foundationY, 2.5);
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, owner.id, { type: 'creatorBuilding', building: b.id, patch: { x: 120 } }),
    /Ground rises/,
  );
  assert.equal(JSON.stringify(w), before);
  assert.throws(
    () => act(w, owner.id, { type: 'place', kind: 'home', x: 150, z: 80 }),
    /Ground rises/,
  );
  w.settings.constructionOwnerSlopeBypass = true;
  act(w, owner.id, { type: 'creatorBuilding', building: b.id, patch: { x: 120 } });
  assert.equal(b.x, 120);
  assert.equal(b.foundationY, foundationProfile(w, b).level);
});

test('changed and absent grade/allowance/ceiling settings control the same footprint', () => {
  const { w } = setup(0.25);
  const b = makeBuilding('site', 'home', 80, 80);
  b.creatorBounds = { width: 4, depth: 4, height: 3 };
  delete w.settings.constructionMaximumGrade;
  delete w.settings.constructionSlopeAllowance;
  assert.match(constructionSiteReason(w, b) ?? '', /Ground rises/);
  w.settings.constructionMaximumGrade = 30;
  assert.equal(constructionSiteReason(w, b), undefined);
  w.settings.constructionMaximumGrade = 0;
  w.settings.constructionSlopeAllowance = 1;
  assert.equal(constructionSiteReason(w, b), undefined);
  w.settings.constructionSlopeAllowance = 0.9;
  assert.match(constructionSiteReason(w, b) ?? '', /within 0.9 m/);
  w.settings.constructionSlopeAllowance = 1;
  w.settings.constructionMaximumRise = 0.8;
  assert.match(constructionSiteReason(w, b) ?? '', /within 0.8 m/);
});
