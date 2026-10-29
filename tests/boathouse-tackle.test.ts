// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, makeBuilding } from '../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { integrateBoathouseTackle } from '../src/shared/boathouse-tackle';
import { exportShipments } from '../src/shared/export-shipments';
import { buildings } from '../src/shared/catalog';
import { Store } from '../src/server/store';

test('an existing public boatyard sells usable fishing tackle and pays for bounded restocking', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.ok(ensurePuddlewickBoatyard(w));
  const yard = w.buildings.find((b) => b.id === 'parish-boatyard')!;
  delete yard.buy.tackle;
  delete yard.sell.tackle;
  // Match the funded live harbour; bunker fuel deliveries share this till.
  yard.investment = 5000000;
  const till = yard.investment;
  assert.ok(integrateBoathouseTackle(w));
  assert.equal(yard.stock.tackle, 8);
  const imported = w.ledger.filter((e) => e.reason === 'boatyard fishing tackle shipment');
  assert.equal(imported.length, 1);
  assert.equal(till - yard.investment, imported[0].amount);
  const p = addPlayer(w, 'angler', 'Angler');
  Object.assign(p, { x: yard.x, z: yard.z, cash: 100000, inventory: {} });
  act(w, p.id, {
    type: 'trade',
    building: yard.id,
    item: 'tackle',
    quantity: 1,
    direction: 'buy',
  });
  assert.equal(p.inventory.tackle, 1);
  assert.equal(yard.stock.tackle, 7);
  assert.equal(integrateBoathouseTackle(w), false);
  assert.equal(yard.stock.tackle, 7);
  exportShipments(w, 1800);
  assert.equal(yard.stock.tackle, 8);
  yard.stock.tackle = 0;
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal(integrateBoathouseTackle(loaded), false);
    exportShipments(loaded, 1800);
    assert.equal(loaded.buildings.find((b) => b.id === yard.id)!.stock.tackle, 0);
    exportShipments(loaded, 3600);
    assert.equal(loaded.buildings.find((b) => b.id === yard.id)!.stock.tackle, 8);
  } finally {
    store.close();
  }
});

test('new boatyards list tackle; upgrades preserve custom and paused prices without free private stock', () => {
  const w = createWorld('custom', 'Custom coast', 'owner');
  const fresh = makeBuilding('fresh', 'boathouse', 0, 0);
  assert.equal(fresh.sell.tackle, buildings.boathouse.sell.tackle);
  const custom = makeBuilding('private', 'boathouse', 0, 0);
  Object.assign(custom, { owner: 'owner', investment: 100000, stock: { tackle: 2 } });
  custom.sell.tackle = 12345;
  custom.buy.tackle = 0;
  const paused = makeBuilding('paused', 'boathouse', 0, 0);
  delete paused.sell.tackle;
  paused.pausedPrices = { sell: { tackle: 7777 } };
  w.buildings.push(custom, paused);
  integrateBoathouseTackle(w);
  assert.equal(custom.sell.tackle, 12345);
  assert.equal(custom.buy.tackle, 0);
  assert.equal(custom.stock.tackle, 2);
  assert.equal(custom.investment, 100000);
  assert.equal(paused.sell.tackle, undefined);
  assert.equal(paused.pausedPrices.sell?.tackle, 7777);
  exportShipments(w, 1800);
  assert.equal(custom.stock.tackle, 2);
});

test('public tackle imports respect a closed listing and cannot spend an empty till', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  const yard = w.buildings.find((b) => b.id === 'parish-boatyard')!;
  yard.investment = 0;
  integrateBoathouseTackle(w);
  assert.equal(yard.stock.tackle, undefined);
  yard.investment = 500000;
  delete yard.sell.tackle;
  exportShipments(w, 1800);
  assert.equal(yard.stock.tackle, undefined);
});
