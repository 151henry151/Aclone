// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { quaySite } from '../src/shared/quay';
import { boatLandings } from '../src/shared/boathouse';
import { constructionSiteReason } from '../src/shared/construction-site';
import { buildings } from '../src/shared/catalog';
export function quaySetup() {
  const w = createWorld('freight-quay', 'Freight quay', 'owner');
  w.buildings = [];
  w.roads = [];
  w.zones = [];
  w.towns = [];
  w.settings.seaLevel = 0;
  w.settings.tidalRange = 0;
  w.settings.mapSize = 1000;
  // Authored dry shore, gentle bank and deep sea. All geometry uses this same surface.
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) =>
      Math.floor(i / 33) < 16 ? 2 : Math.floor(i / 33) === 16 ? 1 : -5,
    ),
  };
  const b = makeBuilding('quay', 'quay', -100, 0);
  b.rotation = Math.PI;
  w.buildings.push(b);
  return { w, b };
}
test('open freight quay provides dry access, deep full-hull clearance and public mooring', () => {
  assert.equal(buildings.quay?.price, 240000);
  assert.equal(buildings.quay.capacity, 4000);
  const { w, b } = quaySetup();
  const site = quaySite(w, b);
  assert.ok(site);
  assert.equal(constructionSiteReason({ ...w, buildings: [] }, b), undefined);
  const d = boatLandings(w).find((d) => d.id === b.id)!;
  assert.ok(d);
  assert.equal(d.building, undefined);
  assert.equal(quaySite(w, { ...b, rotation: 0 }), undefined);
  assert.equal(quaySite(w, { ...b, z: -100 }), undefined);
  w.settings.quayDraft = 10;
  assert.equal(quaySite(w, b), undefined);
  w.settings.quayDraft = 2;
  const p = addPlayer(w, 'owner', 'Captain');
  Object.assign(p, d.berth, {
    vehicle: 35,
    fleet: [0, 5, 35],
    heading: d.heading,
    engine: false,
    boatHold: { stone: 100 },
    inventory: {},
  });
  act(w, p.id, { type: 'vehicle', slot: 5, building: b.id });
  assert.equal(w.mooredBoats![p.id + ':35'].cargo!.stone, 100);
  act(w, p.id, { type: 'boatHold', slot: 35, operation: 'unload', item: 'stone', quantity: 10 });
  advance(w, 2);
  assert.equal(p.inventory.stone, 10);
});
test('freight quay has a distinct map symbol', async () => {
  const { buildingMapIcons } = await import('../src/client/map-icons');
  assert.ok(buildingMapIcons.quay);
});
test('quay refuses an authored hull larger than its physical berth', () => {
  const { w, b } = quaySetup(),
    d = boatLandings(w).find((d) => d.id === b.id)!;
  w.settings.requireCaptainSkill = false;
  w.settings.vehicleLicences = false;
  const p = addPlayer(w, 'owner', 'Captain');
  Object.assign(p, d.land, { vehicle: 5, fleet: [0, 5, 35], y: 1.5, inventory: {} });
  w.vehicleTuning = { 35: { length: 29 } };
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 35, building: b.id }),
    /fit|berth|length/i,
  );
});
test('walking support follows a newly built quay and invalidates after layout edits', async () => {
  const { travelHeight } = await import('../src/shared/dock');
  const { quayDeckHeight, quayPoint } = await import('../src/shared/quay');
  const { w, b } = quaySetup(),
    point = quayPoint(b, 0, -16);
  w.buildings = [];
  const water = travelHeight(w, point.x, point.z);
  w.buildings.push(b);
  assert.equal(travelHeight(w, point.x, point.z), quayDeckHeight(w, b));
  assert.ok(travelHeight(w, point.x, point.z) > water);
  b.x += 100;
  w.revision++;
  assert.equal(travelHeight(w, point.x, point.z), water);
  w.buildings = [];
  assert.equal(travelHeight(w, point.x, point.z), water);
});
test('quay preview frames the full wharf instead of a tiny generic building', async () => {
  const { buildingPreviewRadius } = await import('../src/client/build-preview-scale');
  assert.ok(buildingPreviewRadius('quay') > 15);
});
