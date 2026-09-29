// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, move, damage } from '../src/shared/simulation.ts';
import { runScript } from '../src/server/scripts.ts';
import { vehicles } from '../src/shared/catalog.ts';
function setup() {
  const w = createWorld('t', 'Testing', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  return { w, p };
}
test('all default settings can be submitted unchanged, including negative sea level', () => {
  const { w, p } = setup();
  assert.doesNotThrow(() => act(w, p.id, { type: 'settings', patch: w.settings }));
});
test('failed fishing join is atomic', () => {
  const { w, p } = setup();
  p.inventory.tackle = 0;
  const before = JSON.stringify(p);
  assert.throws(() => act(w, p.id, { type: 'joinGame', game: 'fishing' }));
  assert.equal(JSON.stringify(p), before);
});
test('same food repeatedly halves nutrition; fuel clamps rather than wraps', () => {
  const { w, p } = setup();
  p.inventory.bread = 6;
  p.hunger = 50000;
  for (let i = 0; i < 3; i++) act(w, p.id, { type: 'use', item: 'bread' });
  assert.equal(p.hunger, 10000);
  p.fuel = 63;
  p.inventory.fuel = 1;
  act(w, p.id, { type: 'use', item: 'fuel' });
  assert.equal(p.fuel, 64);
});
test('school charges once, gates slots, and completes a timed first lesson', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'school')!;
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, { type: 'learn', building: b.id, skill: 'miller' });
  const cash = p.cash;
  assert.throws(() => act(w, p.id, { type: 'learn', building: b.id, skill: 'baker' }));
  assert.equal(p.cash, cash);
  advance(w, 59);
  assert.equal(p.skills.length, 0);
  advance(w, 1);
  assert.deepEqual(p.skills, ['miller']);
});
test('sales require funded investment and carry limits prevent overloading', () => {
  const { w, p } = setup();
  const b = w.buildings[0];
  p.x = b.x;
  p.z = b.z;
  p.inventory.wood = 10;
  b.investment = 0;
  assert.throws(() =>
    act(w, p.id, { type: 'trade', building: b.id, direction: 'sell', item: 'wood', quantity: 1 }),
  );
  assert.equal(p.inventory.wood, 10);
  assert.throws(() =>
    act(w, p.id, { type: 'trade', building: b.id, direction: 'buy', item: 'cows', quantity: 40 }),
  );
});
test('bank transfers and building investment conserve cash', () => {
  const { w, p } = setup();
  const bank = w.buildings.find((b) => b.kind === 'bank')!;
  p.x = bank.x;
  p.z = bank.z;
  const cash = p.cash;
  act(w, p.id, { type: 'bank', building: bank.id, direction: 'deposit', amount: 1000 });
  assert.equal(p.cash + p.bank, cash);
  act(w, p.id, { type: 'bank', building: bank.id, direction: 'withdraw', amount: 1000 });
  assert.equal(p.cash, cash);
});
test('construction observes zones and material completion', () => {
  const { w, p } = setup();
  p.x = 120;
  p.z = -100;
  p.cash = 1000000;
  w.zones.push({ id: 'no', kind: 'noBuild', x: 120, z: -100, radius: 10 });
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }));
  w.zones.pop();
  act(w, p.id, { type: 'construct', kind: 'home' });
  const b = w.buildings.at(-1)!;
  assert.ok(b.construction);
  p.inventory.wood = 10;
  p.inventory.blocks = 5;
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.construction, undefined);
  assert.equal(p.inventory.wood, 0);
});
test('armour and five driving modes are finite and consume boosted fuel', () => {
  assert.equal(vehicles.length, 24);
  assert.equal(damage(6500, 100), 6500);
  for (const vehicle of [0, 1, 2, 3, 4]) {
    const { w, p } = setup();
    p.x = 100;
    p.z = 100;
    p.vehicle = vehicle;
    const fuel = p.fuel;
    for (let i = 0; i < 100; i++)
      move(w, p, { throttle: 1, steer: 0.3, boost: true, lift: 1 }, 0.05);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.speed));
    assert.ok(p.fuel <= fuel);
  }
});
test('a task cannot mint money by completing more than once', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'workhouse')!;
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, { type: 'task', building: b.id, task: 'labour' });
  assert.throws(() => act(w, p.id, { type: 'task', building: b.id, task: 'labour' }));
  advance(w, 16);
  const cash = p.cash;
  advance(w, 3600);
  assert.equal(p.cash, cash);
  assert.equal(w.ledger.filter((l) => l.reason === 'labour task').length, 1);
});
test('Lua worker executes real events and rejects runaway scripts without stalling simulation', async () => {
  const { w, p } = setup();
  const r = await runScript(
    w,
    'on("Custom", function(e) setvar("n",1); kudos(e.id,3); announce("Test") end)',
    'Custom',
    { id: p.id },
  );
  assert.equal(r.variables.n, 1);
  assert.equal(r.kudos[p.id], 3);
  assert.deepEqual(r.messages, ['Test']);
  await assert.rejects(runScript(w, 'while true do end', 'Custom', {}), /budget|deadline/);
});
test('survival death resets skills and estate, but retains cash', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  p.skills = ['miller'];
  p.health = 1;
  p.hunger = p.thirst = 50000;
  const cash = p.cash;
  advance(w, 1);
  assert.equal(p.age, 18);
  assert.equal(p.skills.length, 0);
  assert.equal(b.owner, undefined);
  assert.equal(b.investment, 0);
  assert.equal(p.cash, cash);
});

test('player-owned property sales transfer cash and require an explicit listing', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  const buyer = addPlayer(w, 'buyer', 'Buyer');
  buyer.x = b.x;
  buyer.z = b.z;
  p.x = b.x;
  p.z = b.z;
  assert.throws(() => act(w, buyer.id, { type: 'buyBuilding', building: b.id }));
  act(w, p.id, { type: 'listProperty', building: b.id, price: 100000 });
  const total = p.cash + buyer.cash;
  act(w, buyer.id, { type: 'buyBuilding', building: b.id });
  assert.equal(p.cash + buyer.cash, total);
  assert.equal(b.owner, buyer.id);
  assert.equal(b.forSale, false);
  assert.ok(w.ledger.some((l) => l.reason === 'property sale' && l.kind === 'transfer'));
});
test('unclaimed businesses cannot mint cash by purchasing and withdrawing seed capital', () => {
  const { w } = setup();
  assert.ok(w.buildings.filter((b) => !b.government).every((b) => b.investment === 0));
});
test('owned vehicles can be selected again without being charged twice', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'garage')!;
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, { type: 'vehicle', slot: 1, building: b.id });
  const cash = p.cash;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  act(w, p.id, { type: 'vehicle', slot: 1, building: b.id });
  assert.equal(p.cash, cash);
});
test('live custom production and vehicle physics stay local to their world', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, {
    type: 'production',
    building: b.id,
    inputs: { wheat: 1 },
    outputs: { flour: 2 },
    seconds: 10,
    skill: 'miller',
  });
  b.government = true;
  b.stock.wheat = 5;
  b.stock.flour = 0;
  advance(w, 10);
  assert.equal(b.stock.flour, 2);
  assert.equal(b.stock.wheat, 4);
  act(w, p.id, {
    type: 'vehicleTuning',
    slot: 0,
    speed: 7,
    acceleration: 3,
    turn: 1,
    armour: 200,
    fuel: 0.01,
  });
  assert.equal(w.vehicleTuning?.[0].speed, 7);
  const other = createWorld('other', 'Other', 'o');
  assert.equal(other.vehicleTuning?.[0], undefined);
});

test('money and count settings reject fractional values before changing the world', () => {
  const { w, p } = setup();
  for (const key of [
    'startingCash',
    'denariiPerSheckle',
    'maxBuildings',
    'importCap',
    'exchangeRate',
  ]) {
    const before = JSON.stringify(w.settings);
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { [key]: 2.5 } }));
    assert.equal(JSON.stringify(w.settings), before);
  }
});
