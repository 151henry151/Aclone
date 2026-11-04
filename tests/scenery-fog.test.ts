// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { fadeSceneryIntoFog } from '../src/client/scenery-fog.ts';
import { seasonalMaterial } from '../src/client/materials.ts';

test('shared tree materials receive one fog fade while retaining seasonal and lighting hooks', () => {
  for (const seasonalFirst of [false, true]) {
    const material = new T.MeshLambertMaterial({ alphaTest: 0.28 });
    let calls = 0;
    material.onBeforeCompile = (shader) => {
      calls++;
      shader.fragmentShader += '\n// needle light transmission';
    };
    material.customProgramCacheKey = () => 'needle-light-transmission';
    if (seasonalFirst) seasonalMaterial(material, true);
    fadeSceneryIntoFog(material);
    if (!seasonalFirst) seasonalMaterial(material, true);
    const key = material.customProgramCacheKey();
    // Evergreen materials are also reused/decorated by streamed countryside.
    fadeSceneryIntoFog(material);
    assert.equal(material.customProgramCacheKey(), key);
    const shader = {
      uniforms: {},
      vertexShader: T.ShaderLib.lambert.vertexShader,
      fragmentShader: T.ShaderLib.lambert.fragmentShader,
    };
    material.onBeforeCompile(
      shader as Parameters<T.Material['onBeforeCompile']>[0],
      {} as T.WebGLRenderer,
    );
    assert.equal(calls, 1);
    assert.equal(shader.fragmentShader.match(/float sceneryCoverage/g)?.length, 1);
    assert.match(shader.fragmentShader, /needle light transmission/);
    assert.ok('snowCover' in shader.uniforms && 'autumnTint' in shader.uniforms);
    assert.match(key, /needle-light-transmission/);
    assert.match(key, /seasonal/);
    assert.match(key, /scenery-fog/);
    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, true);
    assert.equal(material.alphaTest, 0.28);
  }
});

test('fog-faded and ordinary scenery cannot share a cached shader program', () => {
  const ordinary = new T.MeshStandardMaterial();
  const faded = new T.MeshStandardMaterial();
  seasonalMaterial(ordinary);
  fadeSceneryIntoFog(faded);
  seasonalMaterial(faded);
  assert.notEqual(ordinary.customProgramCacheKey(), faded.customProgramCacheKey());
});

test('streamed scenery fades by individual fragment distance before its chunk boundary', () => {
  const material = new T.MeshLambertMaterial();
  fadeSceneryIntoFog(material);
  fadeSceneryIntoFog(material, 480);
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: T.ShaderLib.lambert.vertexShader,
    fragmentShader: T.ShaderLib.lambert.fragmentShader,
  };
  material.onBeforeCompile(
    shader as Parameters<T.Material['onBeforeCompile']>[0],
    {} as T.WebGLRenderer,
  );
  assert.equal(shader.uniforms.sceneryRange?.value, 480);
  assert.match(shader.vertexShader, /vSceneryDistance=length\(mvPosition.xyz\)/);
  assert.match(
    shader.fragmentShader,
    /smoothstep\(sceneryRange\*\.6,sceneryRange,vSceneryDistance\)/,
  );
  assert.equal(material.transparent, false);
});

test('static building batches preserve fog shader hooks and stay separate from ordinary materials', async () => {
  const { batchStaticScenery } = await import('../src/client/static-scene');
  const root = new T.Group();
  const faded = new T.MeshStandardMaterial({ color: '#aaaabb' });
  const ordinary = new T.MeshStandardMaterial({ color: '#aaaabb' });
  fadeSceneryIntoFog(faded);
  const key = faded.customProgramCacheKey();
  root.add(new T.Mesh(new T.BoxGeometry(), faded), new T.Mesh(new T.BoxGeometry(), ordinary));
  batchStaticScenery(root);
  assert.equal(root.children.length, 2, 'different shader behavior cannot share a static batch');
  const material = (root.children as T.Mesh[])
    .map((m) => m.material as T.Material)
    .find((m) => m.customProgramCacheKey() === key);
  assert.ok(material, 'batch clone must retain the fade hook');
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(
    shader as Parameters<T.Material['onBeforeCompile']>[0],
    {} as T.WebGLRenderer,
  );
  assert.match(shader.fragmentShader, /sceneryCoverage/);
  for (const mesh of root.children as T.Mesh[]) {
    mesh.geometry.dispose();
    (mesh.material as T.Material).dispose();
  }
});

test('unbounded building haze omits streaming-distance work and can acquire a range after other decorators', () => {
  const material = new T.MeshStandardMaterial();
  fadeSceneryIntoFog(material);
  seasonalMaterial(material);
  const compile = () => {
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(
      shader as Parameters<T.Material['onBeforeCompile']>[0],
      {} as T.WebGLRenderer,
    );
    return shader;
  };
  const unbounded = compile(),
    key = material.customProgramCacheKey();
  assert.doesNotMatch(unbounded.vertexShader, /vSceneryDistance/);
  assert.doesNotMatch(unbounded.fragmentShader, /sceneryRange/);
  fadeSceneryIntoFog(material, 480);
  assert.notEqual(
    material.customProgramCacheKey(),
    key,
    'adding a range must invalidate even an externally decorated shader',
  );
  const bounded = compile();
  assert.equal(bounded.uniforms.sceneryRange.value, 480);
  assert.match(bounded.vertexShader, /vSceneryDistance/);
  assert.ok('snowCover' in bounded.uniforms);
});
