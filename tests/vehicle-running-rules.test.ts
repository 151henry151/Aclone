// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move } from '../src/shared/simulation';
import { recordTravel, vehicleRecord } from '../src/shared/vehicle-services';
import { trailerFactors, trailerDefs } from '../src/shared/trailers';
import { terrainHeight } from '../src/shared/terrain';
import { vehicles } from '../src/shared/catalog';
import { Store } from '../src/server/store';
const patch = {
  vehicleWearPerMetre: 0.01,
  trailerSpeedBase: 2,
  trailerFuelBase: 3,
  trailerLoadSpeedPenalty: 0.5,
  trailerLoadFuelPenalty: 0.8,
};
function setup() {
  const w = createWorld('running', 'Running', 'p'),
    p = addPlayer(w, 'p', 'Owner');
  w.buildings = [];
  w.terrain = [];
  w.landscape = undefined;
  w.settings.seaLevel = -50;
  Object.assign(p, {
    x: 0,
    z: -200,
    y: terrainHeight(w, 0, -200),
    heading: 0,
    vehicle: 0,
    engine: true,
    fuel: 64,
    speed: 0,
    inventory: {},
  });
  return { w, p };
}
test('wear defaults and legacy fallback preserve mileage and condition while local rates apply to new travel', () => {
  for (const mode of ['default', 'missing', 'custom', 'zero', 'disabled']) {
    const { w, p } = setup();
    if (mode === 'missing') delete (w.settings as any).vehicleWearPerMetre;
    if (['custom', 'zero', 'disabled'].includes(mode))
      act(w, p.id, {
        type: 'settings',
        patch: {
          vehicleWearPerMetre: mode === 'zero' ? 0 : 0.01,
          vehicleMaintenance: mode !== 'disabled',
        },
      });
    vehicleRecord(w, p).condition = 80;
    const predicted = { ...p };
    recordTravel(w, predicted, 100);
    assert.equal(vehicleRecord(w, p).condition, 80);
    assert.equal(vehicleRecord(w, p).metres, 0);
    assert.equal(vehicleRecord(w, predicted).metres, 100);
    assert.ok(
      Math.abs(
        vehicleRecord(w, predicted).condition -
          (mode === 'custom' ? 79 : mode === 'zero' || mode === 'disabled' ? 80 : 79.98),
      ) < 1e-9,
    );
    p.vehicle = 5;
    recordTravel(w, p, 100);
    assert.equal(p.fleetState?.[5], undefined);
    p.vehicle = 0;
    p.game = { id: 'test' } as any;
    recordTravel(w, p, 100);
    assert.equal(vehicleRecord(w, p).metres, 0);
  }
});
test('trailer coefficients preserve default and legacy factors and honour empty half full and neutral states', () => {
  for (const mode of ['default', 'missing', 'custom', 'zero']) {
    const { w, p } = setup();
    if (mode === 'missing') for (const k of Object.keys(patch)) delete (w.settings as any)[k];
    if (mode === 'custom' || mode === 'zero')
      act(w, p.id, {
        type: 'settings',
        patch: {
          ...patch,
          ...(mode === 'zero' ? { trailerLoadSpeedPenalty: 0, trailerLoadFuelPenalty: 0 } : {}),
        },
      });
    assert.deepEqual(trailerFactors(w, p), { speed: 1, fuel: 1 });
    w.trailers = {
      t: {
        id: 't',
        owner: p.id,
        kind: 'box',
        x: p.x,
        z: p.z - 7,
        heading: 0,
        cargo: {},
        attached: p.id,
      },
    };
    for (const load of [0, 0.5, 1]) {
      const t = w.trailers.t;
      t.cargo = { wood: (load * trailerDefs.box.capacity) / 2 }; // Wood weighs 2.
      const tuned = mode === 'custom' || mode === 'zero';
      const factors = trailerFactors(w, p);
      assert.ok(
        Math.abs(
          factors.speed -
            1 / ((tuned ? 2 : 1.12) + load * (mode === 'zero' ? 0 : tuned ? 0.5 : 0.33)),
        ) < 1e-9,
      );
      assert.ok(
        Math.abs(
          factors.fuel - ((tuned ? 3 : 1.12) + load * (mode === 'zero' ? 0 : tuned ? 0.8 : 0.3)),
        ) < 1e-9,
      );
    }
    const before = structuredClone({ cargo: w.trailers.t.cargo, fuel: p.fuel });
    act(w, p.id, { type: 'settings', patch: { trailerSpeedBase: 1 } });
    assert.deepEqual({ cargo: w.trailers.t.cargo, fuel: p.fuel }, before);
  }
});
test('movement uses configured trailer fuel speed and travel wear', () => {
  const base = setup(),
    tuned = setup();
  for (const { w, p } of [base, tuned]) {
    w.trailers = {
      t: {
        id: 't',
        owner: p.id,
        kind: 'box',
        x: p.x,
        z: p.z - 7,
        heading: 0,
        cargo: {},
        attached: p.id,
      },
    };
  }
  act(tuned.w, tuned.p.id, { type: 'settings', patch });
  for (let i = 0; i < 200; i++)
    for (const { w, p } of [base, tuned]) {
      const before = p.fuel,
        condition = vehicleRecord(w, p).condition;
      move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05, true);
      const expected =
        (Math.abs(p.speed) / vehicles[0].speed) *
        vehicles[0].fuel *
        (w === base.w ? 1.12 : 3) *
        (1 + (100 - condition) * 0.003) *
        0.05;
      assert.ok(Math.abs(before - p.fuel - expected) < 1e-12);
    }
  assert.ok(tuned.p.speed < base.p.speed * 0.7);
  assert.ok(tuned.p.fuel < base.p.fuel);
  for (const { w, p } of [base, tuned]) {
    const rec = vehicleRecord(w, p);
    assert.ok(rec.metres > 1);
    assert.ok(Math.abs(rec.condition - (100 - rec.metres * (w === base.w ? 0.0002 : 0.01))) < 1e-9);
  }
});
test('running rules validate atomically and survive editor summary observation save and design round trips', async () => {
  const { w, p } = setup();
  for (const [key, min, max] of [
    ['vehicleWearPerMetre', 0, 1],
    ['trailerSpeedBase', 1, 10],
    ['trailerFuelBase', 1, 10],
    ['trailerLoadSpeedPenalty', 0, 10],
    ['trailerLoadFuelPenalty', 0, 10],
  ] as const) {
    assert.ok(Object.hasOwn(w.settings, key));
    for (const value of [min - 0.01, max + 1, NaN, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { vehicleMaintenance: false, [key]: value } }),
      );
      assert.equal(JSON.stringify(w), before);
    }
  }
  act(w, p.id, { type: 'settings', patch });
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      obs = observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(settingsFields(w.settings).includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(String(v)));
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((dest.settings as any)[k], v);
      assert.equal((obs.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});
