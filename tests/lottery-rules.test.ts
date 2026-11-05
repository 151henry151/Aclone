// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { tickLottery, LOTTERY_YEAR } from '../src/shared/lottery';
import { lotteryPanel } from '../src/client/lottery';
import { Store } from '../src/server/store';
function fixture() {
  const w = createWorld('lottery-rules', 'Lottery rules', 'owner');
  w.script = '';
  const p = addPlayer(w, 'owner', 'Owner');
  return { w, p };
}
const patch = (w: ReturnType<typeof fixture>['w'], lotteryDrawDays: number) =>
  act(w, 'owner', { type: 'settings', patch: { lotteryDrawDays } });

test('lottery defaults and missing fields preserve the 365-day boundary; custom schedules use world time', () => {
  assert.equal(LOTTERY_YEAR, 600 * 365);
  const { w } = fixture();
  assert.equal((w.settings as any).lotteryDrawDays, 365);
  w.settings.lotteryEnabled = true;
  for (const legacy of [false, true]) {
    delete w.lottery;
    if (legacy) delete (w.settings as any).lotteryDrawDays;
    w.time = 600 * 390;
    tickLottery(w);
    assert.equal(w.lottery!.drawAt, 600 * 730);
  }
  delete w.lottery;
  patch(w, 7);
  w.settings.dayLength = 0;
  w.settings.time = 86400;
  tickLottery(w);
  assert.equal(w.lottery!.drawAt, 600 * 392);
  assert.match(lotteryPanel(w, w.players.owner), /every 7 game days/);
});

test('paid rounds retain deadlines and money, then adopt the new period with bounded catch-up and exactly-once offline payment', () => {
  const { w, p } = fixture();
  p.cash = 10000;
  w.time = 0;
  w.settings.lotteryEnabled = true;
  patch(w, 7);
  act(w, p.id, { type: 'lottery', operation: 'tickets', amount: 3 });
  const round = structuredClone(w.lottery);
  patch(w, 3);
  assert.deepEqual(w.lottery, round);
  assert.equal(w.lottery!.drawAt, 7 * 600);
  p.online = false;
  w.settings.lotteryEnabled = false;
  w.time = 7 * 600 - 1;
  tickLottery(w, () => 0);
  assert.equal(p.cash, 9700);
  w.time++;
  tickLottery(w, () => 0);
  assert.equal(p.cash, 10000);
  assert.equal(w.lottery!.drawAt, 10 * 600);
  assert.equal(w.lottery!.history.length, 1);
  assert.equal(p.statistics?.earned, 300);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const copy = store.loadWorlds()[0].world;
    tickLottery(copy, () => 0);
    assert.equal(copy.players.owner.cash, 10000);
    assert.equal(copy.lottery!.history.length, 1);
  } finally {
    store.close();
  }
  w.lottery!.pot = 900;
  w.time = 600 * 1000;
  tickLottery(w, () => {
    throw Error('Empty draw must not choose a winner');
  });
  assert.equal(w.lottery!.pot, 900);
  assert.equal(w.lottery!.history.length, 2);
  assert.equal(w.lottery!.drawAt, 600 * 1003);
  tickLottery(w);
  assert.equal(w.lottery!.history.length, 2);
});

test('empty and disabled lottery panels quote the local schedule and preserve refusal behavior', () => {
  const { w, p } = fixture();
  patch(w, 7);
  w.time = 600 * 2;
  tickLottery(w);
  assert.equal(w.lottery, undefined);
  assert.match(lotteryPanel(w, p), /Draw in 5 game days/);
  assert.match(lotteryPanel(w, p), /No draws yet/);
  assert.match(lotteryPanel(w, p), /New entries are disabled/);
  assert.doesNotMatch(lotteryPanel(w, p), /365 game days|current year/);
  assert.throws(
    () => act(w, p.id, { type: 'lottery', operation: 'tickets', amount: 1 }),
    /no lottery/,
  );
  w.settings.lotteryEnabled = true;
  p.cash = 0;
  assert.throws(
    () => act(w, p.id, { type: 'lottery', operation: 'tickets', amount: 1 }),
    /Not enough cash/,
  );
  assert.equal(w.lottery!.pot, 0);
  assert.deepEqual(w.lottery!.tickets, {});
});

test('lottery schedule validates atomically and round trips through world-building surfaces', async () => {
  const { w, p } = fixture();
  for (const value of [0, -1, 1.5, 3651, NaN, Infinity]) {
    const before = structuredClone(w.settings);
    assert.throws(() => patch(w, value));
    assert.deepEqual(w.settings, before);
  }
  delete (w.settings as any).lotteryDrawDays;
  patch(w, 7);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  assert.match(settingsFields(w.settings), /name="lotteryDrawDays"[^>]*value="7"/);
  assert.match(rulesSummary(w), /lottery.*7 game days/i);
  const dest = createWorld('dest', 'Destination', 'other');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const observed = observe(
      w,
      p,
      { plan: [], index: 0 } as any,
      new NpcMemory(store),
      'resident',
    ).worldRules;
    for (const rules of [saved.settings, dest.settings, observed])
      assert.equal((rules as any).lotteryDrawDays, 7);
    const bad = structuredClone(exportDesign(w));
    (bad.settings as any).lotteryDrawDays = 0;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, bad));
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});

test('statistics recognize both historical annual prizes and newly labelled lottery prizes', async () => {
  const { w, p } = fixture();
  const { log } = await import('../src/shared/simulation');
  log(w, 'transfer', 100, 'lottery', p.id, 'Annual lottery prize');
  log(w, 'transfer', 200, 'lottery', p.id, 'Lottery prize');
  assert.equal(p.statistics?.earned, 300);
});
