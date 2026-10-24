// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHuman } from '../src/client/human.ts';
function skins(root: T.Object3D) {
  const meshes: T.SkinnedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  return meshes;
}
test('walkers share geometry but own their skeleton; one continuous surface stays within the triangle budget', () => {
  const a = createHuman(),
    b = createHuman();
  const first = skins(a.group),
    second = skins(b.group);
  assert.equal(first.length, 1);
  assert.equal(first[0].skeleton.bones.length, 17);
  assert.equal(new Set(first.map((m) => m.skeleton)).size, 1);
  assert.notEqual(first[0].skeleton, second[0].skeleton);
  let triangles = 0;
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i].geometry, second[i].geometry);
    assert.equal(first[i].material, second[i].material);
    const g = first[i].geometry;
    triangles += g.attributes.position.count / 3;
    const weights = g.getAttribute('skinWeight'),
      indices = g.getAttribute('skinIndex');
    for (let v = 0; v < weights.count; v++) {
      assert.ok(
        Math.abs(weights.getX(v) + weights.getY(v) + weights.getZ(v) + weights.getW(v) - 1) < 1e-6,
      );
      assert.ok(
        [indices.getX(v), indices.getY(v), indices.getZ(v), indices.getW(v)].every((i) => i < 17),
      );
    }
  }
  assert.ok(triangles < 11000, `${triangles} triangles`);
  const otherThigh = b.group.getObjectByName('thigh--1')!;
  const otherPose = otherThigh.quaternion.clone();
  for (let i = 0; i < 60; i++) a.animate(1.4 / 60, 1 / 60);
  assert.ok(otherThigh.quaternion.equals(otherPose), 'Animating one player must not move another');
  assert.ok(!a.group.getObjectByName('thigh--1')!.quaternion.equals(otherPose));
  assert.equal(
    skins(createHuman('seated').group).length,
    0,
    'Drivers keep their inexpensive static batches',
  );
});
test('walking, jogging and reversing keep both boots above ground and settle without a frozen stride', () => {
  for (const speed of [0.5, 1.4, 3, 5, -1.4]) {
    const human = createHuman();
    let highest = 0;
    for (let frame = 0; frame < 360; frame++) {
      human.animate(speed / 60, 1 / 60);
      human.group.updateMatrixWorld(true);
      for (const side of [-1, 1]) {
        const foot = human.group.getObjectByName(`foot-${side}`)!;
        for (const z of [-0.06, 0.234]) {
          const point = new T.Vector3(0, -0.087, z).applyMatrix4(foot.matrixWorld);
          assert.ok(point.y >= -0.005, `${speed} m/s: buried boot ${point.y}`);
          highest = Math.max(highest, point.y);
        }
      }
    }
    assert.ok(highest > 0.08 && highest < 0.7, `Foot clearance at ${speed} m/s: ${highest}`);
    for (let frame = 0; frame < 120; frame++) human.animate(0, 1 / 60);
    human.group.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const foot = human.group.getObjectByName(`foot-${side}`)!;
      const position = new T.Vector3().setFromMatrixPosition(foot.matrixWorld);
      assert.ok(Math.abs(position.z) < 0.001, 'Foot returns below body when stopped');
      assert.ok(Math.abs(position.y - 0.09) < 0.001);
    }
  }
});
test('invalid timing and a network teleport cannot explode the walking rig', () => {
  const human = createHuman();
  for (const [distance, dt] of [
    [1, 0],
    [NaN, 0.1],
    [1, Infinity],
    [1000, 0.016],
    [-1000, 2],
    [0.1, 0.016],
  ]) {
    human.animate(distance, dt);
    human.group.updateMatrixWorld(true);
    human.group.traverse((o) => assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  }
});
test('walking has repeated sustained foot plants without horizontal skating', () => {
  const human = createHuman();
  const distance = 1.4 / 60;
  let previous: T.Vector3 | undefined,
    consecutive = 0,
    longest = 0,
    plants = 0;
  for (let frame = 0; frame < 500; frame++) {
    human.animate(distance, 1 / 60);
    human.group.position.z += distance;
    human.group.updateMatrixWorld(true);
    const foot = new T.Vector3().setFromMatrixPosition(
      human.group.getObjectByName('foot-1')!.matrixWorld,
    );
    if (frame > 100 && previous && Math.hypot(foot.x - previous.x, foot.z - previous.z) < 0.002) {
      consecutive++;
      if (consecutive === 12) plants++;
    } else consecutive = 0;
    longest = Math.max(longest, consecutive);
    previous = foot;
  }
  assert.ok(longest >= 12, `No sustained foot contact: ${longest} frames`);
  assert.ok(plants >= 4, `Foot must plant on each stride: ${plants} plants`);
});

test('the character is a watertight connected surface, including its bending joints', () => {
  const mesh = skins(createHuman().group)[0],
    g = mesh.geometry,
    p = g.attributes.position;
  const ids = new Map<string, number>(),
    vertices: number[] = [],
    edges = new Map<string, number>(),
    adjacent = new Map<number, Set<number>>();
  // Atlas seams duplicate UV vertices but must keep exactly the same position and weights.
  const weights = new Map<string, string>();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].join(',');
    if (!ids.has(key)) ids.set(key, ids.size);
    vertices.push(ids.get(key)!);
    const skin = JSON.stringify([
      Array.from(g.attributes.skinIndex.array.slice(i * 4, i * 4 + 4)),
      Array.from(g.attributes.skinWeight.array.slice(i * 4, i * 4 + 4)),
    ]);
    if (weights.has(key))
      assert.equal(skin, weights.get(key), 'UV seams must not open when animated');
    weights.set(key, skin);
  }
  for (let i = 0; i < vertices.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = vertices[i + j],
        b = vertices[i + ((j + 1) % 3)];
      assert.notEqual(a, b, 'No collapsed triangle edges');
      const edge = [a, b].sort((a, b) => a - b).join(',');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
      if (!adjacent.has(a)) adjacent.set(a, new Set());
      adjacent.get(a)!.add(b);
      if (!adjacent.has(b)) adjacent.set(b, new Set());
      adjacent.get(b)!.add(a);
    }
  for (const count of edges.values())
    assert.equal(count, 2, 'Every edge must have two incident faces');
  const visited = new Set([0]),
    queue = [0];
  for (let i = 0; i < queue.length; i++)
    for (const v of adjacent.get(queue[i])!)
      if (!visited.has(v)) {
        visited.add(v);
        queue.push(v);
      }
  assert.equal(
    visited.size,
    ids.size,
    'Head, torso and limbs must be joined, not intersecting pieces',
  );
  assert.equal(
    ids.size - edges.size + vertices.length / 3,
    2,
    'Closed character surface has no holes',
  );
});

test('hands and lower sleeves follow arms completely while the pelvis is unaffected by arm swing', () => {
  const mesh = skins(createHuman().group)[0],
    g = mesh.geometry,
    p = g.attributes.position;
  let hands = 0,
    hips = 0;
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(p.getX(i)),
      y = p.getY(i);
    let armWeight = 0;
    for (let j = 0; j < 4; j++) {
      const bone = mesh.skeleton.bones[g.attributes.skinIndex.array[i * 4 + j]];
      if (/^(arm|forearm|hand)-/.test(bone.name))
        armWeight += g.attributes.skinWeight.array[i * 4 + j];
    }
    if ((x > 0.3 && y < 0.85 && y > 0.73) || (x > 0.226 && y > 0.89 && y < 1.18)) {
      hands++;
      assert.ok(
        armWeight > 0.999,
        'Hands and lower sleeves must not stretch towards the torso or legs',
      );
    }
    if (x < 0.2 && y > 0.8 && y < 1.1) {
      hips++;
      assert.equal(armWeight, 0, 'Arm swings must not pull the hip surface');
    }
  }
  assert.ok(hands > 20 && hips > 20);
});

test('gait transitions and reverse-to-forward turns do not flip a knee', () => {
  const human = createHuman(),
    previous = new Map<string, T.Quaternion>();
  const names = ['thigh-1', 'shin-1', 'foot-1', 'thigh--1', 'shin--1', 'foot--1'];
  let largest = 0;
  for (let frame = 0; frame < 1200; frame++) {
    const speed =
      frame < 300 ? 1.4 : frame < 600 ? 3.8 : frame < 720 ? 0 : frame < 960 ? -0.7 : 1.4;
    human.animate(speed / 60, 1 / 60, frame > 960 ? 0.01 : 0);
    for (const name of names) {
      const q = human.group.getObjectByName(name)!.quaternion;
      if (previous.has(name)) largest = Math.max(largest, q.angleTo(previous.get(name)!));
      previous.set(name, q.clone());
    }
  }
  assert.ok(largest < 0.5, `Sudden leg joint rotation: ${largest} radians in one frame`);
});
