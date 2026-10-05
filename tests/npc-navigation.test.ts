// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, distance, terrainHeight } from '../src/shared/simulation.ts';
import { Navigator } from '../src/server/npc/navigation.ts';
import { worldResources } from '../src/shared/resources.ts';
import { mapHalf } from '../src/shared/terrain.ts';

test('NPC drives through ordinary physics to dispersed public services without teleporting', () => {
  const w = createWorld('nav', 'Navigation', 'server'),
    p = addPlayer(w, 'npc', 'Mabel');
  p.online = true;
  for (const kind of ['workhouse', 'market', 'school', 'garage', 'home']) {
    const b = w.buildings.find((b) => b.kind === kind)!;
    const nav = new Navigator(w, p, b, 12);
    let arrived = false;
    for (let i = 0; i < 6000; i++) {
      const before = { x: p.x, z: p.z };
      const result = nav.step(w, p, 0.05);
      assert.equal(result.error, undefined, `${kind}: ${result.error}`);
      move(w, p, result.input, 0.05);
      w.time += 0.05;
      assert.ok(distance(before, p) < 0.8, 'no position jump');
      assert.ok(terrainHeight(w, p.x, p.z) >= w.settings.seaLevel);
      if (result.arrived) {
        arrived = true;
        break;
      }
    }
    assert.ok(arrived, `reach ${kind} from ${p.x},${p.z}`);
    assert.ok(distance(p, b) < 18);
  }
});
test('NPC refuses a submerged destination', () => {
  const w = createWorld('wet', 'Water', 'server'),
    p = addPlayer(w, 'npc', 'Mabel');
  assert.throws(() => new Navigator(w, p, { x: 10, z: 220 }, 3), /route/);
});

test('already in service range needs no new path or running engine, even beside a blocked grid cell', () => {
  const w = createWorld('nav-close', 'Navigation', 'server');
  const p = addPlayer(w, 'npc', 'Mabel');
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.x = mill.x - 6;
  p.z = mill.z;
  p.speed = 0;
  p.engine = false;
  // No traversable grid cells: stopping here is still a no-op, not a journey.
  w.settings.seaLevel = 1000;
  const before = { x: p.x, z: p.z };
  const nav = new Navigator(w, p, mill, 12);
  assert.equal(nav.step(w, p, 0.05).arrived, true);
  assert.deepEqual({ x: p.x, z: p.z }, before);
  p.atHome = true;
  assert.match(nav.step(w, p, 0.05).error!, /indoors/);
});

test('NPC plans around creator fences instead of driving into them', async () => {
  const { landscapeSchema } = await import('../src/shared/landscape.ts');
  const w = createWorld('fenced', 'Fenced', 'owner'),
    p = addPlayer(w, 'npc', 'Visitor');
  w.buildings = [];
  p.x = -30;
  p.z = -50;
  p.y = terrainHeight(w, p.x, p.z);
  w.landscape = landscapeSchema.parse({
    barriers: [
      {
        id: 'wall',
        points: [
          { x: 0, z: -70 },
          { x: 0, z: -30 },
        ],
        height: 3,
      },
    ],
  });
  const nav = new Navigator(w, p, { x: 30, z: -50 }, 3);
  let arrived = false;
  for (let i = 0; i < 6000; i++) {
    const result = nav.step(w, p, 0.05);
    assert.equal(result.error, undefined);
    move(w, p, result.input, 0.05);
    if (result.arrived) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived);
});

test('NPC routes out to a countryside gathering ground on a large map', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    p = addPlayer(w, 'npc', 'Mabel');
  const patch = worldResources(w).find((n) => n.id === 'stone-c13-14')!;
  assert.ok(Math.hypot(patch.x, patch.z) > 900, 'well outside the old 250 m grid');
  const nav = new Navigator(w, p, patch, 8);
  // The route itself stays on dry land the whole way.
  for (const q of nav.waypoints()) {
    assert.ok(terrainHeight(w, q.x, q.z) >= w.settings.seaLevel, `dry at ${q.x},${q.z}`);
    assert.ok(Math.abs(q.x) <= mapHalf(w) && Math.abs(q.z) <= mapHalf(w));
  }
  assert.ok(nav.waypoints().length > 100, `${nav.waypoints().length} waypoints`);
  // Journeys beyond a sensible day's drive are declined rather than gridded.
  assert.throws(() => new Navigator(w, p, { x: 5000, z: -4000 }, 8), /far/);
});
