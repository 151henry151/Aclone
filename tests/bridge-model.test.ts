// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { completedBridgeSite } from './fixtures/bridge-site';
import { finishRoadWork } from '../src/shared/road-work';
import { createBridgeModelSteps } from '../src/client/bridge-model';
import { bridgeDeckHeight } from '../src/shared/bridge-geometry';

test('bridge deck and dry ramps render at the shared support height with bounded geometry', () => {
  const { w, bridge, point } = completedBridgeSite();
  const model = finishRoadWork(createBridgeModelSteps(w, bridge));
  model.updateMatrixWorld(true);
  for (const q of [bridge.approachA, point(-60), point(0), point(60), bridge.approachB]) {
    const ray = new T.Raycaster(new T.Vector3(q.x, bridge.deckY + 2, q.z), new T.Vector3(0, -1, 0));
    const hit = ray.intersectObject(model, true)[0];
    assert.ok(hit, 'solid rendered deck at each support sample');
    assert.ok(
      Math.abs(hit.point.y - bridgeDeckHeight(w, q.x, q.z)!) < 0.02,
      `deck/support mismatch at ${q.x},${q.z}`,
    );
  }
  let triangles = 0,
    meshes = 0;
  model.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    }
  });
  assert.ok(triangles < 12000, `bridge triangle budget: ${triangles}`);
  assert.ok(meshes <= 5, `batched bridge draw budget: ${meshes}`);
});

test('an unfinished project shows its reservation but has no rendered deck over water', () => {
  const { w, bridge, point } = completedBridgeSite();
  delete bridge.completedAt;
  const model = finishRoadWork(createBridgeModelSteps(w, bridge));
  model.updateMatrixWorld(true);
  assert.ok(model.children.length > 0);
  const q = point(0);
  const hits = new T.Raycaster(
    new T.Vector3(q.x, bridge.deckY + 2, q.z),
    new T.Vector3(0, -1, 0),
  ).intersectObject(model, true);
  assert.equal(hits.length, 0);
});

test('bridge scene reuses completed geometry across donations and condition updates, and removes deleted projects', async () => {
  const { BridgeScene } = await import('../src/client/bridge-scene');
  const { w, bridge } = completedBridgeSite();
  const scene = new BridgeScene();
  for (let i = 0; i < 100; i++) scene.update(w);
  assert.equal(scene.group.children.length, 1);
  const model = scene.group.children[0];
  bridge.condition = 30;
  bridge.contributors.neighbour = structuredClone(bridge.paid);
  scene.update(w);
  assert.equal(scene.group.children[0], model, 'financial snapshots do not rebuild graphics');
  w.bridges = [];
  scene.update(w);
  assert.equal(scene.group.children.length, 0);
});

test('rebuilding a bridge model after excavation preserves its surveyed concrete base', () => {
  const { w, bridge, point } = completedBridgeSite();
  const coordinates = (model: T.Group) =>
    model.children
      .filter((o): o is T.Mesh => o instanceof T.Mesh)
      .map((o) => Array.from(o.geometry.attributes.position.array));
  const before = coordinates(finishRoadWork(createBridgeModelSteps(w, bridge)));
  w.terrain.push({ ...point(-22), radius: 10, height: -2 });
  assert.deepEqual(coordinates(finishRoadWork(createBridgeModelSteps(w, bridge))), before);
});
