// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { weatherAt, worldWeather, advanceClimate, DAY_SECONDS } from '../src/shared/environment';
import { defaults } from '../src/shared/catalog';
import { defaultCreator } from '../src/shared/creator';
import { Store } from '../src/server/store';
const expected = {
  climateSpringWetChance: 0.64,
  climateSummerWetChance: 0.64,
  climateAutumnWetChance: 0.9,
  climateWinterWetMin: 0.25,
  climateWinterWetMax: 0.75,
  climateStormThreshold: 1.1,
  climateBlizzardChance: 0.028,
  climateSnowPerStrength: 0.018,
  climateBlizzardSnow: 0.15,
  climateForcedSnow: 0.12,
  climateForcedSnowstorm: 0.48,
};
const chances = Object.keys(expected).filter((k) => /Wet/.test(k));
function fixture() {
  const w = createWorld('climate-a', 'Climate', 'owner');
  addPlayer(w, 'owner', 'Owner');
  w.creator = defaultCreator();
  w.script = '';
  return w;
}
function patch(w: ReturnType<typeof fixture>, values: Record<string, number>) {
  act(w, 'owner', { type: 'settings', patch: values });
}
const readings = (settings: any, days = 365) =>
  Array.from({ length: days }, (_, day) => weatherAt('climate-a', day, 0.5, settings));
test('climate defaults and missing keys reproduce the frozen three-year weather sequence', () => {
  const w = fixture();
  for (const [key, value] of Object.entries(expected))
    assert.equal((w.settings as any)[key], value, key);
  for (const settings of [w.settings, {}]) {
    const h = createHash('sha256');
    for (const id of ['climate-a', 'climate-b', 'puddlewick'])
      for (let day = 0; day < 1095; day++)
        for (const f of [0.1, 0.5, 0.9]) h.update(JSON.stringify(weatherAt(id, day, f, settings)));
    assert.equal(
      h.digest('hex'),
      'bb12b70eccd747f3ac869c3935b03fa72ffa8b2176294f11e9f20e90d1ae210a',
    );
  }
});
test('seasonal probabilities honour zero and one without changing other seasons or event timing', () => {
  const w = fixture(),
    original = readings(w.settings);
  for (const [key, season] of [
    ['climateSpringWetChance', 'Spring'],
    ['climateSummerWetChance', 'Summer'],
    ['climateAutumnWetChance', 'Autumn'],
  ] as const) {
    patch(w, { ...expected, [key]: 0 });
    readings(w.settings).forEach((v, i) => {
      if (v.season === season) assert.equal(v.precipitation, 'clear');
      else assert.deepEqual(v, original[i]);
    });
    patch(w, { [key]: 1 });
    const wet = readings(w.settings);
    assert.ok(
      wet.filter((v) => v.season === season && v.precipitation !== 'clear').length >
        original.filter((v) => v.season === season && v.precipitation !== 'clear').length,
    );
  }
  patch(w, Object.fromEntries(chances.map((k) => [k, 0])));
  assert.ok(readings(w.settings, 1095).every((v) => v.precipitation === 'clear'));
  patch(w, Object.fromEntries(chances.map((k) => [k, 1])));
  assert.ok(readings(w.settings, 1095).some((v) => v.precipitation === 'snow'));
  assert.ok(readings(w.settings, 1095).some((v) => v.precipitation === 'rain'));
  assert.ok(
    readings(w.settings, 1095).some((v) => v.precipitation === 'clear'),
    'probability one retains gaps between weather events',
  );
});
test('storm threshold and winter blizzard chance alter intensity but preserve occurrence', () => {
  const w = fixture();
  patch(w, {
    ...Object.fromEntries(chances.map((k) => [k, 1])),
    climateStormThreshold: 0,
    climateBlizzardChance: 0,
  });
  const strong = readings(w.settings, 1095);
  assert.ok(strong.filter((v) => v.precipitation !== 'clear').every((v) => v.storm));
  patch(w, { climateStormThreshold: 10 });
  const calm = readings(w.settings, 1095);
  calm.forEach((v, i) => {
    assert.equal(v.precipitation, strong[i].precipitation);
    if (v.season === 'Summer') assert.equal(v.storm, false);
  });
  patch(w, { climateBlizzardChance: 1 });
  const blizzards = readings(w.settings, 1095);
  assert.ok(
    blizzards.some((v, i) => v.season === 'Winter' && v.snowfallPerDay > calm[i].snowfallPerDay),
  );
  blizzards.forEach((v, i) => {
    assert.equal(v.precipitation, calm[i].precipitation);
    if (v.precipitation === 'snow') assert.equal(v.storm, true);
  });
});
test('snow rates honour zero, scaling and forced modes without rewriting saved snow', () => {
  const w = fixture(),
    old = readings(w.settings, 1095);
  w.climate = { snow: 1, snowDepth: 0.3, wetness: 0.7, winterBase: 0.04, snowModel: 1 };
  const saved = structuredClone(w.climate);
  patch(w, { climateSnowPerStrength: 0.036, climateBlizzardSnow: 0.3 });
  assert.deepEqual(w.climate, saved);
  readings(w.settings, 1095).forEach((v, i) =>
    assert.equal(v.snowfallPerDay, old[i].snowfallPerDay * 2),
  );
  patch(w, { climateSnowPerStrength: 0, climateBlizzardSnow: 0 });
  assert.ok(readings(w.settings, 1095).every((v) => v.snowfallPerDay === 0));
  patch(w, { climateForcedSnow: 0.24, climateForcedSnowstorm: 0.96 });
  for (const [mode, rate] of [
    ['snow', 0.24],
    ['snowstorm', 0.96],
  ] as const) {
    w.creator!.weather = mode;
    assert.equal(worldWeather(w, 370).snowfallPerDay, rate);
  }
  const start = (370 - 59 - defaults.time / 86400) * DAY_SECONDS;
  w.time = start;
  w.settings.dayLength = 0;
  w.climate = { snow: 0, snowDepth: 0, wetness: 0, snowModel: 1 };
  const split = structuredClone(w);
  advanceClimate(w, start, start + DAY_SECONDS);
  for (let i = 0; i < 60; i++) advanceClimate(split, start + i * 10, start + (i + 1) * 10);
  assert.ok(Math.abs(w.climate.snowDepth! - 0.96) < 1e-9);
  assert.ok(Math.abs(split.climate!.snowDepth! - w.climate.snowDepth!) < 1e-9);
  assert.ok(Math.abs(split.climate!.wetness - w.climate.wetness) < 1e-9);
  const kept = structuredClone(w.climate);
  patch(w, { climateForcedSnowstorm: 0 });
  assert.deepEqual(w.climate, kept);
  advanceClimate(w, start + DAY_SECONDS, start + 2 * DAY_SECONDS);
  assert.equal(w.climate.snowDepth, kept.snowDepth);
});
test('climate edits validate atomically and survive creation, editor, summary, observations, designs and reload', async () => {
  const w = fixture();
  for (const [key, value] of Object.entries(expected)) {
    for (const invalid of [-1, NaN, Infinity, ...(/Chance|Wet/.test(key) ? [1.01] : [11])]) {
      const before = structuredClone(w.settings);
      assert.throws(() => patch(w, { climateSpringWetChance: 0.5, [key]: invalid }));
      assert.deepEqual(w.settings, before);
    }
  }
  assert.throws(() => patch(w, { climateWinterWetMin: 0.8, climateWinterWetMax: 0.2 }), /winter/i);
  const custom = {
    climateSpringWetChance: 0.41,
    climateSummerWetChance: 0.42,
    climateAutumnWetChance: 0.43,
    climateWinterWetMin: 0.44,
    climateWinterWetMax: 0.45,
    climateStormThreshold: 2.1,
    climateBlizzardChance: 0.2,
    climateSnowPerStrength: 0.04,
    climateBlizzardSnow: 0.4,
    climateForcedSnow: 0.3,
    climateForcedSnowstorm: 0.8,
  };
  for (const key of Object.keys(expected)) delete (w.settings as any)[key];
  patch(w, custom);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const dest = createWorld('dest', 'Destination', 'other');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      obs = observe(
        w,
        w.players.owner,
        { plan: [], index: 0 } as any,
        new NpcMemory(store),
        'resident',
      );
    for (const [key, value] of Object.entries(custom)) {
      assert.ok(settingsFields(w.settings).includes(`name="${key}"`));
      assert.ok(rulesSummary(w).includes(String(value)));
      assert.equal((dest.settings as any)[key], value);
      assert.equal((loaded.settings as any)[key], value);
      assert.equal((obs.worldRules as any)[key], value);
    }
    const exported = exportDesign(w);
    (exported.settings as any).climateWinterWetMin = 0.9;
    (exported.settings as any).climateWinterWetMax = 0.1;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, exported), /winter/i);
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});
