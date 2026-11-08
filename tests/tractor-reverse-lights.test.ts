// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { OtherVehicleLights, updateReverseLight } from '../src/client/vehicle-lights';
import { tractorSlots } from '../src/shared/tractors';
import defaults from '../data/settings.json';
import { Store } from '../src/server/store';

test('all tractors illuminate behind only while reversing, independently of headlights', () => {
  const w = createWorld('reverse', 'Reverse', 'p'),
    p = addPlayer(w, 'p', 'Driver');
  const root = new T.Group(),
    light = new T.SpotLight();
  root.position.set(10, 0, 20);
  root.rotation.y = Math.PI / 2;
  Object.assign(p, { engine: true, speed: -1, lights: false });
  for (const slot of tractorSlots) {
    p.vehicle = slot;
    assert.equal(updateReverseLight(light, w, p, root), true);
    assert.equal(light.intensity, defaults.tractorReverseLightIntensity);
    assert.equal(light.distance, defaults.tractorReverseLightRange);
    assert.ok(light.target.position.x < light.position.x);
    assert.equal(light.castShadow, false);
  }
  for (const patch of [
    { speed: 0 },
    { speed: 1 },
    { vehicle: 5 },
    { vehicle: 1 },
    { engine: false },
    { atHome: 'home' },
    { hitch: 'driver' },
  ]) {
    Object.assign(
      p,
      { vehicle: 0, speed: -1, engine: true, atHome: undefined, hitch: undefined },
      patch,
    );
    assert.equal(updateReverseLight(light, w, p, root), false, JSON.stringify(patch));
    assert.equal(light.intensity, 0);
  }
  Object.assign(p, { vehicle: 0, speed: -1, engine: true, atHome: undefined, hitch: undefined });
  w.settings.tractorReverseLights = false;
  assert.equal(updateReverseLight(light, w, p, root), false);
  w.settings.tractorReverseLights = true;
  w.settings.tractorReverseLightIntensity = 43;
  w.settings.tractorReverseLightRange = 12;
  assert.equal(updateReverseLight(light, w, p, root), true);
  assert.equal(light.intensity, 43);
  assert.equal(light.distance, 12);
  w.settings.tractorReverseLightIntensity = 0;
  assert.equal(updateReverseLight(light, w, p, root), false);
});

test('nearby reversing tractors reuse the two existing shadow-free beam slots', () => {
  const w = createWorld('reverse', 'Reverse', 'p'),
    p = addPlayer(w, 'p', 'Driver');
  Object.assign(p, { vehicle: 0, engine: true, speed: -1, lights: false });
  const root = new T.Group(),
    pool = new OtherVehicleLights();
  pool.update(w, new Map([['p', root]]), 'observer', new T.Vector3());
  assert.equal(pool.lights.length, 2);
  assert.equal(pool.lights.filter((l) => l.intensity > 0).length, 1);
  assert.ok(pool.lights[0].target.position.z < pool.lights[0].position.z);
  p.speed = 1;
  pool.update(w, new Map([['p', root]]), 'observer', new T.Vector3());
  assert.ok(pool.lights.every((l) => l.intensity === 0));
  p.lights = true;
  pool.update(w, new Map([['p', root]]), 'observer', new T.Vector3());
  assert.ok(pool.lights[0].target.position.z > pool.lights[0].position.z);
  pool.clear();
  assert.ok(pool.lights.every((l) => l.intensity === 0 && !l.castShadow));
});

test('reverse light rules validate atomically and round-trip through editor, save and design', async () => {
  const w = createWorld('rules', 'Rules', 'p'),
    p = addPlayer(w, 'p', 'Owner');
  const patch = {
    tractorReverseLights: false,
    tractorReverseLightIntensity: 71,
    tractorReverseLightRange: 14,
  };
  for (const bad of [
    { tractorReverseLights: 1 },
    { tractorReverseLightIntensity: -1 },
    { tractorReverseLightIntensity: 1001 },
    { tractorReverseLightRange: 0 },
    { tractorReverseLightRange: 101 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch: bad as any }));
    assert.equal(JSON.stringify(w), before);
  }
  act(w, p.id, { type: 'settings', patch });
  const { settingsFields } = await import('../src/client/creator-editor');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const dest = createWorld('dest', 'Dest', 'p');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(settingsFields(w.settings).includes(`name="${k}"`));
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((dest.settings as any)[k], v);
    }
    assert.ok(rulesSummary(w).includes('71'));
    assert.ok(rulesSummary(w).includes('14'));
  } finally {
    store.close();
  }
});

test('minimum-range reverse beams still point behind the actual rear lamp, and old worlds use defaults', () => {
  const w = createWorld('legacy', 'Legacy', 'p'),
    p = addPlayer(w, 'p', 'Driver');
  Object.assign(p, { vehicle: 0, engine: true, speed: -1 });
  const root = new T.Group();
  root.userData.reverseLamp = new T.Vector3(0, 1.8, -2.1);
  const light = new T.SpotLight();
  w.settings.tractorReverseLightRange = 1;
  assert.ok(updateReverseLight(light, w, p, root));
  assert.ok(
    light.target.position.z < light.position.z,
    'short-range beam must still face backward',
  );
  delete w.settings.tractorReverseLights;
  delete w.settings.tractorReverseLightIntensity;
  delete w.settings.tractorReverseLightRange;
  assert.ok(updateReverseLight(light, w, p, root));
  assert.equal(light.intensity, defaults.tractorReverseLightIntensity);
  assert.equal(light.distance, defaults.tractorReverseLightRange);
  root.visible = false;
  assert.equal(updateReverseLight(light, w, p, root), false);
});
