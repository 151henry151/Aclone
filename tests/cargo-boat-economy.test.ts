// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightSetup } from './cargo-boat-hold.test';
import { act, addPlayer, advance } from '../src/shared/simulation';
import { voyageFuel } from '../src/shared/fishing-expedition';
import { travelHeight } from '../src/shared/dock';
test('freight crew shares use realized margin, preserve unsold basis and never pay twice or on losses', () => {
  const { w, p, d } = freightSetup();
  w.settings.freightTransferRate = 10000;
  const b = d.building!;
  b.owner = 'merchant';
  b.stock = { stone: 100 };
  b.sell = { stone: 600 };
  b.buy = { stone: 1000 };
  b.investment = 1000000;
  const q = addPlayer(w, 'crew', 'Deckhand');
  Object.assign(q, d.land, {
    y: travelHeight(w, d.land.x, d.land.z),
    vehicle: 5,
    online: true,
    inventory: {},
  });
  act(w, p.id, { type: 'expedition', operation: 'offer', player: q.id, share: 20 });
  act(w, q.id, { type: 'expedition', operation: 'accept', captain: p.id });
  const trade = (direction: string, n: number) => {
    act(w, p.id, {
      type: 'trade',
      storage: 'hold',
      slot: 35,
      building: b.id,
      direction,
      item: 'stone',
      quantity: n,
    });
    advance(w, 1);
  };
  const before = p.cash,
    crew = q.cash;
  trade('buy', 10);
  trade('sell', 5);
  voyageFuel(w, p, 1);
  const fuelCost = p.fishingVoyage!.expenses;
  act(w, p.id, { type: 'expedition', operation: 'finish' });
  const share = Math.floor((5000 - 3000 - Math.ceil(fuelCost)) * 0.2);
  assert.equal(q.cash, crew + share);
  assert.equal(p.cash, before - 6000 + 5000 - share);
  assert.throws(() => act(w, p.id, { type: 'expedition', operation: 'finish' }), /No expedition/);
  assert.equal(p.boatHold?.stone, 5);
  // A second voyage must retain the cost of the other half, even after mooring/reboarding.
  q.x += 3;
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  act(w, p.id, { type: 'vehicle', slot: 35, building: d.id });
  act(w, p.id, { type: 'expedition', operation: 'offer', player: q.id, share: 20 });
  act(w, q.id, { type: 'expedition', operation: 'accept', captain: p.id });
  b.buy.stone = 500;
  trade('sell', 5);
  const previous = q.cash;
  act(w, p.id, { type: 'expedition', operation: 'finish' });
  assert.equal(q.cash, previous);
});
test('freight settlement rechecks share funding and counts captain provisions', () => {
  const { w, p, d } = freightSetup();
  const q = addPlayer(w, 'crew', 'Crew');
  Object.assign(q, d.land, { vehicle: 5, online: true, y: travelHeight(w, d.land.x, d.land.z) });
  act(w, p.id, { type: 'expedition', operation: 'offer', player: q.id, share: 20 });
  act(w, q.id, { type: 'expedition', operation: 'accept', captain: p.id });
  const v = p.fishingVoyage!;
  p.inventory.bread = 1;
  const expected = v.provisionPrices.bread;
  act(w, p.id, { type: 'use', item: 'bread' });
  assert.equal(v.expenses, expected);
  v.freightReceipts = 10000;
  v.freightCost = 1000;
  v.expenses = 0;
  p.cash = 0;
  const before = structuredClone({ captain: p, crew: q });
  assert.throws(() => act(w, p.id, { type: 'expedition', operation: 'finish' }), /cash|share/i);
  assert.deepEqual({ captain: p, crew: q }, before);
});
