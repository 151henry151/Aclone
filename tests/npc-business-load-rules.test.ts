// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  advance,
  terrainHeight,
} from '../src/shared/simulation';
import { gameplayChoices, farmDuty } from '../src/server/npc/farmer';
import { enterpriseChoices } from '../src/server/npc/enterprise';
import { Store } from '../src/server/store';
import { worldResources } from '../src/shared/resources';
import { operationAction } from '../src/server/npc/player-operations';
import type { Step } from '../src/server/npc/decision';
import type { ResidentState } from '../src/server/npc/memory';
function memoryState(
  w: ReturnType<typeof createWorld>,
  p: ReturnType<typeof addPlayer>,
): ResidentState {
  return {
    world: w.id,
    playerId: p.id,
    name: p.name,
    personality: 'Helpful',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    cursor: 0,
    nextAt: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: 'Ready',
    errors: 0,
  };
}
function setup() {
  const w = createWorld('limit', 'Limit', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('bakery', 'bakery', 0, 0),
    seller = makeBuilding('seller', 'market', 20, 0),
    buyer = makeBuilding('buyer', 'market', 40, 0),
    farm = makeBuilding('farm', 'farm', 60, 0);
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, salesTax: 0, seaLevel: -10 });
  w.towns = [];
  w.resources = {};
  Object.assign(p, {
    cash: 1000000,
    inventory: {},
    fuel: 64,
    x: 0,
    z: 0,
    hunger: 0,
    thirst: 0,
    skills: ['baker', 'farmer'],
  });
  Object.assign(b, {
    owner: p.id,
    stock: { flour: 0, bread: 30 },
    buy: { flour: 100 },
    sell: { bread: 200 },
    wage: 100,
    investment: 100000,
    production: {
      skill: 'baker',
      tier: 1,
      seconds: 600,
      inputs: { flour: 2 },
      outputs: { bread: 3 },
    },
  });
  Object.assign(seller, {
    owner: 'seller',
    stock: { flour: 100, wood: 100, water: 100, bread: 100 },
    sell: { flour: 100, wood: 100, water: 100, bread: 100 },
    buy: {},
    investment: 100000,
  });
  Object.assign(buyer, {
    owner: 'buyer',
    stock: {},
    sell: {},
    buy: { bread: 300, wheat: 400, flour: 200 },
    investment: 100000,
    capacity: 1000,
  });
  Object.assign(farm, { owner: p.id, stock: { wheat: 50 }, investment: 100000 });
  w.buildings = [b, seller, buyer, farm];
  const state = memoryState(w, p);
  return { w, p, b, seller, buyer, farm, state };
}
const transfers = (plan: Step[]) =>
  plan.flatMap((s) =>
    s.kind === 'act' && (s.action.type === 'trade' || s.action.type === 'stock') ? [s.action] : [],
  );
function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, plan: Step[]) {
  for (const s of plan) {
    if (s.kind === 'travel') {
      const target =
        w.buildings.find((b) => b.id === s.destination) ??
        worldResources(w).find((n) => n.id === s.destination)!;
      assert.ok(target);
      Object.assign(p, { x: target.x, z: target.z, y: terrainHeight(w, target.x, target.z) });
    } else if (s.kind === 'act') {
      act(w, p.id, s.action);
      if (p.task) advance(w, p.task.end - w.time + 0.01);
    } else if (s.kind === 'operation') act(w, p.id, operationAction(s));
  }
}

const defaults = {
  npcRoutineSupplyBatches: 2,
  npcRoutineDepositBatches: 4,
  npcCropDemandBatches: 6,
  npcBusinessCollectionLoad: 20,
  npcSmallInputPurchaseLoad: 5,
  npcSmallInputPurchaseBatches: 2,
  npcCarriedSurplusSaleLoad: 25,
  npcFarmCollectionLoad: 25,
  npcOwnedSourceReserveBatches: 3,
  npcBusinessOutputSaleLoad: 30,
  npcFarmOutputSaleLoad: 20,
};
const load = (choices: { description: string; plan: Step[] }[], pattern: RegExp) => {
  const choice = choices.find((c) => pattern.test(c.description));
  return choice && transfers(choice.plan)[0]?.quantity;
};
test('business cargo defaults and absent fields preserve collection purchase and output sale quantities', () => {
  for (const missing of [false, true]) {
    const { w, p, state } = setup();
    for (const [key, value] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[key];
      else assert.equal((w.settings as any)[key], value, key);
    }
    const choices = gameplayChoices(w, p, state, 'farmer');
    assert.equal(load(choices, /^Collect .* bread /), 20);
    assert.equal(load(choices, /^Collect .* wheat /), 25);
    assert.equal(load(choices, /^Buy .* flour .* gathering or supplying/), 5);
    const routes = enterpriseChoices(w, p);
    assert.equal(load(routes, /^Sell my output: collect/), 30);
    assert.equal(load(routes, /^Sell my output: haul/), 20);
    p.inventory = { flour: 40 };
    assert.equal(load(gameplayChoices(w, p, state, 'farmer'), /^Sell .* carried Flour/), 25);
  }
});
test('business and farm collection and sale loads honor custom zero and transaction ceilings', () => {
  const { w, p, state, b, buyer } = setup();
  const keys = [
    'npcBusinessCollectionLoad',
    'npcFarmCollectionLoad',
    'npcSmallInputPurchaseLoad',
    'npcBusinessOutputSaleLoad',
    'npcFarmOutputSaleLoad',
  ];
  for (const n of [2, 0]) {
    Object.assign(w.settings, Object.fromEntries(keys.map((k) => [k, n])));
    const choices = gameplayChoices(w, p, state, 'farmer');
    for (const pattern of [
      /^Collect .* bread /,
      /^Collect .* wheat /,
      /^Buy .* flour .* gathering or supplying/,
    ])
      assert.equal(load(choices, pattern), n || undefined, String(pattern));
    const routes = enterpriseChoices(w, p);
    for (const pattern of [/^Sell my output: collect/, /^Sell my output: haul/])
      assert.equal(load(routes, pattern), n || undefined, String(pattern));
  }
  Object.assign(w.settings, Object.fromEntries(keys.map((k) => [k, 4])));
  w.settings.transactionItemLimit = 1;
  assert.equal(load(enterpriseChoices(w, p), /^Sell my output: collect/), 1);
  w.settings.transactionItemLimit = 10000;
  const choice = enterpriseChoices(w, p).find((c) =>
    c.description.startsWith('Sell my output: collect'),
  )!;
  const cash = p.cash + b.investment + buyer.investment;
  run(w, p, choice.plan);
  assert.equal(buyer.stock.bread, 4);
  assert.equal(b.stock.bread + (p.inventory.bread ?? 0) + buyer.stock.bread, 30);
  assert.equal(p.cash + b.investment + buyer.investment, cash);
});
test('carried surplus sale policy preserves unsold cargo and disables optional sales at zero', () => {
  const { w, p, state } = setup();
  p.inventory = { flour: 40 };
  for (const n of [3, 0]) {
    Object.assign(w.settings, { npcCarriedSurplusSaleLoad: n });
    assert.equal(
      load(gameplayChoices(w, p, state, 'farmer'), /^Sell .* carried Flour/),
      n || undefined,
    );
    assert.equal(p.inventory.flour, 40);
  }
});
test('small input batch threshold is exact and zero does not suppress one missing gathering implement', () => {
  const { w, p, b, seller, state } = setup();
  const purchase = () =>
    load(gameplayChoices(w, p, state, 'farmer'), /^Buy .* flour .* gathering or supplying/);
  b.stock.flour = 3;
  assert.equal(purchase(), 5);
  b.stock.flour = 4;
  assert.equal(purchase(), undefined);
  Object.assign(w.settings, { npcSmallInputPurchaseBatches: 3 });
  assert.equal(purchase(), 5);
  b.stock.flour = 6;
  assert.equal(purchase(), undefined);
  b.stock.flour = 0;
  Object.assign(w.settings, { npcSmallInputPurchaseBatches: 0, npcSmallInputPurchaseLoad: 0 });
  assert.equal(purchase(), undefined);
  seller.stock.chainsaw = 4;
  seller.sell.chainsaw = 100;
  assert.equal(
    load(gameplayChoices(w, p, state, 'farmer'), /^Buy .* chainsaw .* gathering or supplying/),
    1,
  );
});
test('owned suppliers retain configured production batches and actual breeding minima', () => {
  const { w, p, b, seller } = setup();
  seller.owner = p.id;
  seller.stock = { flour: 10 };
  seller.production = {
    skill: 'baker',
    tier: 1,
    seconds: 600,
    inputs: { flour: 2 },
    outputs: { bread: 3 },
  };
  const supply = () => load(enterpriseChoices(w, p), /^Supply my .*transfer .* flour from my/);
  assert.equal(supply(), 4);
  delete (w.settings as any).npcOwnedSourceReserveBatches;
  assert.equal(supply(), 4);
  Object.assign(w.settings, { npcOwnedSourceReserveBatches: 4 });
  assert.equal(supply(), 2);
  Object.assign(w.settings, { npcOwnedSourceReserveBatches: 0 });
  assert.equal(supply(), 10);
  Object.assign(w.settings, { npcOwnedSourceReserveBatches: 5 });
  assert.equal(supply(), undefined);
  // A source herd still keeps its two breeding animals when the optional buffer is zero.
  Object.assign(w.settings, { npcOwnedSourceReserveBatches: 0 });
  seller.kind = 'dairy';
  seller.stock = { cows: 3 };
  seller.production = undefined;
  b.kind = 'dairy';
  b.production = undefined;
  b.recipe = 'dairy';
  b.stock = { cows: 0 };
  const animals = enterpriseChoices(w, p).find((c) =>
    /^Supply my .*transfer .* cows from my/.test(c.description),
  );
  assert.ok(animals);
  assert.equal(transfers(animals.plan)[0].quantity, 1);
});
test('business cargo settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state } = setup();
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  for (const k of Object.keys(defaults))
    for (const v of [-1, 0.5, 10001]) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = Object.fromEntries(Object.keys(defaults).map((k, i) => [k, 101 + i]));
  edit(patch);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const html = settingsFields(),
    summary = rulesSummary(w),
    dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      observation = observe(w, p, state, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(html.includes(`name="${k}"`), k);
      assert.ok(summary.includes(String(v)), k);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((dest.settings as any)[k], v);
      assert.equal((observation.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

function herdFixture() {
  const f = setup();
  Object.assign(f.b, {
    kind: 'dairy',
    recipe: 'dairy',
    production: undefined,
    stock: { cows: 2, water: 20 },
    sell: { milk: 5000 },
    buy: { feed: 100 },
    herdCondition: 100,
  });
  Object.assign(f.seller, { stock: { feed: 100, cows: 10 }, sell: { feed: 100, cows: 100 } });
  f.buyer.buy = { milk: 5000 };
  f.p.skills = ['livestock farmer', 'farmer'];
  return f;
}
test('routine livestock supply and deposit fallbacks retain defaults and honor independent zero budgets', () => {
  for (const missing of [false, true]) {
    const { w, p, state, b } = herdFixture();
    if (missing) {
      delete (w.settings as any).npcRoutineSupplyBatches;
      delete (w.settings as any).npcRoutineDepositBatches;
    }
    const choices = () => gameplayChoices(w, p, state, 'farmer');
    assert.equal(load(choices(), /^Supply my .*buy and deliver .* feed from/), 4);
    p.inventory = { feed: 20 };
    assert.equal(load(choices(), /^Deposit .* carried feed /), 8);
    Object.assign(w.settings, { npcRoutineSupplyBatches: 3, npcRoutineDepositBatches: 2 });
    assert.equal(load(choices(), /^Supply my .*buy and deliver .* feed from/), 6);
    assert.equal(load(choices(), /^Deposit .* carried feed /), 4);
    Object.assign(w.settings, { npcRoutineSupplyBatches: 0, npcRoutineDepositBatches: 0 });
    assert.equal(load(choices(), /^Supply my .*buy and deliver .* feed from/), undefined);
    assert.equal(load(choices(), /^Deposit .* carried feed /), undefined);
    Object.assign(w.settings, { npcRoutineSupplyBatches: 1 });
    p.inventory = {};
    const choice = choices().find((c) =>
      /^Supply my .*buy and deliver .* feed from/.test(c.description),
    )!;
    const cash = p.cash,
      source = w.buildings[1].stock.feed;
    run(w, p, choice.plan);
    assert.equal(b.stock.feed, 2);
    assert.equal(w.buildings[1].stock.feed, source - 2);
    assert.equal(p.inventory.feed ?? 0, 0);
    assert.equal(p.cash, cash - 200);
  }
});
test('calculated ordinary input targets take precedence over routine fallback budgets', () => {
  const { w, p, state } = setup();
  Object.assign(w.settings, { npcRoutineSupplyBatches: 0, npcRoutineDepositBatches: 0 });
  p.inventory = { flour: 20 };
  const choices = gameplayChoices(w, p, state, 'farmer');
  assert.equal(load(choices, /^Supply my .*buy and deliver .* flour from/), 12);
  assert.equal(load(choices, /^Deposit .* carried flour /), 12);
});
test('enterprise livestock input fallback shares existing reserve batches while retaining breeding minimum', () => {
  const { w, p, b } = herdFixture();
  const feed = () => load(enterpriseChoices(w, p), /^Supply my .*buy and deliver .* feed /);
  assert.equal(feed(), 12);
  delete w.settings.npcInputReserveBatches;
  assert.equal(feed(), 12);
  act(w, p.id, { type: 'settings', patch: { npcInputReserveBatches: 9 } });
  assert.equal(feed(), 18);
  act(w, p.id, { type: 'settings', patch: { npcInputReserveBatches: 2 } });
  assert.equal(feed(), 4);
  act(w, p.id, { type: 'settings', patch: { npcInputReserveBatches: 0 } });
  assert.equal(feed(), undefined);
  b.stock.cows = 0;
  assert.equal(load(enterpriseChoices(w, p), /^Supply my .*buy and deliver .* cows /), 2);
});
test('funded crop demand uses the configured batch horizon without removing actual urgent need', () => {
  const { w, p, state, farm, buyer } = setup();
  farm.stock = {};
  farm.owner = 'employer';
  farm.employees = [p.id];
  farm.plots = [{ planted: 0, ready: 0, water: 0, fertilized: false, previous: 'wheat' }];
  farm.farmPolicy = { crops: ['wheat', 'potatoes'], dailyLimit: 100000, reserve: 0 };
  w.buildings = [farm, buyer];
  buyer.buy = { wheat: 100, potatoes: 100 };
  buyer.stock = { wheat: 20 };
  buyer.production = {
    skill: 'miller',
    tier: 1,
    seconds: 600,
    inputs: { wheat: 20 },
    outputs: { flour: 20 },
  };
  const crop = () =>
    farmDuty(w, p, farm, state)
      .filter((s) => s.kind === 'act')
      .map((s) => s.action)
      .find((a) => a.type === 'farm')?.crop;
  assert.equal(crop(), 'wheat');
  delete (w.settings as any).npcCropDemandBatches;
  assert.equal(crop(), 'wheat');
  Object.assign(w.settings, { npcCropDemandBatches: 1 });
  assert.equal(crop(), 'potatoes');
  Object.assign(w.settings, { npcCropDemandBatches: 0 });
  assert.equal(crop(), 'potatoes');
  buyer.stock.wheat = 0;
  assert.equal(crop(), 'wheat');
  buyer.investment = 0;
  assert.equal(crop(), 'potatoes');
});
