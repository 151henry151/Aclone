// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { alpineWeather, permanentSnowCover } from '../src/shared/alpine-weather';
import { worldWeather } from '../src/shared/environment';
import { defaultCreator } from '../src/shared/creator';
import { Store } from '../src/server/store';
const expected = {
  alpineSnowStart: 1180,
  alpineSnowFull: 1390,
  alpinePermanentSnow: true,
  alpineSnowBase: 0.018,
  alpineSnowIntensity: 0.06,
};
function fixture() {
  const w = createWorld('alpine-rules', 'Alpine', 'owner');
  addPlayer(w, 'owner', 'Owner');
  w.creator = defaultCreator();
  w.northernIsland = { version: 1 } as any;
  w.script = '';
  return w;
}
function patch(w: ReturnType<typeof fixture>, values: Record<string, number | boolean>) {
  act(w, 'owner', { type: 'settings', patch: values });
}
test('alpine defaults and legacy settings preserve four seasons across altitude and sea datum', () => {
  for (const legacy of [false, true]) {
    const w = fixture();
    for (const [key, value] of Object.entries(expected)) {
      assert.equal((w.settings as any)[key], value);
      if (legacy) delete (w.settings as any)[key];
    }
    const h = createHash('sha256');
    for (const sea of [-2, 300])
      for (const day of [10, 100, 190, 290])
        for (const mode of ['clear', 'rain', 'snow', 'thunderstorm', 'snowstorm'] as const)
          for (let height = 0; height <= 1800; height += 10) {
            w.settings.seaLevel = sea;
            w.creator!.weather = mode;
            h.update(
              JSON.stringify([
                permanentSnowCover(w, sea + height),
                alpineWeather(w, worldWeather(w, day), sea + height),
              ]),
            );
          }
    assert.equal(
      h.digest('hex'),
      'cde3152d3924b338617c40a12259cd1d73876360092cbab4a0841657f726e57d',
    );
  }
});
test('custom snow lines and disabled permanent cover preserve seasonal snow and island scope', () => {
  const w = fixture();
  w.climate = { snow: 0.7, snowDepth: 0.1, wetness: 0.5, snowModel: 1 };
  const before = structuredClone(w.climate);
  patch(w, { alpineSnowStart: 500, alpineSnowFull: 700 });
  assert.equal(permanentSnowCover(w, w.settings.seaLevel + 500), 0);
  assert.equal(permanentSnowCover(w, w.settings.seaLevel + 600), 0.5);
  assert.equal(permanentSnowCover(w, w.settings.seaLevel + 700), 1);
  const other = { ...w, northernIsland: undefined };
  assert.equal(permanentSnowCover(other, 5000), 0);
  w.creator!.weather = 'rain';
  const base = worldWeather(w, 190),
    snow = alpineWeather(w, base, 1500);
  patch(w, { alpinePermanentSnow: false });
  assert.equal(permanentSnowCover(w, 5000), 0);
  assert.deepEqual(alpineWeather(w, base, 1500), snow);
  assert.deepEqual(w.climate, before);
  assert.equal(alpineWeather(other, base, 5000), base);
});
test('alpine snowfall uses local base and intensity rates only for converted rain', () => {
  const w = fixture();
  w.creator!.weather = 'rain';
  const base = worldWeather(w, 190),
    old = alpineWeather(w, base, 1500);
  patch(w, { alpineSnowBase: 0.036, alpineSnowIntensity: 0.12 });
  const changed = alpineWeather(w, base, 1500);
  assert.equal(changed.snowfallPerDay, old.snowfallPerDay * 2);
  assert.equal(changed.temperature, old.temperature);
  assert.equal(changed.precipitation, 'snow');
  patch(w, { alpineSnowBase: 0, alpineSnowIntensity: 0 });
  assert.equal(alpineWeather(w, base, 1500).snowfallPerDay, 0);
  assert.equal(alpineWeather(w, base, 100), base);
  w.creator!.weather = 'snowstorm';
  const natural = worldWeather(w, 190);
  assert.equal(alpineWeather(w, natural, 1500).snowfallPerDay, natural.snowfallPerDay);
  w.creator!.weather = 'clear';
  assert.equal(alpineWeather(w, worldWeather(w, 190), 1500).precipitation, 'clear');
});
test('alpine controls validate atomically and persist through editor, summaries, observations, saves and designs', async () => {
  const w = fixture();
  for (const key of Object.keys(expected).filter((k) => k !== 'alpinePermanentSnow'))
    for (const value of [
      -1,
      NaN,
      Infinity,
      key.includes('SnowStart') || key.includes('SnowFull') ? 10001 : 11,
    ]) {
      const before = structuredClone(w.settings);
      assert.throws(() => patch(w, { [key]: value }));
      assert.deepEqual(w.settings, before);
    }
  for (const values of [
    { alpineSnowStart: 1400, alpineSnowFull: 1400 },
    { alpineSnowStart: 1500, alpineSnowFull: 1400 },
  ])
    assert.throws(() => patch(w, values), /snow/i);
  assert.throws(() => patch(w, { alpinePermanentSnow: 1 }));
  const custom = {
    alpineSnowStart: 600,
    alpineSnowFull: 900,
    alpinePermanentSnow: false,
    alpineSnowBase: 0.04,
    alpineSnowIntensity: 0.08,
  };
  for (const key of Object.keys(expected)) delete (w.settings as any)[key];
  patch(w, custom);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  // This test's minimal island flag is sufficient for climate but is not a portable terrain definition.
  w.northernIsland = undefined;
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
      assert.equal((dest.settings as any)[key], value);
      assert.equal((loaded.settings as any)[key], value);
      assert.equal((obs.worldRules as any)[key], value);
    }
    assert.match(rulesSummary(w), /600.*900/);
    assert.match(rulesSummary(w), /0\.04.*0\.08/);
    const bad = structuredClone(exportDesign(w));
    (bad.settings as any).alpineSnowFull = 500;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, bad), /snow/i);
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});

test('the permanent snow checkbox reflects both default on and saved off', async () => {
  const { settingsFields } = await import('../src/client/creator-editor');
  const w = fixture();
  const input = () =>
    settingsFields(w.settings).match(/<input[^>]*name="alpinePermanentSnow"[^>]*>/)![0];
  assert.match(input(), /\bchecked\b/);
  patch(w, { alpinePermanentSnow: false });
  assert.doesNotMatch(input(), /\bchecked\b/);
});
