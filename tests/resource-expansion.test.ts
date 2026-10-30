// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation';
import { ensurePuddlewickLighthouses } from '../src/server/puddlewick-lighthouses';
import { ensurePuddlewickResources } from '../src/server/puddlewick-resources';
import { worldResources, resourceAmount, resourceNode } from '../src/shared/resources';
import { terrainHeight } from '../src/shared/terrain';
import { highWater } from '../src/shared/ocean';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { roadDistance, townRoads } from '../src/shared/town';
import { onFarmLand } from '../src/shared/farm-land';

function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickLighthouses(w);
  return w;
}
test('the island expansion adds eight mixed concentrations, dispersed wood and three safe stones per bluff', () => {
  const w = setup();
  const old = structuredClone(worldResources(w));
  w.resources = { [old[0].id]: { amount: 4, updated: w.time } };
  assert.equal(ensurePuddlewickResources(w), true);
  const nodes = w.additionalResources!;
  assert.equal(nodes.length, 221);
  const centres = [];
  for (let i = 0; i < 8; i++) {
    const cluster = nodes.filter((n) => n.id.startsWith(`extra-cluster-${i}-`));
    assert.equal(cluster.length, 16);
    for (const item of ['logs', 'stone', 'gravel', 'dirt'])
      assert.equal(cluster.filter((n) => n.item === item).length, 4);
    const centre = {
      x: cluster.reduce((s, n) => s + n.x, 0) / 16,
      z: cluster.reduce((s, n) => s + n.z, 0) / 16,
    };
    centres.push(centre);
    assert.ok(cluster.every((n) => Math.hypot(n.x - centre.x, n.z - centre.z) < 260));
  }
  for (let a = 0; a < centres.length; a++)
    for (let b = a + 1; b < centres.length; b++)
      assert.ok(Math.hypot(centres[a].x - centres[b].x, centres[a].z - centres[b].z) > 700);
  const wood = nodes.filter((n) => n.id.startsWith('extra-woodland-'));
  assert.equal(wood.length, 48);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) assert.ok(wood.some((n) => n.x * sx > 500 && n.z * sz > 500));
  for (const b of w.coastalBluffs!) {
    const stones = nodes.filter((n) => n.id.startsWith(`extra-cliff-${b.id}-`));
    assert.equal(stones.length, 3);
    assert.ok(
      stones.every(
        (n) => n.item === 'stone' && Math.hypot(n.x - b.x, n.z - b.z) < b.inland + b.width,
      ),
    );
  }
  for (const n of nodes) {
    assert.ok(terrainHeight(w, n.x, n.z) > highWater(w) + 1);
    assert.ok(roadDistance(townRoads(w), n.x, n.z) >= 8);
    assert.equal(onFarmLand(w, n.x, n.z, 12), false);
  }
  const all = worldResources(w);
  assert.equal(new Set(all.map((n) => n.id)).size, all.length);
  for (const n of old)
    assert.deepEqual(
      all.find((a) => a.id === n.id),
      n,
    );
  assert.equal(resourceAmount(w, old[0]), 4);
  const saved = JSON.parse(JSON.stringify(w));
  assert.equal(ensurePuddlewickResources(saved), false);
  assert.deepEqual(worldResources(saved), all);
});
test('new grounds use ordinary gathering and depletion; cached lists see appended saved grounds', () => {
  const w = setup();
  ensurePuddlewickResources(w);
  const p = addPlayer(w, 'gatherer', 'Gatherer'),
    n = w.additionalResources!.find((n) => n.item === 'stone')!;
  Object.assign(p, { x: n.x, z: n.z, y: terrainHeight(w, n.x, n.z), inventory: { pickaxe: 1 } });
  act(w, p.id, { type: 'gather', node: n.id });
  assert.equal(resourceAmount(w, n), n.capacity - 3);
  advance(w, 21);
  assert.equal(p.inventory.stone, 3);
  const before = worldResources(w).length;
  w.additionalResources!.push(resourceNode('extra-test', 'logs', -600, -600));
  assert.equal(worldResources(w).length, before + 1);
});
test('expansion is deterministic, public-Puddlewick only and leaves existing relocated nodes intact', () => {
  const a = setup(),
    b = setup();
  a.resourceRelocations = { 'logs-0': { x: -300, z: -180 } };
  b.resourceRelocations = structuredClone(a.resourceRelocations);
  ensurePuddlewickResources(a);
  ensurePuddlewickResources(b);
  assert.deepEqual(a.additionalResources, b.additionalResources);
  assert.equal(worldResources(a).find((n) => n.id === 'logs-0')!.x, -300);
  for (const w of [
    createWorld('custom', 'Custom', 'server'),
    createWorld('puddlewick', 'Private', 'owner'),
  ]) {
    assert.equal(ensurePuddlewickResources(w), false);
    assert.equal(w.additionalResources, undefined);
  }
});
test('portable designs retain saved gathering grounds and reject duplicate or legacy IDs', () => {
  const w = setup();
  ensurePuddlewickResources(w);
  const design = exportDesign(w),
    copy = createWorld('copy', 'Copy', 'owner');
  applyDesign(copy, design);
  assert.deepEqual(copy.additionalResources, w.additionalResources);
  const duplicate = structuredClone(design);
  duplicate.additionalResources!.push(duplicate.additionalResources![0]);
  assert.throws(() => applyDesign(copy, duplicate), /Duplicate/);
  const invalid = structuredClone(design);
  invalid.additionalResources![0].id = 'logs-0';
  assert.throws(() => applyDesign(copy, invalid));
});
