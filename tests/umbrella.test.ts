// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHuman } from '../src/client/human';
import { createRainUmbrella, needsRainUmbrella } from '../src/client/umbrella';
import { Precipitation } from '../src/client/weather';

test('rain umbrellas belong to outdoor walkers, not drivers, passengers, homes or snowfall', () => {
  const p = { vehicle: 5, atHome: false };
  assert.ok(needsRainUmbrella(p, 'rain'));
  for (const precipitation of ['clear', 'snow']) assert.ok(!needsRainUmbrella(p, precipitation));
  for (const vehicle of [0, 1, 2, 3, 4, 6, 7, 8, 9, 10])
    assert.ok(!needsRainUmbrella({ vehicle, atHome: false }, 'rain'));
  assert.ok(!needsRainUmbrella({ ...p, atHome: true }, 'rain'));
  // Both passenger modes retain their seated pose instead of opening a canopy.
  assert.ok(!needsRainUmbrella({ ...p, hitch: {} as any }, 'rain'));
  assert.ok(!needsRainUmbrella({ ...p, crowBody: {} as any }, 'rain'));
});

test('umbrella unfolds continuously and stays in the left hand while walking and turning', () => {
  const human = createHuman(),
    umbrella = createRainUmbrella(human.group);
  const root = new T.Group();
  root.add(human.group, umbrella.group);
  root.position.set(125, 12, -58);
  root.rotation.y = 1.8;
  let last = 0;
  for (let i = 0; i < 180; i++) {
    human.animate(1.5 / 60, 1 / 60, 0.002);
    const right = human.group.getObjectByName('forearm--1')!.quaternion.clone();
    umbrella.update(true, 1 / 60);
    assert.ok(umbrella.openness >= last && umbrella.openness - last < 0.04);
    last = umbrella.openness;
    assert.ok(right.equals(human.group.getObjectByName('forearm--1')!.quaternion));
    root.updateMatrixWorld(true);
    const grip = umbrella.group.getWorldPosition(new T.Vector3());
    const hand = human.group.getObjectByName('hand-1')!.getWorldPosition(new T.Vector3());
    assert.ok(grip.distanceTo(hand) < 1e-6, 'Grip remains attached through walking and yaw');
    if (i > 65) {
      const roof = umbrella.shelter()!;
      assert.ok(roof.y > root.position.y + 1.7, 'Canopy clears the head');
    }
  }
  assert.equal(umbrella.openness, 1);
  human.group.visible = false;
  assert.ok(umbrella.group.visible, 'First-person hiding of the body leaves the canopy visible');
  for (let i = 0; i < 70; i++) {
    human.animate(0, 1 / 60);
    umbrella.update(false, 1 / 60);
  }
  assert.equal(umbrella.openness, 0);
  assert.equal(umbrella.group.visible, false);
  assert.equal(umbrella.shelter(), undefined);
});

test('shared umbrella canopy keeps independent folding, upward normals and bounded geometry', () => {
  const a = createRainUmbrella(createHuman().group),
    b = createRainUmbrella(createHuman().group);
  assert.equal(a.fabric.geometry, b.fabric.geometry);
  for (let i = 0; i < 70; i++) a.update(true, 1 / 60);
  assert.equal(a.openness, 1);
  assert.equal(b.openness, 0);
  assert.notEqual(a.fabric.morphTargetInfluences, b.fabric.morphTargetInfluences);
  const normal = a.fabric.geometry.getAttribute('normal');
  for (let i = 97; i < normal.count; i++) assert.ok(normal.getY(i) > 0);
  let triangles = 0;
  a.group.traverse((o) => {
    if (o instanceof T.Mesh)
      triangles +=
        ((o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3) *
        (o instanceof T.InstancedMesh ? o.count : 1);
  });
  assert.ok(triangles < 3000, `${triangles} triangles`);
  for (const dt of [NaN, 0, Infinity, -1]) a.update(false, dt);
  assert.equal(a.openness, 1);
});

test('rain shelter clears on folding without hiding the rest of the weather', () => {
  const rain = new Precipitation();
  rain.shelter(new T.Vector3(12, 4, 18));
  rain.update(1 / 60, new T.Vector3(12, 3, 18), 'rain', 1, 2);
  const uniforms = (rain.mesh.material as T.ShaderMaterial).uniforms;
  assert.deepEqual(uniforms.shelter.value.toArray().slice(0, 3), [12, 4, 18]);
  assert.ok(uniforms.shelter.value.w > 0 && rain.mesh.visible);
  rain.shelter();
  assert.equal(uniforms.shelter.value.w, 0);
});
