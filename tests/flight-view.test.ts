// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewFog } from '../src/client/view-distance';
import { horizonGeometry } from '../src/client/horizon-land';
import { createWorld, makeBuilding } from '../src/shared/simulation';

test('airborne fog hides unfinished horizon terrain while ground and marine visibility stay unchanged', () => {
  const clear = { precipitation: 'clear', storm: false };
  const afloat = viewFog(clear);
  const flight = viewFog(clear, true);
  assert.equal(afloat.far, 45000);
  assert.ok(flight.far <= 2000, 'airborne clear fog must cover the coarse distant silhouette');
  assert.ok(flight.near >= 300, 'nearby landing ground remains readable');
  const storm = viewFog({ precipitation: 'rain', storm: true }, true);
  assert.ok(storm.far <= flight.far, 'storms cannot extend the flight view');
});

test('a distant town does not get a separate horizon mesh-density pad', () => {
  const w = createWorld('island', 'Island', 'server');
  w.settings.mapSize = 2500;
  w.buildings = [];
  const mesh = () => {
    const job = horizonGeometry(w);
    let step = job.next();
    while (!step.done) step = job.next();
    return step.value;
  };
  const empty = mesh();
  w.buildings = [makeBuilding('town', 'town', 576, 576)];
  const town = mesh();
  const xz = (g: typeof town) => {
    const p = g.attributes.position;
    return Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getZ(i)]);
  };
  assert.deepEqual(xz(town), xz(empty), 'town must use the surrounding horizon resolution');
  empty.dispose();
  town.dispose();
});
