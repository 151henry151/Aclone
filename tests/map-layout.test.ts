// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBounds, placeMapLabels } from '../src/client/map-layout.ts';
import { createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { resourceNodes } from '../src/shared/resources.ts';
import { legacyTown, townRoads } from '../src/shared/town.ts';

test('map bounds contain roads, gathering grounds, custom properties and the pilot in both layouts', () => {
  for (const layout of [1, 2] as const) {
    const w = createWorld('map-bounds', 'Map', 'owner');
    w.townLayout = layout;
    if (layout === 1)
      w.buildings = legacyTown.map((b, i) => makeBuilding(String(i), b.kind, b.x, b.z));
    w.buildings.push(makeBuilding('outlier', 'home', 1000, -800));
    const you = { x: -1500, z: 250 };
    const bounds = mapBounds(w, you);
    for (const p of [
      you,
      ...w.buildings,
      ...resourceNodes,
      ...townRoads(w).flatMap((r) => [r.a, r.b]),
    ]) {
      assert.ok(p.x >= bounds.x && p.x <= bounds.x + bounds.width);
      assert.ok(p.z >= bounds.z && p.z <= bounds.z + bounds.depth);
    }
  }
});
test('crowded map labels stay within the sheet and avoid each other deterministically', () => {
  const labels = Array.from({ length: 16 }, (_, i) => ({
    id: String(i),
    x: 310 + (i % 4) * 50,
    y: 230 + Math.floor(i / 4) * 50,
    width: 150,
  }));
  const result = placeMapLabels(labels, 900, 600);
  assert.deepEqual(result, placeMapLabels(labels, 900, 600));
  for (const [i, a] of result.entries()) {
    assert.ok(a.left >= 0 && a.top >= 0 && a.left + a.width <= 900 && a.top + a.height <= 600);
    for (const b of result.slice(i + 1))
      assert.ok(
        a.left + a.width <= b.left ||
          b.left + b.width <= a.left ||
          a.top + a.height <= b.top ||
          b.top + b.height <= a.top,
        `labels ${a.id} and ${b.id} overlap`,
      );
  }
});
