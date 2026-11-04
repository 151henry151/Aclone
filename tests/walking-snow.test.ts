// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, act } from '../src/shared/simulation';
import { drivingSurface } from '../src/shared/driving-surface';
import { roadConditions } from '../src/shared/environment';
import { creatorSchema } from '../src/shared/creator';
import { rulesSummary } from '../src/shared/rulesets';
import { Store } from '../src/server/store';
import { configureRules, applyDesign, exportDesign } from '../src/server/world-design';
import { Navigator } from '../src/server/npc/navigation';

function setup(id = 'walking-snow') {
  const w = createWorld(id, 'Snow walking', 'pilot');
  w.buildings = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.roads = [{ a: { x: 0, z: -200 }, b: { x: 0, z: 200 }, width: 6 }];
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(3),
  };
  w.settings.mapSize = 500;
  w.settings.vehicleLicences = false;
  w.climate = { snow: 1, snowDepth: 0.04, wetness: 0 };
  const p = addPlayer(w, 'pilot', 'Pilot');
  Object.assign(p, {
    x: 20,
    z: 0,
    y: 3,
    vehicle: 5,
    engine: true,
    fuel: 100,
    heading: 0,
    speed: 100,
  });
  return { w, p };
}
function cap(
  w: ReturnType<typeof setup>['w'],
  x: number,
  boost = false,
  vehicle = 5,
  prediction = false,
) {
  const p = structuredClone(w.players.pilot);
  Object.assign(p, { x, z: 0, y: 3, vehicle, speed: 100, engine: true, fuel: 100, heading: 0 });
  move(w, p, { throttle: 1, steer: 0, boost }, 0.05, prediction);
  return p.speed;
}
test('walk and Shift use the tractor snow factor, wet road and smooth verge without changing bare ground', () => {
  const { w } = setup();
  for (const depth of [0.04, 1]) {
    w.climate!.snowDepth = depth;
    for (const boost of [false, true]) {
      const base = 5 * (boost ? 1.7 : 1);
      const field = cap(w, 20, boost) / base;
      assert.ok(Math.abs(field - drivingSurface(w, 20, 0).speed) < 1e-12);
      assert.ok(depth === 0.04 ? Math.abs(field - 0.4) < 1e-12 : field > 0.1 && field < 0.11);
      assert.ok(Math.abs(field - cap(w, 20, boost, 0) / (13 * (boost ? 1.7 : 1))) < 1e-12);
      assert.ok(Math.abs(cap(w, 0, boost) / base - roadConditions(w).speed) < 1e-12);
      const verge = Array.from({ length: 21 }, (_, i) => cap(w, 3 + i * 0.1, boost) / base);
      for (let i = 1; i < verge.length; i++) {
        assert.ok(verge[i] <= verge[i - 1]);
        assert.ok(verge[i - 1] - verge[i] < 0.07);
      }
      assert.equal(cap(w, 20, boost, 5, true), cap(w, 20, boost, 5, false));
    }
  }
  for (const wetness of [0, 1]) {
    w.climate = { snow: 0, snowDepth: 0, wetness };
    for (const boost of [false, true])
      for (const x of [0, 20]) assert.equal(cap(w, x, boost), 5 * (boost ? 1.7 : 1));
  }
});
test('walking snow rules default on, validate, survive saves/designs, and alter only field drag', () => {
  const { w, p } = setup('puddlewick');
  assert.equal(w.settings.walkingSnow, true);
  assert.equal(w.settings.walkingSnowScale, 1);
  delete w.settings.walkingSnow;
  delete w.settings.walkingSnowScale;
  assert.ok(Math.abs(cap(w, 20) - 2) < 1e-12, 'legacy missing keys use the on/default curve');
  act(w, p.id, { type: 'settings', patch: { walkingSnow: false } });
  assert.equal(cap(w, 20), 5);
  assert.match(rulesSummary(w), /walking snow.*disabled/i);
  configureRules(w, { walkingSnow: true, walkingSnowScale: 0 });
  assert.equal(cap(w, 20), cap(w, 0));
  configureRules(w, { walkingSnowScale: 2 });
  assert.ok(cap(w, 20) < 2);
  assert.equal(cap(w, 0), 5 * roadConditions(w).speed);
  for (const patch of [
    { walkingSnow: 1 },
    { walkingSnowScale: -1 },
    { walkingSnowScale: 3 },
    { walkingSnowScale: NaN },
  ])
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
  assert.match(rulesSummary(w), /walking snow.*2/i);
  const target = createWorld('target', 'Target', 'builder');
  applyDesign(target, exportDesign(w));
  assert.equal(target.settings.walkingSnow, true);
  assert.equal(target.settings.walkingSnowScale, 2);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    assert.equal(saved.settings.walkingSnowScale, 2);
    assert.equal(cap(saved, 20), cap(w, 20));
  } finally {
    store.close();
  }
});
test('walking snow switches leave other vehicle movement unchanged', () => {
  const { w, p } = setup();
  for (const vehicle of [0, 2, 3, 4]) {
    const on = structuredClone(p),
      off = structuredClone(p);
    Object.assign(on, { vehicle, y: vehicle === 2 ? 80 : 3, speed: 4 });
    Object.assign(off, on);
    w.settings.walkingSnow = true;
    move(w, on, { throttle: 1, steer: 0.5, boost: true }, 0.05);
    w.settings.walkingSnow = false;
    move(w, off, { throttle: 1, steer: 0.5, boost: true }, 0.05);
    assert.deepEqual(on, off, `vehicle ${vehicle}`);
  }
});
test('a resident walks through deep snow using the shared movement cap and reaches a short destination', () => {
  const { w, p } = setup();
  w.climate!.snowDepth = 1;
  p.speed = 0;
  const nav = new Navigator(w, p, { x: 20, z: 35 }, 2);
  let arrived = false,
    maximum = 0;
  for (let i = 0; i < 6000; i++) {
    const result = nav.step(w, p, 0.05);
    assert.equal(result.error, undefined);
    move(w, p, result.input, 0.05);
    w.time += 0.05;
    maximum = Math.max(maximum, Math.abs(p.speed));
    if (result.arrived) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived);
  assert.ok(maximum < 0.6 && maximum > 0.4, `resident maximum ${maximum}`);
});
