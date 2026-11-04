// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move } from '../src/shared/simulation';
import { advanceTrawl, trawlAction, visibleTrawl } from '../src/shared/commercial-fishing';
import { boatLoadFactors } from '../src/shared/fishing-expedition';
import { Store } from '../src/server/store';
const patch = {
  trawlSpeed: 1.5,
  trawlNetCapacity: 20,
  trawlShoalMeanSeconds: 60,
  trawlFuelPerMinute: 6,
};
function setup() {
  const w = createWorld('trawl-rules', 'Trawl rules', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.settings.requireCaptainSkill = false;
  Object.assign(p, {
    vehicle: 30,
    fuelVehicle: 30,
    x: 0,
    z: 1400,
    y: -1,
    heading: 0,
    engine: true,
    fuel: 100,
    speed: 2,
    boatThrottle: 1,
    inventory: {},
  });
  return { w, p };
}
test('default and missing trawl rules retain their burn while custom rules and vessel tuning override it', () => {
  for (const mode of ['default', 'missing', 'custom', 'tuned']) {
    const { w, p } = setup();
    if (mode === 'missing') for (const k of Object.keys(patch)) delete (w.settings as any)[k];
    if (mode === 'custom' || mode === 'tuned') act(w, p.id, { type: 'settings', patch });
    if (mode === 'tuned')
      act(w, p.id, {
        type: 'vehicleTuning',
        slot: 30,
        trawlFuel: 0.02,
        trawlSpeed: 1.2,
        netCapacity: 40,
      });
    trawlAction(w, p, 'deploy');
    const factor = boatLoadFactors(w, p).fuel,
      before = p.fuel;
    advanceTrawl(w, p, 1, 0, true);
    assert.ok(
      Math.abs(
        before - p.fuel - (mode === 'tuned' ? 0.02 : mode === 'custom' ? 0.1 : 8.5 / 60) * factor,
      ) < 1e-10,
    );
    for (let i = 0; i < 100; i++) move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1, true);
    const cap = mode === 'tuned' ? 1.2 : mode === 'custom' ? 1.5 : 2.4;
    assert.ok(p.speed <= cap + 1e-9);
    assert.ok(p.speed > cap * 0.9);
    p.trawl!.catch = { cod: 1 };
    assert.equal(visibleTrawl(w, p)!.activity, mode === 'custom' ? 2 : 1);
  }
});
test('capacity edits retain catches, enforce the next fish, and allow a raised full net to resume', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'settings', patch });
  trawlAction(w, p, 'deploy');
  p.trawl!.catch = { cod: 4 };
  p.trawl!.shoal = { ground: 0, nextChange: 1000, nextFish: 0, luck: 1, nextLuck: 1000 };
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl!.catch!.cod, 5);
  assert.equal(p.trawl!.netFull, true);
  assert.equal(p.trawl!.deployed, false);
  act(w, p.id, { type: 'settings', patch: { trawlNetCapacity: 10 } });
  assert.equal(p.trawl!.catch!.cod, 5);
  assert.throws(() => trawlAction(w, p, 'deploy'), /net is full/);
  p.trawl!.shoal!.pendingFish = 'cod';
  act(w, p.id, { type: 'settings', patch: { trawlNetCapacity: 22 } });
  assert.throws(() => trawlAction(w, p, 'deploy'), /net is full/);
  act(w, p.id, { type: 'settings', patch: { trawlNetCapacity: 24 } });
  trawlAction(w, p, 'deploy');
  assert.equal(p.trawl!.deployed, true);
  trawlAction(w, p, 'haul');
  assert.equal(p.inventory.cod, 5);
  trawlAction(w, p, 'haul');
  assert.equal(p.inventory.cod, 5);
});
test('new shoal schedules use the current mean while saved encounter clocks survive edits', (t) => {
  const { w, p } = setup();
  t.mock.method(Math, 'random', () => 0.5);
  act(w, p.id, { type: 'settings', patch });
  trawlAction(w, p, 'deploy');
  assert.equal(p.trawl!.shoal!.nextChange, -Math.log(0.5) * 60);
  const before = structuredClone(p.trawl);
  act(w, p.id, { type: 'settings', patch: { trawlShoalMeanSeconds: 120 } });
  assert.deepEqual(p.trawl, before);
  Object.assign(p.trawl!.shoal!, { nextChange: 0, nextFish: 10000, luck: 1, nextLuck: 10000 });
  advanceTrawl(w, p, 0.1, 0.2, false, () => 0.5);
  assert.ok(Math.abs(p.trawl!.shoal!.nextChange - (-Math.log(0.5) * 120 - 0.1)) < 1e-9);
});
test('trawl rules validate atomically and round trip in editor summaries observations designs and saves', async () => {
  const { w, p } = setup();
  for (const [key, min, max, integer] of [
    ['trawlSpeed', 1, 8, false],
    ['trawlNetCapacity', 10, 5000, true],
    ['trawlShoalMeanSeconds', 1, 86400, true],
    ['trawlFuelPerMinute', 0.06, 60, false],
  ] as const) {
    assert.ok(Object.hasOwn(w.settings, key));
    for (const value of [min - 0.01, max + 1, NaN, Infinity, ...(integer ? [min + 0.5] : [])]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { fishingMode: 0, [key]: value } }),
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
      assert.ok(settingsFields().includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(String(v)));
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((dest.settings as any)[k], v);
      assert.equal((obs.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

test('vehicle editor inherits local trawl defaults and retains explicit vessel tuning', async () => {
  const { vehicleEditor } = await import('../src/client/vehicle-editor');
  const { w, p } = setup();
  act(w, p.id, { type: 'settings', patch });
  for (const [key, value] of Object.entries({ netCapacity: 20, trawlFuel: 0.1, trawlSpeed: 1.5 }))
    assert.ok(vehicleEditor(w, 30).includes(`name="${key}" type="number" value="${value}"`), key);
  act(w, p.id, {
    type: 'vehicleTuning',
    slot: 30,
    netCapacity: 40,
    trawlFuel: 0.02,
    trawlSpeed: 1.2,
  });
  for (const [key, value] of Object.entries({ netCapacity: 40, trawlFuel: 0.02, trawlSpeed: 1.2 }))
    assert.ok(vehicleEditor(w, 30).includes(`name="${key}" type="number" value="${value}"`), key);
});
