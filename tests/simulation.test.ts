// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  move,
  damage,
  money,
  terrainHeight,
} from '../src/shared/simulation.ts';

function setup() {
  const w = createWorld('test', 'Test World', 'owner', 'economy', 0);
  const p = addPlayer(w, 'owner', 'Ada');
  return { w, p };
}
test('currency uses exact integer hundredths of a denarius and configurable sheckles', () => {
  assert.equal(money(872600, 100), '87s 26d');
  assert.equal(money(1425, 14), '1s 0.25d');
});
test('purchase conserves money across player, investment and tax sink', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'market')!;
  p.x = b.x;
  p.z = b.z;
  const before = p.cash + b.investment;
  act(w, p.id, { type: 'trade', building: b.id, item: 'bread', quantity: 2, direction: 'buy' });
  assert.equal(p.inventory.bread, 4);
  assert.equal(
    before - p.cash - b.investment,
    w.ledger.filter((l) => l.kind === 'sink').reduce((s, l) => s + l.amount, 0),
  );
});
test('invalid quantities and unfunded purchases leave state untouched', () => {
  const { w, p } = setup();
  const b = w.buildings[0];
  p.x = b.x;
  p.z = b.z;
  for (const quantity of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER, NaN]) {
    const before = JSON.stringify(w);
    assert.throws(() =>
      act(w, p.id, { type: 'trade', building: b.id, item: 'bread', quantity, direction: 'buy' }),
    );
    assert.equal(JSON.stringify(w), before);
  }
});
test('distant building interaction and unprivileged commands are rejected', () => {
  const { w } = setup();
  const p = addPlayer(w, 'guest', 'Bob');
  p.x = 200;
  p.z = 200;
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'trade',
        building: w.buildings[0].id,
        item: 'bread',
        quantity: 1,
        direction: 'buy',
      }),
    /near/i,
  );
  assert.throws(() => act(w, p.id, { type: 'command', text: '*cash Bob 100' }), /authority/i);
  assert.throws(
    () => act(w, p.id, { type: 'settings', patch: { fighting: true } }),
    /owner|authority/i,
  );
});
test('production is persistent, consumes inputs, pays funded wages and cannot overflow storage', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.stock.wheat = 100;
  b.stock.flour = 0;
  b.investment = 100000;
  p.skills = ['miller'];
  p.job = b.id;
  b.employees = [p.id];
  p.activeUntil = 1e8;
  const cash = p.cash;
  advance(w, 600);
  assert.ok(b.stock.flour > 0);
  assert.ok(b.stock.wheat < 100);
  assert.ok(p.cash > cash);
  assert.ok(w.ledger.some((l) => l.reason === 'wage' && l.kind === 'transfer'));
  b.stock.flour = b.capacity;
  const wheat = b.stock.wheat;
  advance(w, 600);
  assert.equal(b.stock.wheat, wheat);
});
test('offline progression is deterministic across tick sizes', () => {
  const { w } = setup();
  const a = structuredClone(w),
    b = structuredClone(w);
  advance(a, 3600);
  for (let i = 0; i < 60; i++) advance(b, 60);
  assert.deepEqual(
    a.buildings.map((x) => x.stock),
    b.buildings.map((x) => x.stock),
  );
  assert.ok(Math.abs(a.players.owner.hunger - b.players.owner.hunger) < 1e-6);
});
test('tasks lock movement and pay only once when their timer completes', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'workhouse')!;
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, { type: 'task', building: b.id, task: 'labour' });
  const cash = p.cash,
    x = p.x;
  move(w, p, { throttle: 1, steer: 1, boost: true }, 1);
  assert.equal(p.x, x);
  advance(w, 16);
  assert.ok(p.cash > cash);
  const paid = p.cash;
  advance(w, 1);
  assert.equal(p.cash, paid);
});
test('armour halves damage at 200%; fighting and safe zones are authoritative', () => {
  assert.equal(damage(500, 200), 250);
  const { w, p } = setup();
  assert.throws(() => act(w, p.id, { type: 'fire', weapon: 'plasma' }), /fighting/i);
  w.settings.fighting = true;
  assert.throws(() => act(w, p.id, { type: 'fire', weapon: 'plasma' }), /safe/i);
});
test('hornball needs no weapons, supports six players and resets on a goal', () => {
  const { w } = setup();
  for (let i = 0; i < 6; i++) {
    const p = addPlayer(w, 'p' + i, 'Driver' + i);
    act(w, p.id, { type: 'joinGame', game: 'hornball' });
  }
  assert.equal(Object.values(w.players).filter((p) => p.game === 'hornball').length, 6);
  w.ball.x = 118;
  w.ball.z = 45;
  w.ball.vx = 10;
  advance(w, 1);
  assert.equal(w.scores[0] + w.scores[1], 1);
  assert.equal(w.ball.x, 90);
});
test('terrain is deterministic and editable without changing distant heights', () => {
  const { w } = setup();
  const initial = terrainHeight(w, 100, 100),
    far = terrainHeight(w, -100, -100);
  act(w, 'owner', { type: 'terrain', x: 100, z: 100, radius: 15, height: 5 });
  assert.equal(terrainHeight(w, 100, 100), initial + 5);
  assert.equal(terrainHeight(w, -100, -100), far);
});
test('home supplies feed online residents and exhaustion damages health', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'home')!;
  b.owner = p.id;
  p.home = b.id;
  p.atHome = true;
  p.online = true;
  b.stock.bread = 100;
  b.stock.water = 100;
  p.hunger = 49000;
  p.thirst = 49000;
  advance(w, 600);
  assert.ok(p.hunger < 49000);
  assert.ok(p.thirst < 49000);
  assert.ok(b.stock.bread < 100);
  p.atHome = false;
  p.hunger = 50000;
  p.thirst = 50000;
  const h = p.health;
  advance(w, 600);
  assert.ok(p.health < h);
});
