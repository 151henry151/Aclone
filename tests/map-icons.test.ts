// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildings } from '../src/shared/catalog.ts';
import { mapIcon, buildingMapIcons, aircraftHangarIcon } from '../src/client/map-icons.ts';

test('every catalogue building has its own explicit map symbol', () => {
  for (const kind of Object.keys(buildings)) {
    assert.ok(Object.hasOwn(buildingMapIcons, kind), `Missing icon for ${kind}`);
    assert.equal(mapIcon(kind), buildingMapIcons[kind]);
  }
  assert.equal(new Set(Object.values(buildingMapIcons)).size, Object.keys(buildingMapIcons).length);
});
test('aircraft hangars override the garage symbol, while spaceports and unknown types stay distinct', () => {
  assert.equal(mapIcon('garage', { aircraftHangar: true }), aircraftHangarIcon);
  assert.equal(mapIcon('garage', { aircraftHangar: false }), buildingMapIcons.garage);
  assert.notEqual(mapIcon('starport'), mapIcon('factory'));
  assert.notEqual(mapIcon('custom-building'), mapIcon('factory'));
  assert.equal(mapIcon('custom-building'), mapIcon('another-custom-building'));
});
test('gathering grounds and sports landmarks have dedicated symbols', () => {
  const kinds = ['Wood / logs', 'stone', 'gravel', 'Dirt', 'Playing field', 'Race checkpoints'];
  assert.equal(new Set(kinds.map((k) => mapIcon(k))).size, kinds.length);
  for (const kind of kinds) assert.notEqual(mapIcon(kind), mapIcon('unknown'));
});
