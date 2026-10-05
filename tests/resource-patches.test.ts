// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, terrainHeight } from '../src/shared/simulation.ts';
import { resourceNodes, worldResources, gatheringStatus } from '../src/shared/resources.ts';
import { mapHalf, woodland } from '../src/shared/terrain.ts';

test('compact worlds keep exactly the surveyed village gathering grounds', () => {
  const w = createWorld('arena', 'Arena', 'owner', 'playground');
  assert.deepEqual(worldResources(w), resourceNodes);
  assert.equal(resourceNodes.length, 24);
});

test('the countryside adds deterministic resource patches on dry land outside the village', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const nodes = worldResources(w),
    half = mapHalf(w);
  assert.equal(nodes, worldResources(w), 'cached per world');
  assert.deepEqual(nodes, worldResources(createWorld('puddlewick', 'Puddlewick', 'server')));
  for (const legacy of resourceNodes) assert.ok(nodes.some((n) => n.id === legacy.id));
  const patches = nodes.filter((n) => !resourceNodes.includes(n));
  assert.ok(patches.length > 120 && patches.length < 900, `${patches.length} patches`);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, 'unique IDs');
  const kinds = new Set<string>();
  for (const n of patches) {
    kinds.add(n.item);
    assert.ok(Math.abs(n.x) < half && Math.abs(n.z) < half);
    assert.ok(Math.max(Math.abs(n.x), Math.abs(n.z)) >= 320, 'outside the village');
    assert.ok(terrainHeight(w, n.x, n.z) > w.settings.seaLevel + 1, `dry at ${n.x},${n.z}`);
    assert.ok(Number.isInteger(Number(n.id.split('-').at(-1))), 'variant suffix stays numeric');
    if (n.item === 'logs') assert.ok(woodland(w, n.x, n.z) > 0.4, 'timber lies in the woods');
    if (n.item === 'stone') assert.ok(terrainHeight(w, n.x, n.z) > 15, 'stone lies on high ground');
    for (const other of nodes)
      if (other !== n) assert.ok(Math.hypot(other.x - n.x, other.z - n.z) > 60);
  }
  assert.deepEqual([...kinds].sort(), ['dirt', 'gravel', 'logs', 'stone']);
});

test('a resident can gather at a countryside patch', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'p', 'Pilot');
  const n = worldResources(w).find((n) => !resourceNodes.includes(n) && n.item === 'dirt')!;
  Object.assign(p, { x: n.x, z: n.z, y: terrainHeight(w, n.x, n.z) });
  assert.equal(gatheringStatus(w, p, n).reason, undefined);
  act(w, p.id, { type: 'gather', node: n.id });
  assert.equal(p.task?.resource, n.id);
  assert.equal(w.resources?.[n.id]?.amount, n.capacity - 3);
});
