// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation';
import { trailerPanel } from '../src/client/trailer-panel';
import { garageStoragePanel } from '../src/client/garage-storage-panel';
import { tractorShopHtml } from '../src/client/tractor-shop';
const setup = () => {
  const w = createWorld('fleet', 'Fleet', 'p'),
    p = addPlayer(w, 'p', 'Pilot'),
    b = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [b];
  w.trailers = {
    one: { id: 'one', owner: p.id, kind: 'dump', x: 0, z: 0, heading: 0, cargo: { dirt: 9 } },
  };
  return { w, p, b };
};
test('owned trailers and specialist catalogue start collapsed with counts at every venue', () => {
  const { w, p, b } = setup();
  for (const venue of [undefined, b, { ...b, aircraftHangar: true }]) {
    const html = trailerPanel(w, p, venue);
    assert.match(
      html,
      /<details data-fleet-disclosure="owned-trailers"><summary>Your trailers \(1\)<\/summary>/,
    );
    assert.doesNotMatch(html, /<details[^>]*\sopen/);
  }
  assert.match(
    trailerPanel(w, p, b),
    /<details data-fleet-disclosure="trailer-shop"><summary>Specialist trailers \(\d+\)/,
  );
  w.trailers = {};
  assert.doesNotMatch(trailerPanel(w, p), /data-fleet-disclosure="owned-trailers"/);
});
test('garage storage and tractor catalogue use compact disclosures, including an empty garage', () => {
  const { w, p, b } = setup();
  assert.match(
    garageStoragePanel(w, p, b),
    /<details data-fleet-disclosure="garage-storage"><summary>Vehicle storage \(1\)/,
  );
  w.trailers = {};
  w.parkedVehicles = {};
  assert.match(garageStoragePanel(w, p, b), /<summary>Vehicle storage \(0\)/);
  assert.match(garageStoragePanel(w, p, b), /No vehicles or trailers stored here/);
  assert.match(
    tractorShopHtml(w),
    /<details data-fleet-disclosure="tractor-shop"><summary>Tractor showroom \(\d+\)/,
  );
});
