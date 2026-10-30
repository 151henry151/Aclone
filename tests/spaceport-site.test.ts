import { roadSurfaceDistance } from '../src/shared/town';
import { Navigator } from '../src/server/npc/navigation';
import { addPlayer } from '../src/shared/simulation';
import { spaceportApron, buildingPlan } from '../src/shared/building-shapes';
import { worldResources } from '../src/shared/resources';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { ensurePuddlewickSpaceport } from '../src/server/puddlewick-spaceport';
import {
  spaceportFences,
  spaceportReserved,
  spaceportPoint,
  spaceportPaving,
  spaceportApproach,
  spaceportYardDistance,
  SPACEPORT_PARKING,
  spaceportStructures,
  spaceportYardProps,
  spaceportGateRequested,
  SPACEPORT_FENCE_HEIGHT,
} from '../src/shared/spaceport-site';
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
  assert.equal(s.layout, 4);
  const gate = spaceportPoint(s, 0, s.fence);
  assert.ok(Math.hypot(port.x - gate.x, port.z - gate.z) < 80);
  assert.ok(Math.abs(port.foundationY! - terrainHeight(w, port.x, port.z) - 0.04) < 0.001);
  assert.ok(Math.abs(port.x + port.launchOffset!.x + spaceportApron.x - s.x) < 0.001);
  assert.ok(Math.abs(port.z + port.launchOffset!.z + spaceportApron.z - s.z) < 0.001);
  assert.ok(Math.abs(port.foundationY! + port.launchOffset!.y - s.height - 0.04) < 0.001);
  const apron = buildingPlan(port).apron!;
  assert.ok(Math.abs(port.x + apron.x - s.x) < 0.001);
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
  assert.deepEqual(
    copy.buildings.find((b) => b.id === w.spaceportSite!.building)!.launchOffset,
    w.buildings.find((b) => b.id === w.spaceportSite!.building)!.launchOffset,
  );
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

test('industrial sites have level ground, a rocket-sized hall and blocked walls', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!;
  const hall = spaceportStructures(s).find((b) => b.id === 'integration')!;
  assert.ok(hall.depth > 192.6 && hall.width > 52 && hall.height > 52);
  for (const b of spaceportStructures(s)) {
    const heights = [];
    for (const dx of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        const p = spaceportPoint(s, b.x + (dx * b.width) / 2, b.z + (dz * b.depth) / 2);
        heights.push(terrainHeight(w, p.x, p.z));
      }
    assert.ok(Math.max(...heights) - Math.min(...heights) < 0.35, b.id + ' level foundation');
    const from = spaceportPoint(s, b.x, b.z + b.depth / 2 + 3),
      to = spaceportPoint(s, b.x, b.z + b.depth / 2 - 3);
    assert.ok(
      landscapeBlocks(
        w,
        { ...from, y: terrainHeight(w, from.x, from.z) },
        { ...to, y: terrainHeight(w, to.x, to.z) },
        0.6,
        false,
      ),
      b.id + ' solid wall',
    );
  }
  for (const pad of spaceportPaving(s)) {
    const p = spaceportPoint(s, pad.x, pad.z);
    assert.ok(
      roadSurfaceDistance(w, [], p.x, p.z) <= 0,
      'Paved work yards have cleared-ground traction and snow masking',
    );
  }
  assert.equal(spaceportFences(w)[0].height, SPACEPORT_FENCE_HEIGHT);
  for (const d of [-45, 45])
    assert.equal(spaceportGateRequested(s, [spaceportPoint(s, 0, s.fence + d)]), true);
  assert.equal(spaceportGateRequested(s, [spaceportPoint(s, 0, s.fence + 90)]), false);
});

test('layout-two upgrade preserves launch site and all existing shop business fields', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!,
    port = w.buildings.find((b) => b.id === s.building)!;
  s.layout = 2;
  w.owner = 'operator';
  delete w.publicParishVersion;
  delete s.entryHeight;
  delete port.launchOffset;
  port.x = s.x - spaceportApron.x;
  port.z = s.z - spaceportApron.z;
  port.foundationY = s.height + 0.04;
  const before = structuredClone(port),
    point = { x: s.x, z: s.z, height: s.height };
  assert.equal(ensurePuddlewickSpaceport(w), true);
  const { x, z, rotation, foundationY, launchOffset, ...business } = port;
  const {
    x: oldX,
    z: oldZ,
    rotation: oldR,
    foundationY: oldY,
    launchOffset: oldOffset,
    ...original
  } = before;
  assert.deepEqual(business, original);
  assert.deepEqual(
    { x: w.spaceportSite!.x, z: w.spaceportSite!.z, height: w.spaceportSite!.height },
    point,
  );
  assert.equal(ensurePuddlewickSpaceport(w), false);
});

test('concrete connects each facility and visitor parking to the gate and launch apron', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!;
  const paved = (x: number, z: number) => {
    const p = spaceportPoint(s, x, z);
    assert.ok(roadSurfaceDistance(w, [], p.x, p.z) <= 0, `Cleared concrete at ${x}, ${z}`);
  };
  // Walk the central spine and cross each apron to the public side of every doorway.
  for (let z = 45; z <= s.fence; z += 2) paved(0, z);
  for (const b of spaceportStructures(s)) {
    const z = b.z + b.depth / 2 + 1;
    for (let i = 0; i <= 100; i++) paved((b.x * i) / 100, z);
  }
  for (const [x, z] of [
    [-185, 335],
    [-65, 345],
    [185, 325],
    [30, s.fence - 35],
    [SPACEPORT_PARKING.x, s.fence - SPACEPORT_PARKING.fromGate],
  ])
    for (let i = 0; i <= 100; i++) paved((x * i) / 100, z);
  // Surrounding countryside remains unpaved, not silently given road traction.
  assert.ok(spaceportYardDistance(s, -230, 350) > 20);
});

test('entrance flare joins the saved approach road at road width with a gradual taper', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!,
    points = spaceportApproach(s);
  assert.equal(points[0].width, 11);
  assert.equal(points.at(-1)!.width, 3);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      p = points[i];
    assert.ok(p.width <= a.width && a.width - p.width < 0.4);
    assert.ok(spaceportYardDistance(s, p.x, p.z) <= 0);
  }
  const end = spaceportPoint(s, points.at(-1)!.x, points.at(-1)!.z);
  let nearest = Infinity;
  for (let i = 1; i < s.access!.length; i++) {
    const a = s.access![i - 1],
      b = s.access![i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((end.x - a.x) * dx + (end.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
    );
    nearest = Math.min(nearest, Math.hypot(end.x - a.x - dx * t, end.z - a.z - dz * t));
  }
  assert.ok(
    nearest < 0.01,
    'Outer end follows the actual access road, not an assumed straight approach',
  );
});

test('yard freight has collision boundaries and leaves entrances and circulation clear', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!,
    props = spaceportYardProps(s);
  for (const b of props) {
    const from = spaceportPoint(s, b.x + b.width / 2 + 2, b.z),
      to = spaceportPoint(s, b.x + b.width / 2 - 0.5, b.z);
    assert.ok(
      landscapeBlocks(
        w,
        { ...from, y: terrainHeight(w, from.x, from.z) },
        { ...to, y: terrainHeight(w, to.x, to.z) },
        0.6,
        false,
      ),
      b.id + ' is solid',
    );
    assert.ok(Math.abs(b.x) - b.width / 2 > 15, b.id + ' keeps central service lane clear');
    for (const building of spaceportStructures(s)) {
      const gapX = Math.abs(b.x - building.x) - (b.width + building.width) / 2;
      const gapZ = Math.abs(b.z - building.z) - (b.depth + building.depth) / 2;
      assert.ok(gapX > 3 || gapZ > 7, b.id + ' keeps loading doors and building access clear');
    }
    const parking = SPACEPORT_PARKING;
    assert.ok(
      Math.abs(b.x - parking.x) > (b.width + parking.width) / 2 + 4 ||
        Math.abs(b.z - (s.fence - parking.fromGate)) > (b.depth + parking.depth) / 2 + 4,
    );
  }
  for (let i = 0; i < props.length; i++)
    for (let j = i + 1; j < props.length; j++) {
      const a = props[i],
        b = props[j];
      assert.ok(
        Math.abs(a.x - b.x) > (a.width + b.width) / 2 + 1 ||
          Math.abs(a.z - b.z) > (a.depth + b.depth) / 2 + 1,
        'Separate freight stacks leave gaps',
      );
    }
});

test('layout-three terminal is moved clear of the taller fence without changing the launch or business', () => {
  const w = world();
  ensurePuddlewickSpaceport(w);
  const s = w.spaceportSite!,
    port = w.buildings.find((b) => b.id === s.building)!;
  const old = spaceportPoint(s, 30, s.fence - 35);
  s.layout = 3;
  Object.assign(port, old);
  port.owner = 'private-owner';
  port.stock.fuel = 71;
  port.investment = 12345;
  const before = structuredClone(port);
  assert.equal(ensurePuddlewickSpaceport(w), true);
  assert.equal(w.spaceportSite!.layout, 4);
  assert.equal(SPACEPORT_FENCE_HEIGHT, 8.4);
  assert.equal(w.spaceportSite!.entryHeight, s.entryHeight);
  assert.ok(Math.abs(Math.hypot(port.x - old.x, port.z - old.z) - 15) < 1e-8);
  // Include every wing, not just the shop's origin or main volume.
  for (const v of buildingPlan(port).volumes)
    for (const dx of [-v.width / 2, v.width / 2])
      for (const dz of [-v.depth / 2, v.depth / 2]) {
        const radius = Math.hypot(port.x + v.x + dx - s.x, port.z + v.z + dz - s.z);
        assert.ok(radius < s.fence - 12, 'all terminal corners have fence clearance');
      }
  const { x, z, foundationY, launchOffset, ...afterBusiness } = port;
  const { x: ox, z: oz, foundationY: oy, launchOffset: oo, ...beforeBusiness } = before;
  assert.deepEqual(afterBusiness, beforeBusiness);
  assert.ok(Math.abs(port.x + port.launchOffset!.x + spaceportApron.x - s.x) < 1e-8);
  assert.ok(Math.abs(port.z + port.launchOffset!.z + spaceportApron.z - s.z) < 1e-8);
  assert.ok(Math.abs(port.foundationY! + port.launchOffset!.y - s.height - 0.04) < 1e-8);
  const saved = JSON.stringify(w);
  assert.equal(ensurePuddlewickSpaceport(w), false);
  assert.equal(JSON.stringify(w), saved);
});
