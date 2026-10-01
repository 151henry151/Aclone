// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { TownLighting } from '../src/client/lighting.ts';
import { createWorld } from '../src/shared/simulation.ts';

test('reusing a streetlight slot for a window restores its narrower profile without adding lights', () => {
  const world = createWorld('night', 'Night', 'owner');
  world.settings.time = 72000;
  const home = world.buildings.find((b) => b.kind === 'home')!;
  home.smoking = true;
  const root = new T.Group();
  for (const [x, source] of [
    [0, home.id],
    [100, 'street'],
  ] as const) {
    const pane = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.1), new T.MeshStandardMaterial());
    pane.position.set(x, 3.6, 0);
    pane.userData.lightSource = source;
    root.add(pane);
  }
  const lighting = new TownLighting(1);
  lighting.reset(root);
  const lights = lighting.group.children.filter((o): o is T.SpotLight => o instanceof T.SpotLight);
  assert.equal(lights.length, 1);
  const light = lights[0];
  const profile = () => [light.intensity, light.distance, light.angle, light.penumbra, light.decay];
  lighting.update(world, new T.Vector3(0, 3, 0));
  const windowProfile = profile();
  assert.ok(light.intensity > 0);
  lighting.update(world, new T.Vector3(100, 3, 0));
  assert.ok(light.angle > windowProfile[2]);
  assert.ok(light.distance > windowProfile[1]);
  lighting.update(world, new T.Vector3(0, 3, 0));
  assert.deepEqual(profile(), windowProfile);
  assert.equal(lighting.group.children.filter((o) => o instanceof T.SpotLight).length, 1);

  // Windows sleep but the same streetlight remains available through midnight.
  world.settings.time = 0;
  lighting.update(world, new T.Vector3(0, 3, 0));
  assert.ok(light.intensity > 0);
  assert.equal(light.position.x, 100);
  world.settings.time = 43200;
  lighting.update(world, new T.Vector3(100, 3, 0));
  assert.equal(light.intensity, 0);
  assert.equal(lighting.group.visible, false);
});
