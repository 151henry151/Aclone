import type { Step } from '../src/server/npc/decision';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { spaceChoices, spaceAction, exchange } from '../src/server/npc/space';
import { operationAction } from '../src/server/npc/player-operations';
import { spaceGoods, stationPrice } from '../src/shared/galaxy';
import { Store } from '../src/server/store';
import { Universe } from '../src/server/universe';
import { Residents } from '../src/server/npc/residents';
import { npcConfigSchema } from '../src/server/npc/config';
import type { ResidentState } from '../src/server/npc/memory';
import type { FarmerChoice } from '../src/server/npc/farmer';
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

const defaults = {
  npcExchangeCashReserve: 20000,
  npcExchangeCreditLoad: 10,
  npcAccountTradeCreditReserve: 10,
  npcAccountTradeBuyLoad: 5,
  npcAccountTradeSellLoad: 100,
};
const invalidValues = {
  npcExchangeCashReserve: [-1, 0.5, 100000001],
  npcExchangeCreditLoad: [-1, 0.5, 1000001],
  npcAccountTradeCreditReserve: [-1, 0.5, 1000001],
  npcAccountTradeBuyLoad: [-1, 0.5, 10001],
  npcAccountTradeSellLoad: [-1, 0.5, 10001],
};
function localSetup() {
  const w = createWorld('puddlewick', 'Town', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  Object.assign(w.settings, { seaLevel: -10, hungerRate: 0, thirstRate: 0 });
  return { w, p, state: memoryState(w, p) };
}
function setup() {
  const { w, p, state } = localSetup(),
    store = new Store(':memory:'),
    u = new Universe(store),
    { account: a } = u.register('Budget Account');
  a.credits = 100000;
  a.ship = 'alien';
  u.save(a);
  return { w, p, state, store, u, a, worlds: new Map([[w.id, w]]) };
}
function trade(choices: FarmerChoice[], buy: boolean) {
  return choices
    .flatMap((c) => c.plan)
    .filter(
      (s): s is Extract<Step, { kind: 'operation' }> =>
        s.kind === 'operation' && s.operation === 'spaceTrade',
    )
    .map(operationAction)
    .find((a) => a.item === spaceGoods[0] && a.buy === buy);
}
test('account trade defaults and missing fields retain quantities and credit cushion', () => {
  const { w, store, u, a, worlds } = setup();
  try {
    for (const missing of [false, true]) {
      for (const [k, v] of Object.entries(defaults)) {
        if (missing) delete (w.settings as any)[k];
        else assert.equal((w.settings as any)[k], v, k);
      }
      a.cargo = {};
      a.credits = 100000;
      assert.equal(trade(spaceChoices(a, worlds, u, w.settings), true)?.quantity, 5);
      a.cargo = { [spaceGoods[0]]: 120 };
      assert.equal(trade(spaceChoices(a, worlds, u, w.settings), false)?.quantity, 100);
      a.cargo = {};
      a.credits = stationPrice(a.system, spaceGoods[0]).buy + 9;
      assert.equal(trade(spaceChoices(a, worlds, u, w.settings), true), undefined);
      a.credits++;
      assert.equal(trade(spaceChoices(a, worlds, u, w.settings), true)?.quantity, 1);
    }
  } finally {
    store.close();
  }
});
test('account trade budgets honor custom zero limits actual cargo and ordinary paid transfers', () => {
  const { w, store, u, a, worlds } = setup();
  try {
    Object.assign(w.settings, {
      npcAccountTradeCreditReserve: 20,
      npcAccountTradeBuyLoad: 2,
      npcAccountTradeSellLoad: 3,
    });
    const choices = () => spaceChoices(a, worlds, u, w.settings),
      item = spaceGoods[0],
      price = stationPrice(a.system, item);
    a.credits = price.buy + 19;
    assert.equal(trade(choices(), true), undefined);
    a.credits = 100000;
    u.save(a);
    const buy = trade(choices(), true)!;
    assert.equal(buy.quantity, 2);
    const stock = u.market(a.system).stock[item],
      cash = a.credits;
    spaceAction(u, a, buy);
    assert.equal(a.cargo[item], 2);
    assert.equal(a.credits, cash - 2 * price.buy);
    assert.equal(u.market(a.system).stock[item], stock - 2);
    a.cargo[item] = 120;
    u.save(a);
    const sell = trade(choices(), false)!;
    assert.equal(sell.quantity, 3);
    const before = a.credits;
    spaceAction(u, a, sell);
    assert.equal(a.cargo[item], 117);
    assert.equal(a.credits, before + 3 * price.sell);
    Object.assign(w.settings, { npcAccountTradeBuyLoad: 0, npcAccountTradeSellLoad: 0 });
    assert.equal(trade(choices(), true), undefined);
    assert.equal(trade(choices(), false), undefined);
    // A zero reserve still requires the actual purchase price and free hold space.
    Object.assign(w.settings, { npcAccountTradeBuyLoad: 5, npcAccountTradeCreditReserve: 0 });
    a.cargo = {};
    a.credits = price.buy;
    assert.equal(trade(choices(), true)?.quantity, 1);
    a.cargo = { [item]: 120 };
    assert.equal(trade(choices(), true), undefined);
    a.cargo = {};
    a.credits = price.buy - 1;
    assert.equal(trade(choices(), true), undefined);
  } finally {
    store.close();
  }
});
test('large account budgets retain the ordinary trade cap and courier hold reservation', () => {
  const { w, store, u, a, worlds } = setup();
  try {
    Object.assign(w.settings, { npcAccountTradeBuyLoad: 10000, npcAccountTradeSellLoad: 10000 });
    const item = spaceGoods[0],
      choices = () => spaceChoices(a, worlds, u, w.settings);
    assert.equal(trade(choices(), true)?.quantity, 100);
    a.cargo = { [item]: 120 };
    assert.equal(trade(choices(), false)?.quantity, 100);
    a.cargo = { [item]: 100 };
    a.mission = { origin: a.system, destination: 'brindle', reward: 10, quantity: 15 };
    assert.equal(trade(choices(), true)?.quantity, 5);
  } finally {
    store.close();
  }
});
test('resident conversion and off-world choices use the current or saved last local world', async () => {
  const { w, p } = localSetup(),
    other = createWorld('other', 'Other', 'owner'),
    store = new Store(':memory:'),
    u = new Universe(store),
    worlds = new Map([
      [w.id, w],
      [other.id, other],
    ]);
  const config = npcConfigSchema.parse({ world: w.id, homeWorldOnly: false });
  const options = [
    {
      config,
      brain: {
        async decide() {
          throw Error('No provider calls in this test');
        },
      },
    },
  ];
  let rs = new Residents(store, u, worlds, options);
  try {
    let resident = (rs as any).residents[0];
    const pilot = w.players[resident.state.playerId];
    const port = makeBuilding('port', 'starport', 0, 0);
    Object.assign(port, { government: true, stock: {}, buy: {}, sell: {} });
    w.buildings = [port];
    w.settings.maxBuildings = 0;
    w.resources = {};
    w.towns = [];
    Object.assign(pilot, {
      x: 0,
      z: 0,
      hunger: 0,
      thirst: 0,
      fuel: 64,
      cash: 1000000,
      inventory: {},
    });
    const choices = async () =>
      (await (rs as any).choices(
        resident,
        w,
        pilot,
        new AbortController().signal,
      )) as FarmerChoice[];
    const conversion = async () =>
      (await choices())
        .find((c) => c.id === 'space_exchange')
        ?.plan.filter(
          (s): s is Extract<Step, { kind: 'operation' }> =>
            s.kind === 'operation' && s.operation === 'exchange',
        )
        .map(operationAction)[0];
    assert.equal((await conversion())?.amount, 10);
    delete (w.settings as any).npcExchangeCashReserve;
    delete (w.settings as any).npcExchangeCreditLoad;
    assert.equal((await conversion())?.amount, 10);
    Object.assign(w.settings, { npcExchangeCashReserve: 5000, npcExchangeCreditLoad: 3 });
    const unit = w.settings.exchangeRate * 100;
    pilot.cash = 5000 + 2 * unit;
    assert.equal((await conversion())?.amount, 2);
    pilot.cash = 5000 + 5 * unit;
    assert.equal((await conversion())?.amount, 3);
    const a = (rs as any).account(resident);
    a.exchanged[w.id] = { day: Math.floor(w.time / 86400), amount: w.settings.exchangeCap - 1 };
    u.save(a);
    assert.equal((await conversion())?.amount, 1);
    const before = pilot.cash;
    exchange(w, pilot, a, Number((await conversion())!.amount));
    u.save(a);
    assert.equal(pilot.cash, before - unit);
    assert.equal(await conversion(), undefined);
    a.exchanged = {};
    u.save(a);
    Object.assign(w.settings, { npcExchangeCreditLoad: 0 });
    assert.equal(await conversion(), undefined);
    Object.assign(w.settings, { npcExchangeCashReserve: 0, npcExchangeCreditLoad: 3 });
    pilot.cash = unit;
    assert.equal((await conversion())?.amount, 1);
    Object.assign(w.settings, { npcAccountTradeBuyLoad: 2, npcAccountTradeCreditReserve: 0 });
    Object.assign(other.settings, { npcAccountTradeBuyLoad: 4, npcAccountTradeCreditReserve: 0 });
    a.credits = 100000;
    u.save(a);
    resident.state.inSpace = true;
    assert.equal(trade(await choices(), true)?.quantity, 2);
    resident.state.world = other.id;
    addPlayer(other, a.id, a.name);
    rs.memory.save(config.id, resident.state);
    rs.close();
    rs = new Residents(store, u, worlds, options);
    resident = (rs as any).residents[0];
    assert.equal(resident.state.world, other.id);
    const away = (await (rs as any).choices(
      resident,
      other,
      other.players[a.id],
      new AbortController().signal,
    )) as FarmerChoice[];
    assert.equal(trade(away, true)?.quantity, 4);
    assert.equal(
      trade(spaceChoices(a, worlds, u), true)?.quantity,
      5,
      'context-free callers keep named defaults',
    );
  } finally {
    rs.close();
    store.close();
  }
});
test('account budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state } = localSetup();
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  for (const [k, invalid] of Object.entries(invalidValues))
    for (const v of invalid) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    npcExchangeCashReserve: 2345,
    npcExchangeCreditLoad: 3,
    npcAccountTradeCreditReserve: 15,
    npcAccountTradeBuyLoad: 2,
    npcAccountTradeSellLoad: 4,
  };
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
