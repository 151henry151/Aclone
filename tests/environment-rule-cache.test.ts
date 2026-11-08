// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import defaults from '../data/settings.json';
import { calendarRules, calendarRuleFields } from '../src/shared/calendar-rules';
import { climateRules, climateRuleFields } from '../src/shared/climate-rules';

for (const [name, resolve, fields] of [
  ['calendar', calendarRules, calendarRuleFields],
  ['climate', climateRules, climateRuleFields],
] as const) {
  const read = resolve as (settings?: Record<string, number>) => Readonly<Record<string, number>>;
  test(`${name} repeated reads reuse a protected subset without retaining unrelated settings`, () => {
    const settings = { ...defaults, irrelevantForWeather: 123 } as Record<string, any>;
    const first = read(settings);
    assert.equal(
      read(settings),
      first,
      'unchanged world rules must not allocate another resolved object',
    );
    assert.equal(
      Object.isFrozen(first),
      true,
      'one caller cannot poison subsequent environment reads',
    );
    assert.deepEqual(Object.keys(first).sort(), Object.keys(fields).sort());
    settings.irrelevantForWeather++;
    assert.equal(read(settings), first);
    assert.equal(read(), read(), 'legacy/missing settings reuse canonical defaults');
    assert.deepEqual(read({}), first);
  });
  test(`${name} every live field edit and deletion takes effect without changing old results`, () => {
    const settings: Record<string, number> = {};
    for (const key of Object.keys(fields)) {
      const old = read(settings),
        before = { ...old };
      settings[key] = 0;
      const zero = read(settings);
      assert.equal(zero[key], 0, `${key}: retain zero`);
      assert.deepEqual(old, before, 'a previously read snapshot remains unchanged');
      assert.equal(read(settings), zero);
      settings[key] = 1;
      const one = read(settings);
      assert.equal(one[key], 1, `${key}: read in-place edit immediately`);
      assert.equal(zero[key], 0);
      delete settings[key];
      assert.equal(read(settings)[key], defaults[key as keyof typeof defaults]);
      const otherWorld = { [key]: 2 };
      assert.equal(read(otherWorld)[key], 2);
      assert.equal(read(settings)[key], defaults[key as keyof typeof defaults]);
      assert.equal(
        read({ ...otherWorld, [key]: 3 })[key],
        3,
        'replacement settings apply immediately',
      );
    }
  });
}
