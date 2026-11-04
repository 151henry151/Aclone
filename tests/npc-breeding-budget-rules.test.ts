// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { herdSpec } from '../src/shared/livestock';
import { enterpriseChoices } from '../src/server/npc/enterprise';
import { operationAction } from '../src/server/npc/player-operations';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = {
  npcBreedingCashThreshold: 15000,
  npcBreedingFeedReserve: 20,
  npcBreedingWaterReserve: 20,
  npcBreedingSpareAnimals: 2,
};
function setup() {
  const w = createWorld('owner-reserve', 'Owner reserve', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('dairy', 'dairy', 0, 0);
  w.buildings = [b];
  w.resources = {};
  w.roads = [];
  w.zones = [];
  w.settings.seaLevel = -10;
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  w.towns = [];
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(p, {
    cash: 100000,
    skills: ['livestock farmer'],
    fuel: 64,
    inventory: {},
    x: 0,
    z: 0,
    hunger: 0,
    thirst: 0,
  });
  Object.assign(b, {
    owner: p.id,
    investment: 15001,
    wage: 0,
    buy: {},
    sell: {},
    stock: { cows: 2, feed: 20, water: 20 },
    capacity: 100,
    pasture: { x: 20, z: 0, parcels: 1 },
  });
  const state: ResidentState = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Helpful',
    notebook: '',
    intent: '',
    cursor: 0,
    nextAt: 0,
    plan: [],
    index: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: 'Ready',
    errors: 0,
  };
  return {
    w,
    p,
    b,
    state,
    choices: () =>
      enterpriseChoices(w, p).filter((c) => c.description.startsWith('Breed a replacement')),
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
test('breeding policy defaults and absent fields preserve exact cash feed water and herd boundaries', () => {
  const { w, b, choices } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  assert.equal(choices().length, 1);
  b.investment = 15000;
  assert.deepEqual(choices(), []);
  b.investment++;
  b.stock.feed = 19;
  assert.deepEqual(choices(), []);
  b.stock.feed++;
  b.stock.water = 19;
  assert.deepEqual(choices(), []);
  b.stock.water++;
  b.stock.cows = 4;
  assert.deepEqual(choices(), []);
  b.stock.cows = 3;
  assert.equal(choices().length, 1);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(choices().length, 1);
});
test('breeding choices refuse an already full building even when pasture has room', () => {
  const { b, choices } = setup();
  b.capacity = 2;
  assert.deepEqual(choices(), []);
});
test('local breeding reserves vary independently and zero never waives actual fees rations or condition', () => {
  const { w, p, b, choices, edit } = setup();
  edit({
    npcBreedingCashThreshold: 3000,
    npcBreedingFeedReserve: 6,
    npcBreedingWaterReserve: 7,
    npcBreedingSpareAnimals: 1,
  });
  b.investment = 3000;
  b.stock.feed = 6;
  b.stock.water = 7;
  assert.deepEqual(choices(), []);
  b.investment++;
  assert.equal(choices().length, 1);
  b.stock.feed = 5;
  assert.deepEqual(choices(), []);
  b.stock.feed++;
  b.stock.water = 6;
  assert.deepEqual(choices(), []);
  b.stock.water++;
  b.stock.cows = 3;
  assert.deepEqual(choices(), []);
  b.stock.cows = 2;
  edit({ npcBreedingCashThreshold: 0, npcBreedingFeedReserve: 0, npcBreedingWaterReserve: 0 });
  b.stock.feed = 3;
  assert.deepEqual(choices(), []);
  b.stock.feed = 4;
  b.stock.water = 3;
  assert.deepEqual(choices(), []);
  b.stock.water = 4;
  b.investment = herdSpec(b)!.fee - 1;
  assert.deepEqual(choices(), []);
  b.investment++;
  b.herdCondition = 79;
  assert.deepEqual(choices(), []);
  b.herdCondition = 80;
  const choice = choices()[0];
  assert.ok(choice);
  assert.equal(b.breedingEnd, undefined);
  const cash = p.cash,
    fee = herdSpec(b)!.fee;
  for (const s of choice.plan) if (s.kind === 'operation') act(w, p.id, operationAction(s));
  assert.equal(p.cash, cash);
  assert.equal(b.investment, 0);
  assert.equal(b.stock.feed, 0);
  assert.equal(b.stock.water, 0);
  assert.equal(b.stock.cows, 2);
  assert.equal(b.breedingEnd, w.time + herdSpec(b)!.seconds);
  assert.equal(w.ledger.at(-1)?.amount, fee);
  assert.deepEqual(choices(), []);
  delete b.breedingEnd;
  b.investment = 15001;
  b.stock.feed = b.stock.water = 20;
  edit({ npcBreedingSpareAnimals: 0 });
  assert.deepEqual(choices(), []);
});
test('hay counts only for eligible herds and planning never starts breeding', () => {
  const { w, p, b, choices, edit } = setup();
  edit({ npcBreedingFeedReserve: 6 });
  b.stock.feed = 0;
  b.stock.hay = 6;
  const before = JSON.stringify({ cash: p.cash, stock: b.stock, investment: b.investment });
  assert.equal(choices().length, 1);
  assert.equal(b.breedingEnd, undefined);
  assert.equal(JSON.stringify({ cash: p.cash, stock: b.stock, investment: b.investment }), before);
  b.kind = 'piggery';
  b.recipe = 'piggery';
  b.stock.pigs = 2;
  assert.deepEqual(choices(), []);
  b.stock.feed = 6;
  assert.equal(choices().length, 1);
});
test('breeding budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state, edit } = setup();
  for (const k of Object.keys(defaults))
    for (const v of [-1, 0.5, k === 'npcBreedingCashThreshold' ? 100000001 : 10001]) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    npcBreedingCashThreshold: 12345,
    npcBreedingFeedReserve: 23,
    npcBreedingWaterReserve: 34,
    npcBreedingSpareAnimals: 5,
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
