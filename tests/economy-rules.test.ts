// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { bulkSale } from '../src/client/bulk-sale';
import { Store } from '../src/server/store';
const defaults = { minimumBuyPrice: 100, transactionItemLimit: 10000 };
function fixture() {
  const w = createWorld('economy-rules', 'Economy', 'owner'),
    owner = addPlayer(w, 'owner', 'Owner'),
    p = addPlayer(w, 'seller', 'Seller'),
    b = makeBuilding('shop', 'bakery', 0, 0);
  w.script = '';
  w.buildings = [b];
  b.owner = owner.id;
  b.stock.flour = 0;
  b.buy.flour = 100;
  b.investment = 1000000;
  p.inventory.flour = 50;
  for (const q of [owner, p]) Object.assign(q, { x: 0, z: 0, online: true });
  const admin = (price: number) =>
    act(w, owner.id, { type: 'buildingAdmin', building: b.id, item: 'flour', side: 'buy', price });
  const sell = (quantity: number) =>
    act(w, p.id, { type: 'trade', building: b.id, item: 'flour', direction: 'sell', quantity });
  return { w, owner, p, b, admin, sell };
}
test('economy bid and item defaults are named settings with old-save fallbacks', async () => {
  const { w, owner, admin } = fixture();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value);
  assert.throws(() => admin(99));
  admin(100);
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  assert.throws(() => admin(99));
  act(w, owner.id, { type: 'settings', patch: { minimumBuyPrice: 50, transactionItemLimit: 7 } });
  admin(50);
  assert.equal(w.settings.minimumBuyPrice, 50);
});
test('changed minimum bids govern actual sales and survive storage without changing saved quotes', () => {
  const { w, owner, p, b, admin, sell } = fixture();
  act(w, owner.id, { type: 'settings', patch: { minimumBuyPrice: 50 } });
  assert.throws(() => admin(49));
  admin(50);
  const cash = p.cash;
  sell(2);
  assert.equal(p.cash, cash + 100);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal(store.loadWorlds()[0].world.buildings[0].buy.flour, 50);
    act(w, owner.id, { type: 'settings', patch: { minimumBuyPrice: 200 } });
    const before = JSON.stringify(w);
    assert.throws(() => sell(1), /does not trade/);
    assert.equal(JSON.stringify(w), before);
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal(loaded.buildings[0].buy.flour, 50);
    assert.equal(bulkSale(b, 'flour', 48, 50, w).quantity, 0);
  } finally {
    store.close();
  }
});
test('quantity limits govern actual trades, stockroom transfers, gifts and bulk-sale hints atomically', () => {
  const { w, owner, p, b, sell } = fixture();
  act(w, owner.id, { type: 'settings', patch: { transactionItemLimit: 3 } });
  const cash = p.cash;
  sell(3);
  assert.equal(p.cash, cash + 300);
  const before = JSON.stringify(w);
  assert.throws(() => sell(4));
  assert.equal(JSON.stringify(w), before);
  const quote = bulkSale(b, 'flour', 47, 100, w);
  assert.equal(quote.quantity, 3);
  assert.match(quote.note, /3-item trade limit/);
  owner.inventory.flour = 5;
  for (const action of [
    { type: 'stock', building: b.id, item: 'flour', direction: 'deposit', quantity: 4 },
    { type: 'give', player: p.id, item: 'flour', quantity: 4 },
    { type: 'discard', item: 'flour', quantity: 4 },
  ])
    assert.throws(() => act(w, owner.id, action));
  act(w, owner.id, {
    type: 'stock',
    building: b.id,
    item: 'flour',
    direction: 'deposit',
    quantity: 3,
  });
  assert.equal(owner.inventory.flour, 2);
});
test('raised quantity limits allow large valid sales and resident schema preserves them', async () => {
  const { w, owner, p, b, sell } = fixture();
  act(w, owner.id, { type: 'settings', patch: { transactionItemLimit: 20000 } });
  p.inventory.flour = 12000;
  b.capacity = 20000;
  b.investment = 2000000;
  sell(12000);
  assert.equal(p.inventory.flour, 0);
  assert.equal(b.stock.flour, 12000);
  const { stepSchema } = await import('../src/server/npc/decision');
  assert.doesNotThrow(() =>
    stepSchema.parse({
      kind: 'act',
      action: { type: 'trade', building: b.id, item: 'flour', direction: 'sell', quantity: 12000 },
    }),
  );
});
test('economy rules reject invalid edits and appear in creation fields, summary and portable designs', async () => {
  const { w, owner } = fixture();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign, configureRules } = await import('../src/server/world-design');
  assert.match(settingsFields(w.settings), /<legend>Economy and trade<\/legend>/);
  for (const key of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { minimumBuyPrice: 0 },
    { minimumBuyPrice: 1.5 },
    { transactionItemLimit: 0 },
    { transactionItemLimit: 100001 },
  ]) {
    const before = JSON.stringify(w.settings);
    assert.throws(() => act(w, owner.id, { type: 'settings', patch }));
    assert.equal(JSON.stringify(w.settings), before);
  }
  configureRules(w, { minimumBuyPrice: 45, transactionItemLimit: 678 });
  assert.match(rulesSummary(w), /45/);
  assert.match(rulesSummary(w), /678/);
  const dest = createWorld('dest', 'Destination', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.equal(dest.settings.minimumBuyPrice, 45);
  assert.equal(dest.settings.transactionItemLimit, 678);
});

test('boat stores, private offers and tax previews follow the quantity rule', async () => {
  const { w, owner, p, b } = fixture();
  const { FISHING_BOAT } = await import('../src/shared/boats');
  const { expeditionAction } = await import('../src/shared/fishing-expedition');
  const { tradeQuoteText } = await import('../src/client/tax-info');
  Object.assign(w.settings, { transactionItemLimit: 3 });
  owner.vehicle = FISHING_BOAT;
  owner.inventory.water = 10;
  assert.throws(() =>
    expeditionAction(w, owner, {
      type: 'expedition',
      operation: 'store',
      item: 'water',
      quantity: 4,
    }),
  );
  assert.throws(() =>
    act(w, owner.id, {
      type: 'offerTrade',
      player: p.id,
      item: 'water',
      direction: 'sell',
      quantity: 4,
      price: 50,
    }),
  );
  assert.match(tradeQuoteText(w, b, 'flour', 'buy', 100, 4), /1 to 3/);
  act(w, owner.id, {
    type: 'offerTrade',
    player: p.id,
    item: 'water',
    direction: 'sell',
    quantity: 3,
    price: 50,
  });
  const id = w.tradeOffers![0].id;
  const water = p.inventory.water ?? 0;
  owner.vehicle = 0;
  Object.assign(w.settings, { transactionItemLimit: 1 });
  act(w, p.id, { type: 'acceptTrade', offer: id });
  assert.equal(p.inventory.water, water + 3);
});

test('resident business requests use the live purchase-bid minimum', async () => {
  const { w, owner, b } = fixture();
  const { businessRequestBlocker } = await import('../src/server/npc/business-requests');
  Object.assign(w.settings, { minimumBuyPrice: 50 });
  const request = {
    building: b.id,
    keepDenarii: null,
    pricing: { item: 'flour', side: 'buy' as const, enabled: true, priceDenarii: 0.5 },
  };
  assert.equal(businessRequestBlocker(w, owner, request), undefined);
  w.settings.minimumBuyPrice = 200;
  assert.match(businessRequestBlocker(w, owner, request)!, /at least 2d/);
});
