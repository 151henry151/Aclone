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

function streetLamps(xs: number[]) {
  const root = new T.Group();
  for (const x of xs) {
    const pane = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), new T.MeshStandardMaterial());
    pane.position.set(x, 3.6, 0);
    pane.userData.lightSource = 'street';
    root.add(pane);
  }
  return root;
}
/** Summed glow colour drawn on the ground within a few metres of `x`. */
function glowNear(lighting: TownLighting, x: number) {
  const geometry = lighting.glow.geometry,
    position = geometry.getAttribute('position'),
    color = geometry.getAttribute('color');
  let sum = 0;
  for (let i = 0; i < position.count; i++)
    if (Math.abs(position.getX(i) - x) < 3 && Math.abs(position.getZ(i)) < 3) sum += color.getX(i);
  return sum;
}

test('lit streetlamps beyond the spotlight budget still glow on the ground below them', () => {
  const world = createWorld('night', 'Night', 'owner');
  world.settings.time = 0;
  const lighting = new TownLighting(1);
  const root = streetLamps([0, 100, 200]);
  lighting.reset(root);
  assert.ok(lighting.glow.parent, 'the glow is added to the scenery root');
  lighting.update(world, new T.Vector3(0, 3, 0));
  const light = lighting.group.children.find((o): o is T.SpotLight => o instanceof T.SpotLight)!;
  assert.equal(light.position.x, 0);
  assert.ok(light.intensity > 0);
  assert.equal(glowNear(lighting, 0), 0);
  assert.ok(glowNear(lighting, 100) > 0);
  assert.ok(glowNear(lighting, 200) > 0);
  const top = lighting.glow.geometry.getAttribute('position');
  for (let i = 0; i < top.count; i++) assert.ok(top.getY(i) > 0 && top.getY(i) < 1);

  world.settings.time = 43200;
  lighting.update(world, new T.Vector3(0, 3, 0));
  assert.equal(glowNear(lighting, 100), 0);
  assert.equal(lighting.glow.visible, false);
});

test('a streetlamp hands its spotlight over to a ground glow gradually', () => {
  const world = createWorld('night', 'Night', 'owner');
  world.settings.time = 0;
  const lighting = new TownLighting(1);
  lighting.reset(streetLamps([0, 100]));
  const light = lighting.group.children.find((o): o is T.SpotLight => o instanceof T.SpotLight)!;
  lighting.update(world, new T.Vector3(-10, 3, 0));
  const full = light.intensity;
  assert.equal(glowNear(lighting, 0), 0);
  const steps: [number, number][] = [];
  for (let x = 30; x <= 50; x += 2) {
    lighting.update(world, new T.Vector3(x, 3, 0));
    steps.push(light.position.x === 0 ? [light.intensity, glowNear(lighting, 0)] : [0, 0]);
  }
  // Between the lamps neither holds a full spotlight, so the swap itself is invisible.
  lighting.update(world, new T.Vector3(50, 3, 0));
  assert.ok(light.intensity < full * 0.1);
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i][0] <= steps[i - 1][0] + 1e-9, 'spotlight only dims');
    assert.ok(full - steps[i][0] - (full - steps[i - 1][0]) < full * 0.35, 'no sudden drop');
  }
  lighting.update(world, new T.Vector3(40, 3, 0));
  assert.ok(light.intensity > 0 && light.intensity < full);
  assert.ok(glowNear(lighting, 0) > 0);
});
