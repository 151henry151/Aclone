// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { celestialAt, lunarElongation } from '../src/shared/astronomy';
import { tideOffset, waterLevel, oceanDate } from '../src/shared/ocean';
import { Store } from '../src/server/store';
function fixture() {
  const w = createWorld('lunar-rules', 'Lunar', 'owner');
  addPlayer(w, 'owner', 'Owner');
  w.script = '';
  return w;
}
function patch(w: ReturnType<typeof fixture>, value: number) {
  act(w, 'owner', { type: 'settings', patch: { calendarLunarDays: value } });
}
test('lunar default and missing-key sky and tides reproduce the frozen two-year sequence', () => {
  const w = fixture();
  assert.equal((w.settings as any).calendarLunarDays, 28);
  for (const rules of [w.settings, {}]) {
    const h = createHash('sha256');
    for (let d = 0; d < 730; d += 0.5)
      for (const seconds of [0, 21600, 64800])
        h.update(
          JSON.stringify([
            celestialAt(d, seconds, rules),
            lunarElongation(d, rules),
            tideOffset(d, 2, rules),
          ]),
        );
    assert.equal(
      h.digest('hex'),
      'c3fe86c73bea19161f51f7be6fe213ae582f1f514bd2a725cc11919e20c9b477',
    );
  }
});
test('custom lunar periods drive sky phases and actual tides without changing sun, range or saved time', () => {
  const w = fixture();
  w.settings.tidalRange = 2;
  w.time = 15000;
  const before = structuredClone(w);
  const date = oceanDate(w.time),
    old = celestialAt(date, 0),
    level = waterLevel(w);
  patch(w, 14);
  assert.equal(w.time, before.time);
  assert.equal(w.settings.tidalRange, 2);
  const changed = celestialAt(date, 0, w.settings);
  assert.deepEqual(changed.sun, old.sun);
  assert.deepEqual(changed.skyRotation, old.skyRotation);
  assert.notDeepEqual(changed.moons, old.moons);
  assert.ok(
    Math.abs(
      lunarElongation(date + 14, w.settings) - lunarElongation(date, w.settings) - 2 * Math.PI,
    ) < 1e-12,
  );
  const expected = w.settings.seaLevel + tideOffset(date, 2, w.settings);
  assert.equal(waterLevel(w), expected);
  assert.notEqual(expected, level);
  for (let d = 0; d < 50; d += 0.17) {
    assert.ok(Math.abs(tideOffset(d, 2, w.settings)) <= 1);
    assert.equal(tideOffset(d, 0, w.settings), 0);
  }
  for (const period of [1, 7.5, 3650]) {
    patch(w, period);
    assert.ok(
      Math.abs(
        lunarElongation(date + period, w.settings) -
          lunarElongation(date, w.settings) -
          2 * Math.PI,
      ) < 1e-10,
    );
  }
  const a = celestialAt(364, 86399.99, w.settings),
    b = celestialAt(365, 0, w.settings);
  assert.ok(
    a.moons[0].direction.reduce((s, v, i) => s + v * b.moons[0].direction[i], 0) > 0.999999,
  );
  assert.ok(
    Math.abs(tideOffset(365 - 1e-6, 2, w.settings) - tideOffset(365 + 1e-6, 2, w.settings)) < 0.001,
  );
});
test('lunar settings validate atomically and round trip through editor, summary, observations, saves and designs', async () => {
  const w = fixture();
  for (const value of [0, -1, NaN, Infinity, 3650.1]) {
    const before = structuredClone(w.settings);
    assert.throws(() => patch(w, value));
    assert.deepEqual(w.settings, before);
  }
  delete (w.settings as any).calendarLunarDays;
  patch(w, 14.5);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  assert.match(settingsFields(w.settings), /name="calendarLunarDays"[^>]*value="14.5"/);
  assert.match(rulesSummary(w), /14\.5/);
  const dest = createWorld('dest', 'Destination', 'other');
  applyDesign(dest, exportDesign(w));
  assert.equal((dest.settings as any).calendarLunarDays, 14.5);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal((store.loadWorlds()[0].world.settings as any).calendarLunarDays, 14.5);
    assert.equal(
      (
        observe(w, w.players.owner, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident')
          .worldRules as any
      ).calendarLunarDays,
      14.5,
    );
    const bad = structuredClone(exportDesign(w));
    (bad.settings as any).calendarLunarDays = 0;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, bad));
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});
