// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHuman } from '../src/client/human.ts';

test('human figures have finite smooth geometry, human proportions and bounded rendering cost', () => {
  for (const pose of ['walking', 'seated'] as const) {
    const human = createHuman(pose);
    let triangles = 0,
      meshes = 0;
    human.group.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      meshes++;
      const geometry = o.geometry as T.BufferGeometry;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      for (const key of ['position', 'normal', 'color'])
        assert.ok(Array.from(geometry.attributes[key].array).every(Number.isFinite));
    });
    assert.ok(triangles < 22000, `${pose}: ${triangles} triangles`);
    assert.ok(meshes <= (pose === 'seated' ? 3 : 24), `${pose}: ${meshes} draws`);
    const bounds = new T.Box3().setFromObject(human.group);
    if (pose === 'walking') {
      assert.ok(bounds.max.y > 1.7 && bounds.max.y < 2);
      assert.ok(bounds.min.y >= -0.015);
      assert.ok(bounds.max.x - bounds.min.x < 0.8);
    } else {
      // Hip origin sits at the tractor seat (2.2m); head stays under the 3.7m roof.
      assert.ok(bounds.max.y + 2.2 < 3.7);
      assert.ok(bounds.min.y + 2.2 > 1);
    }
  }
});
test('walking feet stay above ground and motion settles back to a standing pose', () => {
  const human = createHuman('walking');
  for (let frame = 0; frame < 180; frame++) {
    human.animate(0.025, 1 / 60);
    const box = new T.Box3().setFromObject(human.group);
    assert.ok(box.min.y >= -0.02, `foot below ground: ${box.min.y}`);
  }
  for (let frame = 0; frame < 180; frame++) human.animate(0, 1 / 60);
  const standing = new T.Box3().setFromObject(createHuman('walking').group);
  const stopped = new T.Box3().setFromObject(human.group);
  assert.ok(Math.abs(stopped.min.y - standing.min.y) < 0.02);
});

test('pilots share immutable geometry but never each other’s animated joints', () => {
  const a = createHuman(),
    b = createHuman();
  const meshes = (root: T.Group) => {
    const out: T.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof T.Mesh) out.push(o);
    });
    return out;
  };
  const am = meshes(a.group),
    bm = meshes(b.group);
  assert.equal(am[0].geometry, bm[0].geometry);
  assert.equal(am[0].material, bm[0].material);
  assert.equal(am[0].geometry.userData.shared, true);
  const before = new T.Box3().setFromObject(b.group);
  for (let i = 0; i < 12; i++) a.animate(0.03, 1 / 60);
  assert.deepEqual(new T.Box3().setFromObject(b.group), before);
  assert.notEqual(a.group.getObjectByName('hips'), b.group.getObjectByName('hips'));
});
