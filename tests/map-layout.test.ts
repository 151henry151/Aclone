// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBounds, localBounds, placeMapLabels } from '../src/client/map-layout.ts';
import { createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { resourceNodes } from '../src/shared/resources.ts';
import { legacyTown, townRoads } from '../src/shared/town.ts';

test('map bounds contain roads, gathering grounds, custom properties and the pilot in both layouts', () => {
  for (const layout of [1, 2] as const) {
    const w = createWorld('map-bounds', 'Map', 'owner');
    // Compact worlds fit everything on one sheet, wherever the pilot has got to.
    w.settings.mapSize = 500;
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
test('on a large map the parish sheet stays readable and a local sheet follows a distant pilot', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.buildings.push(makeBuilding('farmstead', 'home', 3000, -2200));
  const home = mapBounds(w, { x: 40, z: 60 });
  assert.ok(home.width < 900 && home.depth < 900, `${home.width} x ${home.depth}`);
  for (const p of [...legacyTown, ...resourceNodes, { x: 40, z: 60 }]) {
    assert.ok(p.x >= home.x && p.x <= home.x + home.width, `${p.x} inside`);
    assert.ok(p.z >= home.z && p.z <= home.z + home.depth, `${p.z} inside`);
  }
  // A pilot far out in the countryside does not stretch the parish sheet to 6 km.
  const away = mapBounds(w, { x: 3000, z: -2200 });
  assert.deepEqual(away, mapBounds(w, { x: -3000, z: 2200 }));
  assert.ok(away.width < 900);
  const local = localBounds({ x: 3000, z: -2200 });
  assert.ok(local.x < 3000 - 250 && local.x + local.width > 3000 + 250);
  assert.ok(local.z < -2200 - 250 && local.z + local.depth > -2200 + 250);
  assert.ok(local.width <= 800 && local.depth <= 800);
});
