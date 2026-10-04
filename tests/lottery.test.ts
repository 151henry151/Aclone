// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { tickLottery, LOTTERY_YEAR } from '../src/shared/lottery.ts';
import { Store } from '../src/server/store.ts';
test('lottery conserves player money plus jackpot and pays offline winners exactly once', () => {
  const w = createWorld('lottery', 'Lottery', 'owner'),
    a = addPlayer(w, 'a', 'A'),
    b = addPlayer(w, 'b', 'B');
  w.settings.lotteryEnabled = true;
  a.cash = b.cash = 10000;
  act(w, a.id, { type: 'lottery', operation: 'tickets', amount: 3 });
  act(w, b.id, { type: 'lottery', operation: 'tickets', amount: 1 });
  act(w, b.id, { type: 'lottery', operation: 'fund', amount: 1000 });
  assert.equal(w.lottery?.pot, 1400);
  assert.equal(a.cash + b.cash + w.lottery!.pot, 20000);
  b.online = false;
  w.time = w.lottery!.drawAt;
  tickLottery(w, () => 0.99);
  assert.equal(b.cash, 10300);
  assert.equal(a.cash + b.cash, 20000);
  assert.equal(w.lottery?.history[0].winner, b.id);
  tickLottery(w);
  assert.equal(b.cash, 10300);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const copy = store.loadWorlds()[0].world;
    tickLottery(copy);
    assert.equal(copy.players.b.cash, b.cash);
  } finally {
    store.close();
  }
});
test('no-ticket pots carry across downtime; disabling new entries honours paid tickets', () => {
  const w = createWorld('carry', 'Carry', 'owner'),
    p = addPlayer(w, 'p', 'P');
  p.cash = 10000;
  w.settings.lotteryEnabled = true;
  act(w, p.id, { type: 'lottery', operation: 'fund', amount: 900 });
  w.time = LOTTERY_YEAR * 4;
  tickLottery(w);
  assert.equal(w.lottery?.pot, 900);
  assert.equal(w.lottery?.history.length, 1);
  assert.ok(w.lottery!.drawAt > w.time);
  act(w, p.id, { type: 'lottery', operation: 'tickets', amount: 1 });
  w.settings.lotteryEnabled = false;
  assert.throws(
    () => act(w, p.id, { type: 'lottery', operation: 'tickets', amount: 1 }),
    /no lottery/,
  );
  w.time = w.lottery!.drawAt;
  tickLottery(w, () => 0);
  assert.equal(p.cash, 10000);
  assert.equal(w.lottery?.pot, 0);
});
test('ticket prices freeze for a round and invalid entries cannot create money', () => {
  const w = createWorld('price', 'Price', 'owner'),
    p = addPlayer(w, 'p', 'P');
  w.settings.lotteryEnabled = true;
  p.cash = 100000;
  act(w, p.id, { type: 'lottery', operation: 'tickets', amount: 100 });
  w.settings.lotteryTicketPrice = 500;
  assert.equal(w.lottery!.price, 100);
  const before = JSON.stringify([p.cash, w.lottery]);
  for (const amount of [-1, 0, 1.5, Infinity, 101, 1])
    assert.throws(() => act(w, p.id, { type: 'lottery', operation: 'tickets', amount }));
  assert.equal(JSON.stringify([p.cash, w.lottery]), before);
  w.time = w.lottery!.drawAt;
  tickLottery(w, () => 0);
  assert.equal(w.lottery!.price, 500);
});
