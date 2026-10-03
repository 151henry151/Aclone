// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { privatePlayer, prepareFrame } from '../src/server/snapshots.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('social', 'Social', 'a');
  const a = addPlayer(w, 'a', 'Ada'),
    b = addPlayer(w, 'b', 'Bo'),
    c = addPlayer(w, 'c', 'Cy');
  for (const p of [a, b, c]) {
    p.online = true;
    p.cash = 10000;
    p.x = 0;
    p.z = 0;
  }
  a.inventory = { wheat: 20 };
  b.inventory = {};
  return { w, a, b, c };
}
test('mail reaches offline residents, persists privately and cannot be deleted by others', () => {
  const { w, a, b, c } = setup();
  b.online = false;
  act(w, a.id, {
    type: 'postMail',
    player: b.id,
    subject: 'Wheat delivery',
    text: 'Meet at the mill tomorrow.',
  });
  assert.equal(b.mail?.[0].text, 'Meet at the mill tomorrow.');
  assert.equal(a.sentMail?.length, 1);
  const visible = JSON.stringify(prepareFrame(w));
  assert.ok(!visible.includes('Meet at the mill tomorrow.'));
  const before = JSON.stringify(w);
  assert.throws(() => act(w, c.id, { type: 'deleteMail', message: b.mail![0].id }));
  assert.equal(JSON.stringify(w), before);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal(store.loadWorlds()[0].world.players.b.mail?.length, 1);
  } finally {
    store.close();
  }
  act(w, b.id, { type: 'deleteMail', message: b.mail![0].id });
  assert.equal(b.mail!.length, 0);
  assert.equal(a.sentMail!.length, 1);
});
test('families require invitation and acceptance, preserve legacy membership, and transfer leadership', () => {
  const { w, a, b, c } = setup();
  act(w, a.id, { type: 'family', operation: 'create', name: 'Mill friends' });
  const id = a.family!;
  assert.throws(() => act(w, c.id, { type: 'family', operation: 'join', family: id }));
  act(w, a.id, { type: 'family', operation: 'invite', player: b.id });
  assert.equal(b.family, undefined);
  assert.equal(privatePlayer(w, b).familyInvites?.length, 1);
  act(w, b.id, { type: 'family', operation: 'join', family: id });
  assert.equal(b.family, id);
  act(w, a.id, { type: 'family', operation: 'leave' });
  assert.equal(w.families?.[id].leader, b.id);
  assert.equal(a.family, undefined);
  act(w, b.id, { type: 'family', operation: 'leave' });
  assert.equal(w.families?.[id], undefined);
  a.family = b.family = 'Old family';
  act(w, a.id, { type: 'family', operation: 'invite', player: c.id });
  act(w, c.id, { type: 'family', operation: 'join', family: 'Old family' });
  assert.equal(c.family, 'Old family');
});
test('a trade offer is private, needs recipient approval and exchanges goods and price exactly once', () => {
  const { w, a, b, c } = setup();
  act(w, a.id, {
    type: 'offerTrade',
    player: b.id,
    item: 'wheat',
    quantity: 5,
    price: 600,
    direction: 'sell',
  });
  const offer = privatePlayer(w, b).tradeOffers![0];
  assert.equal(privatePlayer(w, c).tradeOffers!.length, 0);
  assert.ok(!JSON.stringify(prepareFrame(w).fields).includes('"seller"'));
  assert.equal(a.inventory.wheat, 20);
  assert.throws(() => act(w, a.id, { type: 'acceptTrade', offer: offer.id }));
  act(w, b.id, { type: 'acceptTrade', offer: offer.id });
  assert.equal(b.inventory.wheat, 5);
  assert.equal(a.inventory.wheat, 15);
  assert.equal(a.cash, 13000);
  assert.equal(b.cash, 7000);
  assert.throws(() => act(w, b.id, { type: 'acceptTrade', offer: offer.id }));
});
test('trade rejection is atomic for insufficient stock, cash, distance, cargo, expiry or new life', () => {
  for (const state of ['stock', 'cash', 'distance', 'cargo', 'expired', 'newlife']) {
    const { w, a, b } = setup();
    act(w, a.id, {
      type: 'offerTrade',
      player: b.id,
      item: 'wheat',
      quantity: 5,
      price: 600,
      direction: 'sell',
    });
    const offer = privatePlayer(w, b).tradeOffers![0];
    if (state === 'stock') a.inventory.wheat = 0;
    if (state === 'cash') b.cash = 0;
    if (state === 'distance') b.x = 30;
    if (state === 'cargo') b.inventory.logs = 1000;
    if (state === 'expired') w.time += 301;
    if (state === 'newlife') a.deaths++;
    const before = JSON.stringify(w);
    assert.throws(() => act(w, b.id, { type: 'acceptTrade', offer: offer.id }));
    assert.equal(JSON.stringify(w), before);
  }
});

test('mail limits and reserved-looking recipient names reject without pollution or data loss', () => {
  const { w, a, b } = setup();
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, a.id, { type: 'postMail', player: id, subject: 'x', text: 'y' }));
    assert.equal(JSON.stringify(w), before);
  }
  act(w, a.id, { type: 'postMail', player: b.name.toLowerCase(), subject: 'x', text: 'y' });
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, a.id, { type: 'postMail', player: b.id, subject: 'Again', text: 'Again' }),
    /ten seconds/,
  );
  assert.equal(JSON.stringify(w), before);
  w.time += 10;
  b.mail = Array(50).fill(b.mail![0]);
  assert.throws(
    () => act(w, a.id, { type: 'postMail', player: b.id, subject: 'Full', text: 'Full' }),
    /full/,
  );
  assert.equal(b.mail.length, 50);
});
test('buy offers charge their author only when the invited seller accepts; third parties see no invitation list', () => {
  const { w, a, b, c } = setup();
  act(w, b.id, {
    type: 'offerTrade',
    player: a.id,
    item: 'wheat',
    quantity: 3,
    price: 500,
    direction: 'buy',
  });
  const offer = privatePlayer(w, a).tradeOffers![0];
  act(w, a.id, { type: 'acceptTrade', offer: offer.id });
  assert.equal(b.inventory.wheat, 3);
  assert.equal(b.cash, 8500);
  act(w, a.id, { type: 'family', operation: 'create', name: 'Millers' });
  act(w, a.id, { type: 'family', operation: 'invite', player: b.id });
  const fields = prepareFrame(w).fields;
  assert.deepEqual(JSON.parse(fields.families)[a.family!].invited, []);
  assert.equal(privatePlayer(w, c).familyInvites?.length, 0);
  assert.throws(() => act(w, b.id, { type: 'group', kind: 'family', name: 'Millers' }), /exists/);
});
