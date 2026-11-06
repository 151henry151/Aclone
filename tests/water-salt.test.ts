// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { waterworksSite } from '../src/shared/shoreline';
test('new desalination rejects an enclosed edited pond while the legacy height survey still accepts it', () => {
  const w = createWorld('shore', 'Shore', 'owner');
  w.buildings = [];
  Object.assign(w.settings, { seaLevel: -2, tidalRange: 0 });
  w.terrain = [{ x: 0, z: 0, radius: 12, height: -10 }];
  const p = { x: 15, z: 0 };
  assert.ok(waterworksSite(w, p), 'legacy production still has water');
  assert.equal(waterworksSite(w, p, undefined, true), undefined, 'an enclosed pond is not ocean');
  w.settings.desalinationRequiresOcean = false;
  assert.ok(waterworksSite(w, p, undefined, true), 'creator may retain the height-only rule');
});

import { oceanConnected } from '../src/shared/ocean-connection';
test('ocean connectivity follows a winding wet inlet and invalidates after terrain edits', () => {
  const w = createWorld('inlet', 'Inlet', 'owner');
  w.buildings = [];
  Object.assign(w.settings, { mapSize: 512, seaLevel: 0, tidalRange: 0 });
  w.terrainMapSize = 512;
  const h = Array(1089).fill(20);
  for (let z = 15; z <= 23; z++) for (let x = 15; x <= 17; x++) h[z * 33 + x] = -10;
  for (let z = 21; z <= 23; z++) for (let x = 15; x < 33; x++) h[z * 33 + x] = -10;
  w.landscape = { paths: [], surfaces: [], barriers: [], scatter: [], heightmap: h };
  assert.equal(oceanConnected(w, { x: 0, z: 0 }), true);
  w.terrain.push({ x: 192, z: 96, radius: 70, height: 100 });
  w.revision++;
  assert.equal(oceanConnected(w, { x: 0, z: 0 }), false);
});

import { makeBuilding, advance, productionInterval } from '../src/shared/simulation';
import { prepareWaterSources } from '../src/shared/springs';
import { waterProductionBlocker } from '../src/shared/fresh-water';
import { productionReport } from '../src/shared/reports';
test('the versioned migration preserves an old pond plant and only new plants require ocean', () => {
  const w = createWorld('grandfather-water', 'Pond plant', 'owner');
  w.buildings = [];
  Object.assign(w.settings, { seaLevel: -2, tidalRange: 0, hungerRate: 0, thirstRate: 0 });
  w.terrain = [{ x: 0, z: 0, radius: 12, height: -10 }];
  const b = makeBuilding('old-plant', 'waterworks', 15, 0);
  b.rotation = waterworksSite(w, b)!.rotation;
  b.government = true;
  b.stock = { fuel: 2 };
  b.investment = 55000;
  b.owner = 'original-owner';
  w.buildings = [b];
  const saved = structuredClone(b);
  prepareWaterSources(w);
  assert.deepEqual(
    { ...b, legacyWaterIntake: undefined },
    { ...saved, legacyWaterIntake: undefined },
  );
  assert.equal(waterProductionBlocker(w, b), undefined);
  advance(w, productionInterval(w, b));
  assert.equal(b.stock.water, 12);
  assert.equal(b.stock.fuel, 1);
  assert.equal(b.owner, 'original-owner');
  const newPlant = { ...b, id: 'new-plant', legacyWaterIntake: undefined };
  assert.match(waterProductionBlocker(w, newPlant) ?? '', /sea water/);
  assert.match(JSON.stringify(productionReport(w, newPlant)), /sea water/);
  w.settings.desalinationRequiresOcean = false;
  assert.equal(waterProductionBlocker(w, newPlant), undefined);
});

import { act, addPlayer } from '../src/shared/simulation';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { waterSourceRules } from '../src/shared/water-source-rules';
test('desalination depth, freeboard and rear reach are editable portable world rules', () => {
  const w = createWorld('shore', 'Shore', 'owner'),
    p = addPlayer(w, 'owner', 'Builder');
  const site = { x: 0, z: 144 };
  assert.ok(waterworksSite(w, site, undefined, true));
  act(w, p.id, { type: 'settings', patch: { desalinationIntakeDepth: 10 } });
  assert.equal(waterworksSite(w, site, undefined, true), undefined);
  act(w, p.id, {
    type: 'settings',
    patch: { desalinationIntakeDepth: 0.3, desalinationFreeboard: 3 },
  });
  assert.equal(waterworksSite(w, site, undefined, true), undefined);
  act(w, p.id, {
    type: 'settings',
    patch: {
      desalinationFreeboard: 0.2,
      desalinationIntakeMinReach: 1,
      desalinationIntakeMaxReach: 1,
    },
  });
  assert.equal(waterworksSite(w, site, undefined, true), undefined);
  act(w, p.id, {
    type: 'settings',
    patch: { desalinationIntakeMinReach: 6, desalinationIntakeMaxReach: 10 },
  });
  assert.ok(waterworksSite(w, site, undefined, true));
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'settings', patch: { desalinationIntakeMinReach: 15 } }),
    /reach/i,
  );
  assert.equal(JSON.stringify(w), before);
  act(w, p.id, {
    type: 'settings',
    patch: {
      desalinationIntakeDepth: 0.4,
      desalinationFreeboard: 0.5,
      desalinationIntakeMinReach: 7,
      desalinationIntakeMaxReach: 11,
    },
  });
  const copy = createWorld('copy-shore', 'Copy', 'owner');
  applyDesign(copy, exportDesign(w));
  assert.deepEqual(waterSourceRules(copy.settings), waterSourceRules(w.settings));
});
