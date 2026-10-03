// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { sceneTextures, uploadTextures } from '../src/client/renderer-warmup.ts';
test('warmup collects shared, hidden and shader textures once without uploading absent images', () => {
  const scene = new T.Scene(),
    texture = new T.DataTexture(new Uint8Array(4), 1, 1),
    mask = new T.DataTexture(new Uint8Array(4), 1, 1);
  const material = new T.MeshStandardMaterial({ map: texture, bumpMap: texture });
  material.userData.warmTextures = [mask];
  const hidden = new T.Mesh(new T.BoxGeometry(), material);
  hidden.visible = false;
  scene.add(hidden);
  scene.add(
    new T.Mesh(
      new T.BoxGeometry(),
      new T.ShaderMaterial({
        uniforms: { map: { value: texture }, notLoaded: { value: new T.Texture() } },
      }),
    ),
  );
  assert.deepEqual(new Set(sceneTextures(scene)), new Set([texture, mask]));
});
test('a superseded world stops uploading immediately after yielding', async () => {
  const a = new T.Texture(),
    b = new T.Texture(),
    uploaded: T.Texture[] = [];
  let active = true;
  const complete = await uploadTextures(
    [a, b],
    (t) => uploaded.push(t),
    () => active,
    () => {},
    async () => {
      active = false;
    },
  );
  assert.equal(complete, false);
  assert.deepEqual(uploaded, [a]);
});
