// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation';
import { crops, cropStatus } from '../src/shared/farming';
import { farmYieldRuleFields } from '../src/shared/farm-yield-rules';
import { creatorSchema } from '../src/shared/creator';
import { calendar, worldWeather } from '../src/shared/environment';
import { gameplayChoices, farmDuty } from '../src/server/npc/farmer';
import { Store } from '../src/server/store';
const thirst = {
  wheat: 0.5,
  potatoes: 0.4,
  hops: 0.7,
  grapes: 0.5,
  tea: 0.8,
  coffee: 0.7,
  hay: 0.35,
};
const custom = {
  farmIrrigationBaseline: 0.1,
  farmIrrigationRain: 0.2,
  farmIrrigationTreatment: 0.3,
  farmIrrigationCap: 0.8,
  farmIrrigationDryYield: 0.2,
  farmIrrigationMoistureYield: 0.5,
  farmIrrigationWaterCost: 2,
  farmIrrigationTreatments: 4,
  farmWheatThirst: 1,
  farmPotatoesThirst: 1.1,
  farmHopsThirst: 1.2,
  farmGrapesThirst: 1.3,
  farmTeaThirst: 1.4,
  farmCoffeeThirst: 1.5,
  farmHayThirst: 1.6,
};
function setup() {
  const w = createWorld('irrigation', 'Irrigation', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = w.buildings.find((b) => b.kind === 'farm')!;
  w.creator = creatorSchema.parse({ weather: 'clear' });
  w.settings.hungerRate = w.settings.thirstRate = 0;
  b.owner = p.id;
  b.investment = 100000;
  b.stock = { water: 1 };
  b.plots = Array.from({ length: 4 }, () => ({
    crop: 'wheat',
    planted: w.time,
    ready: w.time + 10800,
    water: 0,
    fertilized: false,
    drainage: true,
  }));
  Object.assign(p, { x: b.x, z: b.z, skills: ['farmer'], inventory: { water: 2 }, cash: 1000000 });
  return { w, p, b };
}
test('irrigation defaults and legacy worlds retain every crop formula across weather and treatments', () => {
  let rainy = false;
  for (const missing of [false, true])
    for (const clear of [false, true]) {
      const { w, b } = setup();
      if (missing) for (const key of Object.keys(custom)) delete (w.settings as any)[key];
      if (!clear) w.creator = creatorSchema.parse({ weather: 'rain' });
      for (const [crop, demand] of Object.entries(thirst))
        for (const water of [0, 1, 3]) {
          const plot = b.plots![0],
            c = crops[crop];
          Object.assign(plot, { crop, water });
          const first = calendar({ time: plot.planted }).absoluteDay;
          let rain = 0,
            frost = 0;
          for (let day = 0; day < c.days; day++) {
            const v = worldWeather(w, first + day, 0.5);
            rain += v.precipitation === 'rain' ? 1 : 0;
            frost += v.temperature < 0 ? 1 : 0;
          }
          rainy ||= rain > 0;
          const moisture = Math.min(1, ((rain / c.days) * 0.9 + 0.25 + water * 0.25) / demand);
          assert.equal(cropStatus(w, b, 0).water, moisture);
          assert.equal(
            cropStatus(w, b, 0).yield,
            Math.max(
              1,
              Math.floor(
                c.yield * (0.6 + 0.4 * moisture) * Math.max(0.35, 1 - (frost / c.days) * c.frost),
              ),
            ),
          );
        }
    }
  assert.ok(rainy, 'fixture exercises rainy weather');
});
test('custom formula and every crop thirst affect estimates without changing reserved harvests', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch: custom });
  for (const [crop] of Object.entries(thirst)) {
    const key = `farm${crop[0].toUpperCase() + crop.slice(1)}Thirst` as keyof typeof custom;
    Object.assign(b.plots![0], { crop, water: 1 });
    const moisture = Math.min(0.8, 0.4 / custom[key]);
    assert.equal(cropStatus(w, b, 0).water, moisture);
    assert.equal(cropStatus(w, b, 0).yield, Math.floor(crops[crop].yield * (0.2 + 0.5 * moisture)));
  }
  Object.assign(b.plots![0], { crop: 'wheat', water: 1 });
  w.creator = creatorSchema.parse({ weather: 'rain' });
  assert.equal(cropStatus(w, b, 0).water, 0.2 + 0.1 + 0.3);
  assert.equal(cropStatus(w, b, 0).yield, 30);
  w.creator = creatorSchema.parse({ weather: 'clear' });
  Object.assign(b.plots![0], { crop: 'wheat', water: 4, ready: w.time });
  assert.equal(cropStatus(w, b, 0).water, 0.8);
  assert.equal(cropStatus(w, b, 0).yield, 36);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  act(w, p.id, { type: 'settings', patch: { farmIrrigationCap: 0 } });
  advance(w, 15);
  assert.equal(b.stock.wheat, 36);
});
test('watering follows cost and limits with real stock first, zero settings and atomic refusals', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch: custom });
  const water = () => act(w, p.id, { type: 'farm', building: b.id, operation: 'water', plot: 0 });
  water();
  assert.equal(b.stock.water, 0);
  assert.equal(p.inventory.water, 1);
  assert.equal(b.plots![0].water, 1);
  const reject = (pattern: RegExp) => {
    const before = JSON.stringify(w);
    assert.throws(water, pattern);
    assert.equal(JSON.stringify(w), before);
  };
  reject(/2 water/);
  act(w, p.id, { type: 'settings', patch: { farmIrrigationWaterCost: 0 } });
  water();
  water();
  water();
  assert.equal(b.plots![0].water, 4);
  reject(/enough irrigation/);
  act(w, p.id, { type: 'settings', patch: { farmIrrigationTreatments: 0 } });
  assert.equal(b.plots![0].water, 4);
  reject(/enough irrigation/);
  b.plots![0].ready = w.time;
  reject(/already ripe/);
  delete b.plots![0].crop;
  reject(/empty/);
});
test('both resident farm planners use custom irrigation costs and caps while reserving drinking water', () => {
  const { w, p, b } = setup();
  w.buildings = [b];
  const state = { plan: [], index: 0 } as any;
  const waters = (plan: any[]) =>
    plan.some(
      (s) => s.kind === 'act' && s.action.type === 'farm' && s.action.operation === 'water',
    );
  const offered = () => gameplayChoices(w, p, state, 'farmer').filter((c) => waters(c.plan));
  act(w, p.id, { type: 'settings', patch: custom });
  b.plots!.forEach((plot) => (plot.water = 3));
  b.stock.water = 2;
  p.inventory = { water: 0 };
  assert.ok(offered().some((c) => c.description.includes('uses 2 water')));
  assert.ok(waters(farmDuty(w, p, b, state)));
  b.stock.water = 0;
  p.inventory = { water: 1 };
  assert.equal(offered().length, 0);
  assert.ok(!waters(farmDuty(w, p, b, state)));
  act(w, p.id, { type: 'settings', patch: { farmIrrigationWaterCost: 0 } });
  assert.ok(offered().length);
  assert.ok(waters(farmDuty(w, p, b, state)));
  act(w, p.id, { type: 'settings', patch: { farmIrrigationTreatments: 0 } });
  assert.equal(offered().length, 0);
  assert.ok(!waters(farmDuty(w, p, b, state)));
});
test('irrigation values validate and round trip in editor summary observations saves and designs', async () => {
  const { w, p } = setup();
  for (const [key, value] of Object.entries(custom)) {
    assert.ok(Object.hasOwn(w.settings, key), key);
    const field = (farmYieldRuleFields as any)[key];
    assert.ok(field, key);
    for (const bad of [
      -1,
      field.max + 1,
      Infinity,
      NaN,
      ...(key.endsWith('Thirst') ? [0] : []),
      ...(field.step === 1 ? [0.5] : []),
    ]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { farmCompostYieldBonus: 0.9, [key]: bad } }),
      );
      assert.equal(JSON.stringify(w), before);
    }
    assert.ok(value >= field.min);
  }
  act(w, p.id, { type: 'settings', patch: custom });
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
    for (const [k, v] of Object.entries(custom)) {
      assert.ok(settingsFields().includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(String(v)));
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((obs.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

test('farm action visibility follows limits above and below three and disabled watering', async () => {
  const { actionVisible } = await import('../src/client/action-visibility');
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch: { farmIrrigationTreatments: 4 } });
  b.plots![0].water = 3;
  assert.equal(actionVisible(w, p, 'farm', 'water', b, 0), true);
  b.plots![0].water = 4;
  assert.equal(actionVisible(w, p, 'farm', 'water', b, 0), false);
  act(w, p.id, { type: 'settings', patch: { farmIrrigationTreatments: 0 } });
  b.plots![0].water = 0;
  assert.equal(actionVisible(w, p, 'farm', 'water', b, 0), false);
});
