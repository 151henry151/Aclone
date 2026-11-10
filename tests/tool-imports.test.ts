// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importScarceTools } from '../src/shared/tool-imports';
import { toolImportRules, toolImportFields } from '../src/shared/tool-import-rules';
import { Store } from '../src/server/store';
import { catalogueSchema } from '../src/shared/world-catalogue';
import { createWorld, addPlayer, makeBuilding, advance, act } from '../src/shared/simulation';

function setup() {
  const w = createWorld('tools-test', 'Tool imports', 'owner');
  w.script = '';
  w.towns = [];
  w.resources = {};
  w.time = 0;
  Object.assign(w.settings, {
    toolImports: true,
    toolImportItems: 'chainsaw',
    toolImportInterval: 60,
    toolImportChance: 1,
    hungerRate: 0,
    thirstRate: 0,
    parishOrders: false,
    roadGrowthPerDay: 0,
  });
  (w as any).toolImportAt = 0;
  const p = addPlayer(w, 'owner', 'Owner');
  const shop = makeBuilding('harbour', 'market', 0, 0);
  Object.assign(shop, {
    owner: 'treasury',
    government: true,
    stock: {},
    sell: { chainsaw: 12400 },
    buy: { chainsaw: 8240 },
    investment: 100000,
  });
  w.buildings = [shop];
  return { w, p, shop };
}
test('scheduled scarce-tool delivery adds one finite chainsaw through world advancement', () => {
  const { w, shop } = setup();
  advance(w, 59);
  assert.equal(shop.stock.chainsaw ?? 0, 0);
  advance(w, 1);
  assert.equal(shop.stock.chainsaw, 1);
  assert.equal(shop.investment, 100000 - 9920);
});

test('finite paid supply caps scarce stock and cannot be sold straight back for profit', () => {
  const { w, shop, p } = setup();
  w.settings.salesTax = 0;
  p.x = p.z = 0;
  p.cash = 50000;
  p.inventory = {};
  p.vehicle = 5;
  importScarceTools(w, 60);
  importScarceTools(w, 120);
  importScarceTools(w, 180);
  assert.equal(shop.stock.chainsaw, 2);
  assert.equal(shop.investment, 80160);
  assert.equal(w.ledger.filter((e) => e.reason === 'scarce tool shipment').length, 2);
  act(w, p.id, {
    type: 'trade',
    building: shop.id,
    item: 'chainsaw',
    direction: 'buy',
    quantity: 2,
  });
  assert.equal(p.inventory.chainsaw, 2);
  assert.equal(shop.stock.chainsaw, 0);
  assert.equal(p.cash, 25200);
  importScarceTools(w, 180);
  assert.equal(shop.stock.chainsaw, 0);
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'trade',
        building: shop.id,
        item: 'chainsaw',
        direction: 'buy',
        quantity: 1,
      }),
    /stock/i,
  );
  assert.equal(JSON.stringify(w), before);
  act(w, p.id, {
    type: 'trade',
    building: shop.id,
    item: 'chainsaw',
    direction: 'sell',
    quantity: 2,
  });
  assert.ok(p.cash < 50000);
});

test('available local shelves suppress imports, private storage and unfinished shops do not', () => {
  for (const mode of ['seller', 'storage', 'construction'] as const) {
    const { w, shop } = setup();
    const local = makeBuilding('local', 'workshop', 100, 100);
    Object.assign(local, {
      owner: 'someone',
      government: false,
      stock: { chainsaw: 2 },
      sell: mode === 'storage' ? {} : { chainsaw: 11100 },
    });
    if (mode === 'construction') local.construction = { remaining: { wood: 1 } } as any;
    w.buildings.push(local);
    const copy = structuredClone(local);
    importScarceTools(w, 60);
    assert.equal(shop.stock.chainsaw ?? 0, mode === 'seller' ? 0 : 1);
    assert.deepEqual(local, copy);
  }
});

test('off, no chance, no money, full shelf, private terminal and missing terminal do not deliver', () => {
  for (const mode of [
    'off',
    'chance',
    'money',
    'full',
    'private',
    'missing',
    'necessities',
    'margin',
  ]) {
    const { w, shop } = setup();
    if (mode === 'off') w.settings.toolImports = false;
    if (mode === 'chance') w.settings.toolImportChance = 0;
    if (mode === 'money') shop.investment = 9919;
    if (mode === 'full') shop.capacity = 0;
    if (mode === 'private') shop.owner = 'someone';
    if (mode === 'missing') w.buildings = [];
    if (mode === 'necessities') shop.id = 'parish-government-stores';
    if (mode === 'margin') w.settings.toolImportCostShare = 1;
    const copy = structuredClone(shop);
    importScarceTools(w, 60);
    assert.deepEqual(shop, copy, mode);
    assert.equal(w.toolImportAt, 60);
  }
});

test('custom policy uses world catalogue values, partial affordability and explicit bounds', () => {
  const { w, shop } = setup();
  w.catalogue = catalogueSchema.parse({
    items: { 'custom:spade': { name: 'Survey spade', weight: 2, price: 1000 } },
  });
  Object.assign(w.settings, {
    toolImportItems: 'custom:spade',
    toolImportQuantity: 5,
    toolImportStockCap: 4,
    toolImportScarcity: 3,
    toolImportPremium: 100,
    toolImportCostShare: 0.6,
    toolImportBidMargin: 500,
  });
  shop.buy['custom:spade'] = 800;
  shop.investment = 2600;
  importScarceTools(w, 60);
  assert.equal(shop.sell['custom:spade'], 2000);
  assert.equal(shop.stock['custom:spade'], 2);
  assert.equal(shop.investment, 0); // cost max(1200, 800 + 500)
  shop.investment = 100000;
  importScarceTools(w, 120);
  assert.equal(shop.stock['custom:spade'], 3); // scarcity binds before cap
  w.settings.toolImportScarcity = 10;
  importScarceTools(w, 180);
  assert.equal(shop.stock['custom:spade'], 4); // shelf cap
  w.settings.toolImportStockCap = 20;
  shop.capacity = 5;
  importScarceTools(w, 240);
  assert.equal(shop.stock['custom:spade'], 5); // building capacity
  // Catalogue edits replace the catalogue identity (as setCatalogue does).
  w.catalogue = catalogueSchema.parse({});
  shop.stock = {};
  importScarceTools(w, 300);
  assert.deepEqual(shop.stock, {});
});

test('seed and persisted cursor prevent replay, even for a skipped check or long catch-up', () => {
  const { w, shop } = setup();
  w.settings.toolImportItems = 'chainsaw,pickaxe,shovel';
  w.settings.toolImportChance = 0.5;
  const duplicate = structuredClone(w);
  for (let i = 1; i <= 30; i++) {
    importScarceTools(w, i * 60);
    importScarceTools(duplicate, i * 60);
  }
  assert.deepEqual(w, duplicate);
  assert.ok(Object.values(shop.stock).reduce((a, b) => a + b, 0) > 0);
  w.time = 1800;
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const before = JSON.stringify(saved);
    importScarceTools(saved, 1800);
    assert.equal(JSON.stringify(saved), before);
    const copy = structuredClone(saved);
    importScarceTools(saved, 1860);
    importScarceTools(copy, 1860);
    assert.deepEqual(saved, copy);
  } finally {
    store.close();
  }
  const c = setup();
  importScarceTools(c.w, 6000000);
  assert.equal(c.shop.stock.chainsaw, 1);
  importScarceTools(c.w, 6000000);
  assert.equal(c.shop.stock.chainsaw, 1);
  const old = setup();
  delete old.w.toolImportAt;
  old.w.time = 6000000;
  importScarceTools(old.w, old.w.time);
  assert.equal(old.shop.stock.chainsaw ?? 0, 0);
  importScarceTools(old.w, old.w.time + 60);
  assert.equal(old.shop.stock.chainsaw, 1);
});

test('rule edits validate atomically, reset only changed timing/enable, and export with custom catalogue', async () => {
  const { w, p } = setup();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of Object.keys(toolImportFields))
    assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { toolImports: 1 },
    { toolImportItems: '' },
    { toolImportItems: 'chainsaw,chainsaw' },
    { toolImportItems: 'not-an-item' },
    { toolImportInterval: 59 },
    { toolImportInterval: 60.5 },
    { toolImportChance: 1.1 },
    { toolImportStockCap: 0 },
    { toolImportQuantity: 1.5 },
    { toolImportScarcity: -1 },
    { toolImportCostShare: 0 },
    { toolImportPremium: 501 },
    { toolImportBidMargin: 0 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.equal(JSON.stringify(w), before);
  }
  w.time = 13;
  act(w, p.id, { type: 'settings', patch: { toolImportInterval: 120 } });
  assert.equal(w.toolImportAt, 13);
  w.time = 20;
  act(w, p.id, { type: 'settings', patch: { toolImportInterval: 120 } });
  assert.equal(w.toolImportAt, 13);
  act(w, p.id, { type: 'settings', patch: { toolImports: false } });
  assert.equal(w.toolImportAt, 20);
  w.time = 25;
  act(w, p.id, { type: 'settings', patch: { toolImports: true } });
  assert.equal(w.toolImportAt, 25);
  const stranger = addPlayer(w, 'stranger', 'Stranger');
  assert.throws(() => act(w, stranger.id, { type: 'settings', patch: { toolImports: false } }));
  w.catalogue = catalogueSchema.parse({
    items: { 'custom:spade': { name: 'Spade', weight: 1, price: 1000 } },
  });
  act(w, p.id, {
    type: 'settings',
    patch: { toolImportItems: 'custom:spade', toolImportChance: 0.3 },
  });
  assert.match(
    rulesSummary(w),
    /Scarce tool imports: enabled; custom:spade; check every 120s, 30%/,
  );
  const target = createWorld('target', 'Target', 'owner');
  applyDesign(target, exportDesign(w));
  assert.equal(target.settings.toolImportItems, 'custom:spade');
  assert.equal(target.settings.toolImportChance, 0.3);
  assert.equal(target.catalogue!.items['custom:spade'].name, 'Spade');
  assert.equal(toolImportRules({}).toolImportInterval, 1800);
  assert.equal(toolImportRules({}).toolImportChance, 0.5);
});

test('rejected cross-field settings cannot reset a pending import check', () => {
  const { w, p } = setup();
  w.time = 30;
  const before = w.toolImportAt;
  assert.throws(() =>
    act(w, p.id, {
      type: 'settings',
      patch: {
        toolImportInterval: 120,
        pumpIntakeMinReach: 10,
        pumpIntakeMaxReach: 6,
      },
    }),
  );
  assert.equal(w.toolImportAt, before);
});
