// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
function setup() {
  const w = createWorld('test', 'Test', 'server');
  const owner = addPlayer(w, 'owner', 'BioHaze');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = owner.id;
  owner.x = b.x;
  owner.z = b.z + 12;
  w.settings.activeWork = false;
  w.settings.ownerOperation = false;
  w.settings.salesTax = 0;
  w.towns.forEach((t) => (t.salesTax = 0));
  b.buy = { wheat: 600 };
  b.sell = { flour: 3000 };
  b.wage = 1000;
  const workers = Array.from({ length: 3 }, (_, i) => addPlayer(w, 'worker' + i, 'Worker ' + i));
  workers.forEach((p) => {
    p.x = owner.x;
    p.z = owner.z;
    p.skills = ['miller'];
  });
  return { w, owner, b, workers };
}
test('owners remove sale listings without losing price, stock or investment; visitors cannot', () => {
  const { w, owner, b, workers } = setup();
  b.forSale = true;
  b.price = 123456;
  b.stock.wheat = 17;
  b.investment = 99000;
  assert.throws(() => act(w, workers[0].id, { type: 'unlistProperty', building: b.id }), /own/i);
  act(w, owner.id, { type: 'unlistProperty', building: b.id });
  assert.equal(b.forSale, false);
  assert.equal(b.price, 123456);
  assert.equal(b.stock.wheat, 17);
  assert.equal(b.investment, 99000);
  assert.throws(() => act(w, workers[0].id, { type: 'buyBuilding', building: b.id }), /listed/i);
  act(w, owner.id, { type: 'listProperty', building: b.id, price: 200000 });
  assert.equal(b.forSale, true);
  assert.equal(b.price, 200000);
});
