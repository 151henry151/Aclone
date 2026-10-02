// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createRobocrow } from '../src/client/robocrow.ts';

test('industrial robocrow has a readable compact silhouette and bounded rendering cost', () => {
  const { group } = createRobocrow();
  const size = new T.Box3().setFromObject(group).getSize(new T.Vector3());
  assert.ok(size.x >= 4 && size.x <= 5.5, 'wingspan stays close to the original scout');
  assert.ok(size.z >= 2.5 && size.z <= 4, 'head, body and tail form a bird silhouette');
  assert.ok(size.y <= 2, 'compact body rather than a pilot-sized cockpit');
  let triangles = 0,
    draws = 0;
  group.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    draws++;
    const geometry = o.geometry as T.BufferGeometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    for (const a of Object.values(geometry.attributes))
      assert.ok(Array.from(a.array).every(Number.isFinite));
    assert.equal((o.material as T.Material).transparent, false);
  });
  assert.ok(draws <= 10, `${draws} draws: detail must be batched`);
  assert.ok(triangles < 16000, `${triangles} triangles: suitable for multiple scouts`);
  assert.ok(group.getObjectByName('Port lift fan'));
  assert.ok(group.getObjectByName('Starboard lift fan'));
});

test('lift fans counter-rotate without moving the model or allocating new scene objects', () => {
  const crow = createRobocrow();
  const before = crow.group.children.length;
  const port = crow.group.getObjectByName('Port lift fan')!;
  const starboard = crow.group.getObjectByName('Starboard lift fan')!;
  crow.animate(0.05);
  assert.ok(port.rotation.y > 0 && starboard.rotation.y < 0);
  for (let i = 0; i < 1000; i++) crow.animate(0.1);
  assert.ok(Math.abs(port.rotation.y) < Math.PI * 2);
  assert.equal(crow.group.children.length, before);
  assert.deepEqual(crow.group.position.toArray(), [0, 0, 0]);
});
