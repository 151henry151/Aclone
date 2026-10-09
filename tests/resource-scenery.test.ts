// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resourceGeometry } from '../src/client/resource-scenery.ts';
import { resourceNodes, gatheringStatus, resourceAmount } from '../src/shared/resources.ts';
import {
  createWorld,
  addPlayer,
  terrainHeight,
  act,
  advance,
  move,
} from '../src/shared/simulation.ts';
import { Navigator } from '../src/server/npc/navigation.ts';
import { townRoads, roadDistance } from '../src/shared/town.ts';
import { completePuddlewick } from '../src/server/parish-services.ts';

test('all gathering sites sit on dry accessible outskirts, away from roads, buildings and each other', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  completePuddlewick(w);
  const roads = townRoads(w),
    p = addPlayer(w, 'gatherer', 'Gatherer');
  p.inventory = { chainsaw: 1, pickaxe: 1, shovel: 1 };
  for (const n of resourceNodes) {
    assert.ok(roadDistance(roads, n.x, n.z) > 20, `${n.id} is off the road`);
    assert.ok(roadDistance(roads, n.x, n.z) < 150, `${n.id} is still a short detour`);
    for (const b of w.buildings)
      assert.ok(Math.hypot(b.x - n.x, b.z - n.z) > 35, `${n.id} clears ${b.name}`);
    for (const other of resourceNodes.filter((other) => other.id !== n.id))
      assert.ok(Math.hypot(other.x - n.x, other.z - n.z) > 24, 'sites do not overlap');
    for (let x = -8; x <= 8; x += 2)
      for (let z = -8; z <= 8; z += 2) {
        assert.ok(Math.abs(n.x + x) < 250 && Math.abs(n.z + z) < 250);
        assert.ok(terrainHeight(w, n.x + x, n.z + z) > w.settings.seaLevel + 0.5);
      }
    p.x = n.x;
    p.z = n.z;
    p.y = terrainHeight(w, p.x, p.z);
    assert.equal(gatheringStatus(w, p, n).reason, undefined, n.id);
  }
});

test('relocation retains legacy IDs, saved reserves and an already-running gathering task', () => {
  const w = createWorld('saved', 'Saved', 'p'),
    p = addPlayer(w, 'p', 'Gatherer');
  const expected = ['logs', 'stone', 'gravel', 'dirt'].flatMap((item) =>
    Array.from({ length: 6 }, (_, i) => `${item}-${i}`),
  );
  assert.deepEqual(resourceNodes.map((n) => n.id).sort(), expected.sort());
  w.resources = { 'logs-0': { amount: 9, updated: w.time } };
  // A player already gathering at the retired location keeps the reserved load.
  p.task = { kind: 'gather', resource: 'logs-0', item: 'logs', amount: 3, end: w.time + 2 };
  const loaded = JSON.parse(JSON.stringify(w));
  advance(loaded, 3);
  assert.equal(loaded.players.p.inventory.logs, 3);
  assert.equal(resourceAmount(loaded, resourceNodes[0]), 9);
  const node = resourceNodes.find((n) => n.item === 'gravel')!;
  p.x = node.x;
  p.z = node.z;
  p.y = terrainHeight(w, p.x, p.z);
  p.task = undefined;
  p.inventory.shovel = 1;
  act(w, p.id, { type: 'gather', node: node.id });
  advance(w, 21);
  assert.equal(p.inventory.gravel, 3);
});

test('NPCs can drive to every relocated site and gather using ordinary physics', () => {
  for (const n of resourceNodes) {
    const w = createWorld('nav-resource', 'Resources', 'server');
    completePuddlewick(w);
    const p = addPlayer(w, 'npc', 'Gatherer');
    p.inventory = { chainsaw: 1, pickaxe: 1, shovel: 1 };
    const nav = new Navigator(w, p, n, 8);
    let arrived = false;
    for (let i = 0; i < 6000; i++) {
      const result = nav.step(w, p, 0.05);
      assert.equal(result.error, undefined, `${n.id}: ${result.error}`);
      move(w, p, result.input, 0.05);
      w.time += 0.05;
      if (result.arrived) {
        arrived = true;
        break;
      }
    }
    assert.ok(arrived, `reach ${n.id}`);
    assert.equal(gatheringStatus(w, p, n).reason, undefined, `gather ${n.id}`);
  }
});

test('resource models have finite geometry and bounded draw/triangle cost in both quality modes', () => {
  for (const item of ['logs', 'stone', 'gravel', 'dirt'])
    for (let variant = 0; variant < 6; variant++) {
      const high = resourceGeometry(item, variant, false),
        low = resourceGeometry(item, variant, true);
      const count = (model: typeof high) =>
        Object.values(model).reduce((n, g) => n + g.attributes.position.count / 3, 0);
      assert.ok(count(high) < 5000, `${item} detailed geometry budget`);
      assert.ok(count(low) < count(high) * 0.8, `${item} reduces mobile cost`);
      for (const model of [high, low]) {
        assert.ok(Object.keys(model).length <= 5, 'one draw per shared surface');
        for (const g of Object.values(model)) {
          for (const attribute of ['position', 'normal', 'uv'])
            assert.ok(Array.from(g.attributes[attribute].array).every(Number.isFinite));
          g.computeBoundingBox();
          assert.ok(g.boundingBox!.min.x > -10 && g.boundingBox!.max.x < 10);
          assert.ok(g.boundingBox!.min.z > -10 && g.boundingBox!.max.z < 10);
          assert.ok(g.boundingBox!.min.y > -1.5 && g.boundingBox!.max.y < 11);
        }
      }
      if (item === 'logs') {
        const p = high.leaves!.attributes.position,
          q = low.leaves!.attributes.position;
        const points = new Set(
          Array.from({ length: p.count }, (_, i) => `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`),
        );
        for (let i = 0; i < q.count; i++)
          assert.ok(
            points.has(`${q.getX(i)},${q.getY(i)},${q.getZ(i)}`),
            'quality changes preserve tree placement',
          );
      }
      for (const g of [...Object.values(high), ...Object.values(low)]) g.dispose();
    }
});
