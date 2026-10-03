// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { vehicles } from '../src/shared/catalog.ts';
import { giftAmount, refuellingStatus } from '../src/shared/player-aid.ts';
import { prepareFrame, DeltaStream } from '../src/server/snapshots.ts';
import { Store } from '../src/server/store.ts';
import type { Account } from '../src/server/universe.ts';
import type { Player } from '../src/shared/types.ts';
function setup() {
  const w = createWorld('aid', 'Aid', 'a');
  const a = addPlayer(w, 'a', 'Ada'),
    b = addPlayer(w, 'b', 'Bo');
  a.online = b.online = true;
  a.cash = 10000;
  b.cash = 500;
  a.speed = b.speed = 0;
  b.x = a.x + 5;
  b.z = a.z;
  b.y = a.y;
  a.inventory.fuel = 2;
  b.fuel = 0;
  return { w, a, b };
}
test('gifts conserve cash, create transfer ledger and private receipts, and persist', () => {
  const { w, a, b } = setup();
  b.x += 500; // Cash gifts need no proximity.
  act(w, a.id, { type: 'giveMoney', player: b.id, amount: 2575 });
  assert.equal(a.cash, 7425);
  assert.equal(b.cash, 3075);
  assert.equal(w.ledger.at(-1)!.kind, 'transfer');
  assert.equal(w.ledger.at(-1)!.amount, 2575);
  const c = addPlayer(w, 'c', 'Observer');
  c.online = true;
  for (const p of [a, b, c]) {
    const data = JSON.parse(new DeltaStream().encode(w, { id: p.id } as Account, prepareFrame(w)));
    const receipts = data.world.messages.filter((m: any) => m.name === 'Money gift');
    assert.equal(receipts.length, p === c ? 0 : 1);
    assert.ok(receipts.every((m: any) => m.to === p.id));
  }
  const store = new Store(':memory:');
  try {
    act(w, a.id, { type: 'refuelPlayer', player: b.id });
    assert.fail('Distant refuel should fail');
  } catch (e) {
    assert.match(String(e), /15 metres/);
  }
  b.x = a.x + 5;
  act(w, a.id, { type: 'refuelPlayer', player: b.id });
  try {
    delete w.settings.allowMoneyGifts;
    w.settings.allowPlayerRefuelling = false;
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal(loaded.players.a.cash, 7425);
    assert.equal(loaded.players.b.cash, 3075);
    assert.equal(loaded.players.b.fuel, 8);
    assert.equal(loaded.players.a.inventory.fuel, 1);
    assert.equal(loaded.settings.allowMoneyGifts, true);
    assert.equal(loaded.settings.allowPlayerRefuelling, false);
  } finally {
    store.close();
  }
});
test('gift amounts parse exact hundredths without silent rounding', () => {
  assert.equal(giftAmount('25.75'), 2575);
  assert.equal(giftAmount('0.01'), 1);
  assert.equal(giftAmount(' 10 '), 1000);
  for (const v of ['0', '-1', '1.001', '1e3', 'Infinity', 'NaN', '', '1000000.01'])
    assert.throws(() => giftAmount(v));
});
test('invalid gifts leave money and receipts untouched', () => {
  for (const amount of [-1, 0, 1.5, NaN, Infinity, 100000001, '100', 10001]) {
    const { w, a, b } = setup(),
      before = JSON.stringify(w);
    assert.throws(() => act(w, a.id, { type: 'giveMoney', player: b.id, amount }));
    assert.equal(JSON.stringify(w), before);
  }
  for (const scenario of ['self', 'missing', 'offline', 'senderOffline', 'disabled', 'overflow']) {
    const { w, a, b } = setup();
    let id = b.id;
    if (scenario === 'self') id = a.id;
    if (scenario === 'missing') id = 'elsewhere';
    if (scenario === 'offline') b.online = false;
    if (scenario === 'senderOffline') a.online = false;
    if (scenario === 'disabled') w.settings.allowMoneyGifts = false;
    if (scenario === 'overflow') b.cash = Number.MAX_SAFE_INTEGER;
    const before = JSON.stringify(w);
    assert.throws(() => act(w, a.id, { type: 'giveMoney', player: id, amount: 100 }));
    assert.equal(JSON.stringify(w), before);
  }
});
test('roadside help uses carried Fuel, rescues empty tanks and caps full tanks', () => {
  const { w, a, b } = setup();
  const ownFuel = a.fuel;
  act(w, a.id, { type: 'refuelPlayer', player: b.id });
  assert.equal(b.fuel, 8);
  assert.equal(a.inventory.fuel, 1);
  assert.equal(a.fuel, ownFuel);
  b.fuel = 61;
  act(w, a.id, { type: 'refuelPlayer', player: b.id });
  assert.equal(b.fuel, 64);
  assert.equal(a.inventory.fuel, 0);
  assert.equal(w.messages.at(-1)!.to, a.id);
  assert.match(w.messages.at(-1)!.text, /\+3 fuel/);
});
test('refuelling validates actual state even with a stale or forged readiness hint', () => {
  const cases: Array<(a: Player, b: Player) => void> = [
    (a) => {
      a.inventory.fuel = 0;
    },
    (a) => {
      a.speed = 2;
    },
    (_, b) => {
      b.speed = 2;
    },
    (a, b) => {
      b.x = a.x + 15;
    },
    (a, b) => {
      b.y = a.y + 4;
    },
    (_, b) => {
      b.online = false;
    },
    (a) => {
      a.online = false;
    },
    (_, b) => {
      b.fuel = 64;
      b.canReceiveFuel = true;
    },
    (_, b) => {
      b.fuel = NaN;
      b.canReceiveFuel = true;
    },
    (_, b) => {
      b.vehicle = vehicles.findIndex((v) => v.fuel === 0);
    },
    (a) => {
      a.atHome = true;
    },
    (_, b) => {
      b.atHome = true;
    },
    (a) => {
      a.hitch = 'someone';
    },
    (_, b) => {
      b.hitch = 'someone';
    },
    (a) => {
      a.game = 'fishing';
    },
    (_, b) => {
      b.game = 'fishing';
    },
    (_, b) => {
      b.task = { kind: 'labour', end: 100 };
    },
  ];
  for (const change of cases) {
    const { w, a, b } = setup();
    change(a, b);
    const before = JSON.stringify(w);
    assert.throws(() => act(w, a.id, { type: 'refuelPlayer', player: b.id }));
    assert.equal(JSON.stringify(w), before);
  }
  for (const target of ['a', 'missing']) {
    const { w, a } = setup();
    const before = JSON.stringify(w);
    assert.throws(() => act(w, a.id, { type: 'refuelPlayer', player: target }));
    assert.equal(JSON.stringify(w), before);
  }
});
test('world owners independently control gifts and roadside assistance', () => {
  const { w, a, b } = setup();
  assert.throws(() => act(w, b.id, { type: 'settings', patch: { allowMoneyGifts: false } }));
  act(w, a.id, {
    type: 'settings',
    patch: { allowMoneyGifts: false, allowPlayerRefuelling: false },
  });
  assert.throws(() => act(w, a.id, { type: 'giveMoney', player: b.id, amount: 100 }), /disabled/);
  assert.throws(() => act(w, a.id, { type: 'refuelPlayer', player: b.id }), /disabled/);
  act(w, a.id, { type: 'settings', patch: { allowPlayerRefuelling: true } });
  act(w, a.id, { type: 'refuelPlayer', player: b.id });
  assert.equal(w.settings.allowMoneyGifts, false);
});
test('public availability supports helpful UI without exposing fuel, inventory or cash', () => {
  const { w, a, b } = setup();
  const visible = () => JSON.parse(prepareFrame(w).players.b) as Player;
  const target = visible();
  assert.equal(target.canReceiveFuel, true);
  assert.equal(target.fuel, undefined);
  assert.equal(target.cash, undefined);
  assert.equal(target.inventory, undefined);
  assert.equal(refuellingStatus(w, a, target, true).reason, undefined);
  b.fuel = 64;
  assert.equal(visible().canReceiveFuel, false);
  assert.ok(refuellingStatus(w, a, visible(), true).reason);
});
