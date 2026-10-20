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
