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
import { adaptiveChoices } from '../src/server/npc/adaptive';
import { careerChoices } from '../src/server/npc/projects';
import { constructionChoices } from '../src/server/npc/construction-projects';
import { refreshOrders } from '../src/shared/procurement';
import { operationAction } from '../src/server/npc/player-operations';
import { worldResources } from '../src/shared/resources';
import { Store } from '../src/server/store';
import type { Step } from '../src/server/npc/decision';
import type { ResidentState } from '../src/server/npc/memory';
const defaults = {
  npcGeneralSupplyTarget: 3,
  npcConstructionLoadLimit: 20,
  npcParishSupplyLoadLimit: 20,
  npcGeneralTradeLoadLimit: 10,
  npcStorageDepositLoadLimit: 10,
  npcStorageWithdrawalLoadLimit: 5,
  npcRoomStorageLoadLimit: 3,
  npcCareerTradeLoadLimit: 1000,
};
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
const load = (choices: ReturnType<typeof adaptiveChoices>, prefix: string) => {
  const c = choices.find((c) => c.description.startsWith(prefix));
  if (!c) return undefined;
  for (const s of c.plan) {
    const a = s.kind === 'act' ? s.action : s.kind === 'operation' ? operationAction(s) : undefined;
    if (a && (a.type === 'trade' || a.type === 'stock' || a.type === 'lodging') && 'quantity' in a)
      return a.quantity;
  }
};
test('general cargo defaults and absent fields preserve distinct supply trade and storage loads', () => {
  for (const missing of [false, true]) {
    const { w, p, b, state } = setup();
    if (missing) for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
    else for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
    const choices = () => adaptiveChoices(w, p, state);
    assert.equal(load(choices(), 'Buy 3 Flour'), 3);
    assert.equal(load(choices(), 'Trade route:'), 10);
    assert.equal(load(choices(), 'Withdraw 5 bread'), 5);
    p.inventory.flour = 20;
    assert.equal(load(choices(), 'Store 10 flour'), 10);
    b.construction = { wood: 50 };
    p.inventory = {};
    assert.equal(transfers(constructionChoices(w, p)[0].plan)[0].quantity, 20);
  }
});
test('local general cargo policies and zeros preserve stock cash and one-item world limits', () => {
  const { w, p, b, state } = setup();
  const choices = () => adaptiveChoices(w, p, state);
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  edit({
    npcGeneralSupplyTarget: 2,
    npcGeneralTradeLoadLimit: 4,
    npcStorageDepositLoadLimit: 2,
    npcStorageWithdrawalLoadLimit: 2,
  });
  assert.equal(load(choices(), 'Buy 2 Flour'), 2);
  const supplier = w.buildings.find((b) => b.id === 'seller')!;
  supplier.sell.flour = 0;
  assert.equal(load(choices(), 'Buy 2 Flour'), 2);
  supplier.sell.flour = 100;
  assert.equal(load(choices(), 'Trade route:'), 4);
  assert.equal(load(choices(), 'Withdraw 2 bread'), 2);
  p.inventory.flour = 20;
  assert.equal(load(choices(), 'Store 2 flour'), 2);
  edit({ transactionItemLimit: 1 });
  assert.equal(load(choices(), 'Trade route:'), 1);
  assert.equal(load(choices(), 'Store 1 flour'), 1);
  edit({
    npcGeneralSupplyTarget: 0,
    npcGeneralTradeLoadLimit: 0,
    npcStorageDepositLoadLimit: 0,
    npcStorageWithdrawalLoadLimit: 0,
  });
  p.inventory = {};
  assert.ok(!choices().some((c) => /^Buy \d+ Flour/.test(c.description)));
  assert.equal(load(choices(), 'Trade route:'), undefined);
  assert.equal(load(choices(), 'Withdraw '), undefined);
  p.inventory.flour = 20;
  assert.equal(load(choices(), 'Store '), undefined);
  assert.equal(p.cash, 1000000);
  assert.equal(b.stock.bread, 30);
});
test('construction and career load policies support custom zeros and ordinary conserved delivery', () => {
  const { w, p, b, state } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { npcConstructionLoadLimit: 2, npcCareerTradeLoadLimit: 7 },
  });
  p.vehicle = 5;
  const trade = () =>
    careerChoices(w, p, state).filter(
      (c) => c.careerGoal?.kind === 'trade' && c.careerGoal.item === 'flour',
    );
  assert.equal(transfers(trade()[0].plan)[0].quantity, 7);
  b.construction = { wood: 50 };
  const build = constructionChoices(w, p)[0];
  assert.equal(transfers(build.plan)[0].quantity, 2);
  run(w, p, build.plan);
  assert.equal(b.construction.wood, 48);
  assert.equal(p.inventory.wood ?? 0, 0);
  act(w, p.id, {
    type: 'settings',
    patch: { npcConstructionLoadLimit: 0, npcCareerTradeLoadLimit: 0 },
  });
  assert.deepEqual(constructionChoices(w, p), []);
  assert.deepEqual(trade(), []);
});
test('room pantry has its own default custom and zero load policy', () => {
  const { w, p, state } = setup(),
    inn = makeBuilding('inn', 'bnb', 0, 0);
  w.buildings.push(inn);
  inn.owner = 'innkeeper';
  inn.lodging = { open: true, rate: 600, guests: {} };
  act(w, p.id, { type: 'lodging', building: inn.id, operation: 'rent', hours: 1 });
  p.inventory = { bread: 20, water: 20 };
  const room = () =>
    adaptiveChoices(w, p, state).filter(
      (c) => c.description.startsWith('deposit') && c.description.includes('bread'),
    );
  assert.equal(load(room(), 'deposit'), 3);
  delete (w.settings as any).npcRoomStorageLoadLimit;
  assert.equal(load(room(), 'deposit'), 3);
  act(w, p.id, { type: 'settings', patch: { npcRoomStorageLoadLimit: 2 } });
  assert.equal(load(room(), 'deposit'), 2);
  act(w, p.id, { type: 'settings', patch: { npcRoomStorageLoadLimit: 0 } });
  assert.deepEqual(room(), []);
});
test('parish supplier loads keep their default custom and zero policy without rewriting orders', () => {
  const w = createWorld('test', 'Town', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  p.cash = 1000000;
  p.inventory = {};
  p.hunger = p.thirst = 0;
  w.settings.parishOrders = true;
  w.settings.parishOrderShare = 1;
  refreshOrders(w);
  const order = w.procurement!.orders.find((o) => o.item === 'wood')!,
    source = w.buildings.find((b) => b.kind === 'sawmill')!;
  source.stock.wood = 100;
  source.sell.wood = 500;
  const state = memoryState(w, p),
    choices = () =>
      adaptiveChoices(w, p, state).filter((c) =>
        c.description.startsWith('Supply Replace public benches'),
      );
  assert.equal(load(choices(), 'Supply'), 20);
  delete (w.settings as any).npcParishSupplyLoadLimit;
  assert.equal(load(choices(), 'Supply'), 20);
  act(w, p.id, { type: 'settings', patch: { npcParishSupplyLoadLimit: 2 } });
  assert.equal(load(choices(), 'Supply'), 2);
  act(w, p.id, { type: 'settings', patch: { npcParishSupplyLoadLimit: 0 } });
  assert.deepEqual(choices(), []);
  assert.equal(order.delivered, 0);
});
test('cargo budget settings validate and survive editor summary observations designs and reload', async () => {
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

test('trading career preserves its larger default and absent-field load with sufficient actual capacity', () => {
  for (const missing of [false, true]) {
    const { w, p, buyer, state } = setup();
    w.vehicleTuning = { 0: { capacity: 3000 } };
    p.vehicle = 0;
    p.inventory = { flour: 1500 };
    buyer.capacity = 3000;
    buyer.investment = 1000000;
    if (missing) delete (w.settings as any).npcCareerTradeLoadLimit;
    const choice = careerChoices(w, p, state).find(
      (c) => c.careerGoal?.kind === 'trade' && c.careerGoal.item === 'flour',
    );
    assert.ok(choice);
    assert.equal(transfers(choice.plan)[0].quantity, 1000);
  }
});
