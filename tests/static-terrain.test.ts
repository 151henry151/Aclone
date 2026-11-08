// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { InlandWater } from '../src/client/inland-water';
import { createWorld } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { waterLevel } from '../src/shared/ocean';

test('stationary rivers retain geometry and animated water without repeated mesh transforms', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  const water = new InlandWater(),
    scene = new T.Scene();
  scene.add(water.group);
  water.reset(w);
  const meshes = water.group.children.filter((m): m is T.Mesh => m instanceof T.Mesh);
  assert.ok(meshes.length > 20, 'exercise actual river reaches, banks and ponds');
  const surface = meshes.find((m) => m.material instanceof T.MeshPhongMaterial)!;
  const shader = {
    uniforms: {},
    vertexShader: '',
    fragmentShader: '',
  } as unknown as T.WebGLProgramParametersWithUniforms;
  (surface.material as T.Material).onBeforeCompile(shader, {} as T.WebGLRenderer);
  let compositions = 0,
    multiplications = 0;
  const original = meshes.map((mesh) => ({
    mesh,
    geometry: mesh.geometry,
    matrix: mesh.matrixWorld.clone(),
  }));
  for (const mesh of meshes) {
    const compose = mesh.matrix.compose.bind(mesh.matrix);
    mesh.matrix.compose = (...args) => {
      compositions++;
      return compose(...args);
    };
    const multiply = mesh.matrixWorld.multiplyMatrices.bind(mesh.matrixWorld);
    mesh.matrixWorld.multiplyMatrices = (...args) => {
      multiplications++;
      return multiply(...args);
    };
  }
  const point = w.northernIsland!.rivers[0].points[0];
  for (let i = 0; i < 10; i++) {
    const far = i % 2 === 0,
      x = far ? 100000 : point.x,
      z = far ? 100000 : point.z;
    water.update(w, 1200 + i * 500, x, z);
    scene.updateMatrixWorld();
    assert.equal(
      meshes.some((m) => m.visible),
      !far,
      'near reaches return after leaving the area',
    );
    assert.equal(shader.uniforms.riverTime.value, 1200 + i * 500);
    assert.equal(
      shader.uniforms.riverTide.value,
      waterLevel(w, 1200 + i * 500) - w.settings.seaLevel,
    );
    assert.equal(shader.uniforms.riverCentre.value.x, x);
    assert.equal(shader.uniforms.riverCentre.value.y, z);
  }
  for (const { mesh, geometry, matrix } of original) {
    assert.equal(mesh.geometry, geometry);
    assert.deepEqual(mesh.matrixWorld.elements, matrix.elements);
  }
  assert.equal(compositions, 0, 'stationary visible and hidden water must reuse local matrices');
  assert.equal(multiplications, 0, 'stationary visible and hidden water must reuse world matrices');
  let disposed = 0;
  for (const mesh of meshes) mesh.geometry.addEventListener('dispose', () => disposed++);
  water.reset(w);
  assert.equal(disposed, meshes.length);
  assert.equal(water.group.children.length, meshes.length);
  assert.ok(water.group.children.every((mesh) => !meshes.includes(mesh as T.Mesh)));
  water.update(w, 5000, point.x, point.z);
  scene.updateMatrixWorld();
  assert.ok(water.group.children.some((mesh) => mesh.visible));
  for (const mesh of water.group.children) {
    assert.equal(mesh.matrixAutoUpdate, false);
    assert.equal(mesh.matrixWorldAutoUpdate, false);
    assert.deepEqual(mesh.matrixWorld.elements, new T.Matrix4().elements);
  }
});
