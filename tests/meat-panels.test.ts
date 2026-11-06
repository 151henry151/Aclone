// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation';
import { butcherPanel, homeCookingPanel } from '../src/client/meat-panels';
test('butcher panel reads private wagon cargo and room cooking reads only the guest pantry', () => {
  const w = createWorld('panels', 'Panels', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('butcher', 'butcher', 0, 0);
  w.buildings = [b];
  p.inventory = {};
  w.trailers = {
    wagon: { id: 'wagon', kind: 'livestock', owner: p.id, x: 0, z: 8, heading: 0, cargo: {} },
  };
  p.trailerCargo = { wagon: { calves: 1 } };
  assert.match(butcherPanel(w, p, b), /Calves/);
  const inn = makeBuilding('inn', 'hotel', 0, 0);
  w.buildings.push(inn);
  inn.lodging = { open: true, rate: 0, guests: { [p.id]: { until: 1000, stock: {} } } };
  p.atHome = true;
  p.home = inn.id;
  p.roomPantries = { [inn.id]: { beef: 1, potatoes: 2, water: 1 } };
  assert.match(homeCookingPanel(w, p, inn), /Ingredients ready/);
  assert.doesNotMatch(homeCookingPanel(w, p, inn), /disabled>Cook Beef stew/);
});
