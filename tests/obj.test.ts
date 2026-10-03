// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseObj } from '../src/shared/obj.ts';
import { validateVisualAsset } from '../src/server/asset-validation.ts';
import { createWorld } from '../src/shared/simulation.ts';
import { validateCreator } from '../src/shared/creator.ts';
const square = 'v 0 0 0\nv 2 0 0\nv 2 2 0\nv 0 2 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nvn 0 0 1\n';
test('OBJ parses UVs, normals, polygons and relative indices without following material paths', () => {
  const a = parseObj(
    square + 'mtllib https://elsewhere.invalid/file.mtl\nusemtl paint\nf 1/1/1 2/2/1 3/3/1 4/4/1',
  );
  const b = parseObj(square + 'f -4/-4/-1 -3/-3/-1 -2/-2/-1 -1/-1/-1');
  assert.deepEqual(a, b);
  assert.equal(a.triangles, 2);
  assert.equal(a.position.length, 18);
  assert.ok(a.hasUvs);
  assert.ok(a.normal);
  validateVisualAsset(Buffer.from(square + 'f 1 2 3'), 'model/obj');
  assert.equal(parseObj(square + 'f 1 2 3').normal, undefined);
});
test('OBJ rejects malformed, out-of-bounds and excessive geometry', () => {
  for (const bad of [
    '<html>oops</html>',
    'v NaN 0 0',
    square + 'f 0 2 3',
    square + 'f 1/999 2 3',
    square + 'f -99 2 3',
    square + 'f 1 2 300',
    square + 'curv 1 2 3',
    '\0',
    square + 'f 1 2 3\n'.repeat(50001),
  ])
    assert.throws(() => parseObj(bad));
  assert.throws(() => validateVisualAsset(Buffer.from([255, 255]), 'model/obj'));
});
test('OBJ texture references must belong to the same world and use an image', () => {
  const w = createWorld('obj', 'Workshop', 'owner');
  w.assets = [
    { id: 'obj', name: 'Mesh', type: 'model/obj', url: '/world-assets/obj.obj' },
    { id: 'png', name: 'Paint', type: 'image/png', url: '/world-assets/png.png' },
  ];
  const c = { models: [{ id: 'mesh', name: 'Mesh', asset: 'obj', texture: 'png' }] };
  assert.equal(validateCreator(w, c).models[0].texture, 'png');
  assert.throws(
    () => validateCreator(w, { models: [{ ...c.models[0], texture: 'somebody-elses-image' }] }),
    /textures/,
  );
  assert.throws(
    () => validateCreator(w, { models: [{ ...c.models[0], texture: 'obj' }] }),
    /textures/,
  );
});
