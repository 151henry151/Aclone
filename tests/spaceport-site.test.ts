import { Navigator } from '../src/server/npc/navigation';
import { addPlayer } from '../src/shared/simulation';
import { worldResources } from '../src/shared/resources';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { ensurePuddlewickSpaceport } from '../src/server/puddlewick-spaceport';
import { spaceportFences, spaceportReserved } from '../src/shared/spaceport-site';
import { terrainHeight } from '../src/shared/terrain';
import { constructionSiteReason } from '../src/shared/construction-site';
import { landscapeBlocks } from '../src/shared/landscape';
import { farmExpansionBlocker } from '../src/shared/farm-land';
import { pastureBlocker } from '../src/shared/pastures';
import { exportDesign, applyDesign } from '../src/server/world-design';
function world() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server', 'economy');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  return w;
}
test('spaceport moves once to a vacant site just over one kilometre away without changing property or its economy', () => {
  const w = world(),
    port = w.buildings.find((b) => b.kind === 'starport')!;
  port.stock.fuel = 123;
  port.investment = 123456;
  const resources = structuredClone(worldResources(w));
  const original = structuredClone(w.buildings.filter((b) => b !== port));
  assert.equal(ensurePuddlewickSpaceport(w), true);
  const s = w.spaceportSite!;
  assert.ok(Math.hypot(s.x, s.z) > 1100 && Math.hypot(s.x, s.z) < 1300);
  assert.ok(original.every((b) => Math.hypot(b.x - s.x, b.z - s.z) > 650));
  assert.deepEqual(
    w.buildings.filter((b) => b !== port),
    original,
  );
  assert.deepEqual(worldResources(JSON.parse(JSON.stringify(w))), resources);
  assert.equal(port.stock.fuel, 123);
  assert.equal(port.investment, 123456);
  assert.ok(Math.abs(terrainHeight(w, port.x, port.z) - s.height) < 0.001);
  assert.ok(w.roads!.length > 0);
  const saved = JSON.stringify(w);
  assert.equal(ensurePuddlewickSpaceport(w), false);
  assert.equal(JSON.stringify(w), saved);
  assert.equal(ensurePuddlewickSpaceport(JSON.parse(saved)), false);
});
test('fence blocks crossing but its southeast access gate remains passable', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!;
  const edge = spaceportFences(w)[60];
  const mid = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 };
  const nx = (mid.x - s.x) / s.fence,
    nz = (mid.z - s.z) / s.fence;
  const a = { x: mid.x + nx * 4, z: mid.z + nz * 4, y: terrainHeight(w, mid.x, mid.z) };
  const b = { x: mid.x - nx * 4, z: mid.z - nz * 4, y: a.y };
  assert.ok(landscapeBlocks(w, a, b, 0.6, false));
  const gate = { x: s.x + s.fence / Math.sqrt(2), z: s.z + s.fence / Math.sqrt(2) };
  const y = terrainHeight(w, gate.x, gate.z);
  assert.equal(
    landscapeBlocks(
      w,
      { x: gate.x + 4, z: gate.z + 4, y },
      { x: gate.x - 4, z: gate.z - 4, y },
      0.6,
      false,
    ),
    false,
  );
});
test('buildings, fields and grazing cannot encroach even if a generic no-build zone is removed', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!;
  w.zones = [];
  assert.equal(s.exclusion, 1000);
  assert.equal(s.fence, 600);
  assert.equal(spaceportReserved(w, s.x + 990, s.z), true);
  assert.equal(spaceportReserved(w, s.x + 1020, s.z, 10), false);
  assert.match(
    constructionSiteReason(w, makeBuilding('bad', 'home', s.x + 100, s.z))!,
    /reservation/,
  );
  const farm = makeBuilding('farm', 'farm', s.x + 100, s.z);
  assert.match(farmExpansionBlocker(w, farm)!, /reservation/);
  const barn = makeBuilding('barn', 'dairy', s.x + 100, s.z);
  assert.match(pastureBlocker(w, barn, { x: 24, z: 0, parcels: 1 })!, /reservation/);
});
test('foreign and compact worlds are left alone', () => {
  const w = world();
  w.id = 'elsewhere';
  assert.equal(ensurePuddlewickSpaceport(w), false);
  w.id = 'puddlewick';
  w.terrainMapSize = 500;
  assert.equal(ensurePuddlewickSpaceport(w), false);
});

test('world design exports retain the graded site, fence and large reservation', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const copy = createWorld('copy', 'Copy', 'builder', 'economy');
  applyDesign(copy, exportDesign(w));
  assert.deepEqual(copy.spaceportSite, w.spaceportSite);
  assert.ok(copy.zones.some((z) => z.id === 'puddlewick-launch-reserve' && z.radius === 1000));
});

test('NPC can plan both directions along the long access road and through its gate', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const p = addPlayer(w, 'npc', 'Traveller');
  const port = w.buildings.find((b) => b.id === w.spaceportSite!.building)!;
  const outward = new Navigator(w, p, port, 16);
  assert.ok(outward.waypoints().length > 100);
  const start = { x: p.x, z: p.z };
  p.x = port.x;
  p.z = port.z + 16;
  const inward = new Navigator(w, p, start, 12);
  assert.ok(inward.waypoints().length > 100);
});
