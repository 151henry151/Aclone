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

test('geometry warmup yields between uploads and restores the renderer on cancellation or failure', async () => {
  const { uploadGeometrySteps } = await import('../src/client/renderer-warmup.ts');
  for (const fail of [false, true]) {
    const root = new T.Group(),
      camera = new T.PerspectiveCamera();
    const meshes = [0, 1, 2].map(() => new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()));
    root.add(...meshes);
    const original = new T.WebGLRenderTarget(2, 2);
    let target: T.WebGLRenderTarget | null = original,
      uploads = 0,
      disposed = 0;
    meshes.forEach((m) => m.geometry.addEventListener('dispose', () => disposed++));
    const renderer = {
      getRenderTarget: () => target,
      setRenderTarget: (next: T.WebGLRenderTarget | null) => {
        target = next;
      },
      render: () => {
        assert.notEqual(target, original);
        uploads++;
        if (fail) throw Error('upload failed');
      },
    };
    const job = uploadGeometrySteps(renderer, root, camera);
    if (fail) assert.throws(() => job.next(), /upload failed/);
    else {
      job.next();
      assert.equal(uploads, 1);
      job.return(undefined);
    }
    assert.equal(target, original, 'warmup must not steal the visible frame buffer');
    assert.equal(disposed, 0, 'cancelling warmup must not dispose scene geometry');
    assert.ok(meshes.every((m) => m.parent === root));
  }
});

test('shader warmup yields between objects and cancels without detaching the visible scene', async () => {
  const { compileSceneSteps } = await import('../src/client/renderer-warmup.ts');
  const root = new T.Group(),
    target = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const sources = [0, 1, 2].map(
    () => new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()),
  );
  root.add(...sources);
  const compiled: T.Object3D[] = [];
  const renderer = {
    compileAsync: async (object: T.Object3D, view: T.Camera, scene: T.Scene) => {
      assert.equal(view, camera);
      assert.equal(scene, target);
      compiled.push(object);
    },
  };
  const job = compileSceneSteps(renderer, root, camera, target);
  await job.next().value;
  assert.deepEqual(compiled, [sources[0]]);
  job.return(undefined);
  assert.deepEqual(compiled, [sources[0]]);
  assert.ok(sources.every((o) => o.parent === root));
});
