// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapBounds,
  localBounds,
  placeMapLabels,
  townBorders,
  wheelZoom,
  worldZoom,
  outerSheet,
  mapStep,
} from '../src/client/map-layout.ts';
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

test('town borders appear on any sheet they overlap', () => {
  const w = createWorld('map-towns', 'Map', 'owner');
  const town = w.towns[0];
  w.towns.push({ ...structuredClone(town), id: 'far', name: 'Far', x: 4000, z: 4000, radius: 150 });
  const sheet = localBounds({ x: town.x + town.radius + 100, z: town.z }, 200);
  assert.deepEqual(
    townBorders(w, sheet).map((t) => t.name),
    ['Puddlewick'],
  );
  assert.deepEqual(townBorders(w, localBounds({ x: 0, z: 9000 }, 100)), []);
  assert.deepEqual(townBorders(w, localBounds({ x: 4000, z: 4000 }, 100))[0], {
    id: 'far',
    name: 'Far',
    x: 4000,
    z: 4000,
    radius: 150,
  });
});

test('wheel zoom scales smoothly by scroll distance and stays within the map limits', () => {
  assert.ok(wheelZoom(1, -100) > 1);
  assert.ok(wheelZoom(2, 100) < 2);
  assert.ok(Math.abs(wheelZoom(wheelZoom(1.5, -120), 120) - 1.5) < 1e-9);
  assert.equal(wheelZoom(1, 5000), 1);
  assert.equal(wheelZoom(2.9, -5000), 3);
  // Line-mode wheels (Firefox) scroll in lines rather than pixels.
  assert.equal(wheelZoom(1, -3, 1), wheelZoom(1, -48));
});

test('zooming out widens the sheet until the whole map fits the window', () => {
  // At 1 px/m a 900×600 window fits a 12.5 km map at 600/12,500 of the base zoom.
  assert.equal(worldZoom(1, 900, 600, 6250), 600 / 12500);
  // Compact maps already fit at 100%.
  assert.equal(worldZoom(1.2, 900, 600, 250), 1);
  // A sheet is centred on the requested point while it fits inside the map...
  assert.deepEqual(outerSheet({ x: 100, z: -200 }, 0.5, 1000, 800, 6250), {
    x: -900,
    z: -1000,
    width: 2000,
    depth: 1600,
  });
  // ...is kept inside the map near its edge...
  assert.equal(outerSheet({ x: 6200, z: 0 }, 0.5, 1000, 800, 6250).x, 6250 - 2000);
  // ...and is centred on the map when it is larger than the map.
  assert.deepEqual(outerSheet({ x: 3000, z: 3000 }, 0.05, 1000, 800, 6250), {
    x: -10000,
    z: -8000,
    width: 20000,
    depth: 16000,
  });
});

test('grid and scale bar pick readable round distances', () => {
  assert.equal(mapStep(1), 50);
  assert.equal(mapStep(0.5), 100);
  assert.equal(mapStep(0.1), 500);
  assert.equal(mapStep(0.03), 2000);
  assert.equal(mapStep(0.01), 5000);
});
