// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, makeBuilding } from '../src/shared/simulation';
import { withinBoatLanding, type BoatLanding } from '../src/shared/boathouse';
import { vehicleCondition } from '../src/shared/vehicle-services';
import { Store } from '../src/server/store';
const patch = {
  riverDockDraft: 2,
  riverDockMaxLength: 30,
  riverDockMaxBeam: 8,
  boatShoreImpactLoss: 3,
  boatHouseArrivalRadius: 12,
  boatLandingArrivalRadius: 4,
  boatLandingShoreRadius: 2,
};
function setup() {
  const w = createWorld('nav', 'Navigation', 'p'),
    p = addPlayer(w, 'p', 'Owner');
  w.buildings = [];
  w.zones = [];
  w.terrain = [];
  Object.assign(w.settings, {
    vehicleLicences: false,
    requireCaptainSkill: false,
    vehicleMaintenance: false,
    tidalRange: 0,
    oceanWaves: 0,
  });
  Object.assign(p, {
    vehicle: 30,
    x: 0,
    z: 165,
    y: -2,
    heading: Math.PI,
    speed: 4,
    engine: true,
    fuel: 100,
    boatThrottle: 1,
    inventory: {},
    fleetState: { 30: { acquiredAt: 0, metres: 5, condition: 80 } },
  });
  return { w, p };
}
test('shore impact defaults legacy custom and zero damage preserve collision and immutable prediction', () => {
  for (const mode of ['default', 'missing', 'custom', 'zero', 'maximum']) {
    const { w, p } = setup();
    if (mode === 'missing') delete (w.settings as any).boatShoreImpactLoss;
    const loss = mode === 'custom' ? 3 : mode === 'zero' ? 0 : mode === 'maximum' ? 100 : 1;
    if (['custom', 'zero', 'maximum'].includes(mode))
      act(w, p.id, { type: 'settings', patch: { boatShoreImpactLoss: loss } });
    const input = { throttle: 0, steer: 0, boost: false };
    let impactFrom = p.z;
    for (let i = 0; i < 300 && p.boatThrottle !== 0; i++) {
      impactFrom = p.z;
      const before = p.fleetState,
        predicted = { ...p };
      move(w, predicted, input, 0.05, true);
      assert.equal(before![30].condition, 80);
      move(w, p, input, 0.05);
      // Voyage accounting is server-only; every predicted motion/fleet field agrees.
      const { fishingVoyage: predictedVoyage, ...predictedState } = predicted;
      const { fishingVoyage: serverVoyage, ...serverState } = p;
      assert.deepEqual(predictedState, serverState);
    }
    assert.equal(vehicleCondition(p), Math.max(0, 80 - loss));
    assert.equal(p.speed, 0);
    assert.equal(p.boatThrottle, 0);
    assert.ok(p.z > impactFrom);
    const pos = { x: p.x, z: p.z };
    for (let i = 0; i < 20; i++) move(w, p, input, 0.05);
    assert.deepEqual({ x: p.x, z: p.z }, pos);
    assert.equal(vehicleCondition(p), Math.max(0, 80 - loss));
  }
});
test('arrival rules retain hull geometry water checks and independent shore boathouse range', () => {
  for (const mode of ['default', 'missing', 'custom']) {
    const { w, p } = setup();
    w.settings.seaLevel = 0;
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(-20),
    };
    if (mode === 'missing') for (const k of Object.keys(patch)) delete (w.settings as any)[k];
    if (mode === 'custom') act(w, p.id, { type: 'settings', patch });
    const d: BoatLanding = {
      id: 'landing',
      berth: { x: 0, z: 0 },
      land: { x: 0, z: 0 },
      heading: 0,
    };
    const house = { ...d, building: makeBuilding('house', 'boathouse', 0, 0) };
    for (const [landing, afloat, radius] of [
      [d, true, mode === 'custom' ? 4 : 14],
      [house, true, mode === 'custom' ? 12 : 30],
      [d, false, mode === 'custom' ? 2 : 5],
      [house, false, 40],
    ] as const) {
      assert.equal(withinBoatLanding(w, { x: radius, z: 0 }, landing, afloat), true);
      assert.equal(withinBoatLanding(w, { x: radius + 0.01, z: 0 }, landing, afloat), false);
    }
    const radius = mode === 'custom' ? 4 : 14;
    assert.equal(
      withinBoatLanding(w, { x: 0, z: radius + 10, vehicle: 30, heading: 0 }, d, true),
      true,
    );
    assert.equal(
      withinBoatLanding(w, { x: 0, z: radius + 10, vehicle: 30, heading: Math.PI / 2 }, d, true),
      false,
    );
    w.terrain = [{ x: 0, z: radius / 2, radius: 3, height: 100 }];
    assert.equal(withinBoatLanding(w, { x: 0, z: radius }, d, true), false);
  }
});
test('boat navigation rules validate atomically and round trip through settings surfaces', async () => {
  const { w, p } = setup();
  for (const [k, min, max] of [
    ['riverDockDraft', 0.1, 20],
    ['riverDockMaxLength', 0.1, 50],
    ['riverDockMaxBeam', 0.1, 20],
    ['boatShoreImpactLoss', 0, 100],
    ['boatHouseArrivalRadius', 0.1, 100],
    ['boatLandingArrivalRadius', 0.1, 100],
    ['boatLandingShoreRadius', 0.1, 100],
  ] as const) {
    assert.ok(Object.hasOwn(w.settings, k));
    for (const value of [min - 0.01, max + 1, NaN, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { vehicleMaintenance: true, [k]: value } }),
      );
      assert.equal(JSON.stringify(w), before);
    }
  }
  act(w, p.id, { type: 'settings', patch });
  assert.equal(vehicleCondition(p), 80);
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
