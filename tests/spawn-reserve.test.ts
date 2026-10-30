// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, makeBuilding } from '../src/shared/simulation';
import { farmExpansionBlocker } from '../src/shared/farm-land';
import { pastureBlocker } from '../src/shared/pastures';
import { constructionSiteReason } from '../src/shared/construction-site';
import { buildingSpawnReason, PARISH_SPAWN } from '../src/shared/spawn-reserve';
function setup() {
  const w = createWorld('spawn-test', 'Spawn test', 'owner');
  w.buildings = [];
  w.zones = [];
  const p = addPlayer(w, 'owner', 'Owner');
  p.cash = 1e8;
  w.tier = 10;
  return { w, p };
}
test('respawn construction rejects before charging or placing a building', () => {
  const { w, p } = setup();
  assert.equal(p.x, PARISH_SPAWN.x);
  assert.equal(p.z, PARISH_SPAWN.z);
  const cash = p.cash,
    revision = w.revision;
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'creamery' }), /respawn area/);
  assert.equal(p.cash, cash);
  assert.equal(w.revision, revision);
  assert.equal(w.buildings.length, 0);
  p.x = 65;
  act(w, p.id, { type: 'construct', kind: 'creamery' });
  assert.equal(w.buildings.length, 1);
});
test('whole rotated/custom building footprint, town centres and explicit spawn zones are reserved', () => {
  const { w } = setup();
  const b = makeBuilding('check', 'home', 27, 17);
  b.creatorBounds = { width: 4, depth: 40, height: 4 };
  b.rotation = Math.PI / 2;
  assert.match(constructionSiteReason(w, b)!, /respawn area/);
  b.rotation = 0;
  assert.equal(buildingSpawnReason(w, b), undefined);
  assert.match(buildingSpawnReason(w, { ...b, x: 0, z: 0 })!, /town centre/);
  w.zones.push({ id: 'other-spawn', kind: 'spawn', x: 100, z: 90, radius: 10 });
  assert.match(buildingSpawnReason(w, { ...b, x: 100, z: 90 })!, /respawn area/);
});
test('editor placement and moves cannot bypass the reserve and rejection is atomic', () => {
  const { w, p } = setup();
  const revision = w.revision;
  assert.throws(
    () => act(w, p.id, { type: 'place', kind: 'creamery', x: 0, z: 17 }),
    /respawn area/,
  );
  assert.equal(w.revision, revision);
  assert.equal(w.buildings.length, 0);
  act(w, p.id, { type: 'place', kind: 'creamery', x: 65, z: 17 });
  const b = w.buildings[0],
    before = structuredClone(b),
    placedRevision = w.revision;
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'creatorBuilding',
        building: b.id,
        patch: { name: 'Changed', x: 0, z: 17 },
      }),
    /respawn area/,
  );
  assert.deepEqual(b, before);
  assert.equal(w.revision, placedRevision);
  act(w, p.id, { type: 'creatorBuilding', building: b.id, patch: { name: 'Dairy' } });
  assert.equal(b.name, 'Dairy');
});

test('farm and pasture expansions cannot fence in the respawn area', () => {
  const { w } = setup();
  const farm = makeBuilding('farm', 'farm', -26, 8);
  farm.rotation = 0;
  assert.match(farmExpansionBlocker(w, farm)!, /respawn area/);
  const barn = makeBuilding('barn', 'dairy', -65, 17);
  barn.rotation = 0;
  assert.match(pastureBlocker(w, barn, { x: 65, z: 0, parcels: 1 }, 0, [])!, /respawn area/);
});
