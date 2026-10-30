// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, log, advance } from '../src/shared/simulation';
import { awardBugBounty } from '../src/server/bug-bounties';
import { statisticsHtml } from '../src/client/reports';

test('bounties count awards, preserve cash history, and are idempotent after reload', () => {
  const w = createWorld('test', 'Test', 'owner');
  const p = addPlayer(w, 'p', 'Player');
  const cash = p.cash,
    received = p.statistics!.otherReceived;
  assert.equal(awardBugBounty(w, p, 'boat-refuel', 50000), true);
  assert.equal(p.cash, cash + 50000);
  assert.equal(p.statistics!.otherReceived, received + 50000);
  assert.equal(p.statistics!.bugBounties, 1);
  const saved = JSON.parse(JSON.stringify(w));
  const q = saved.players.p;
  assert.equal(awardBugBounty(saved, q, 'boat-refuel', 50000), false);
  assert.equal(q.cash, cash + 50000);
  assert.equal(awardBugBounty(saved, q, 'another-bug', 10000), true);
  assert.equal(q.statistics.bugBounties, 2);
  log(saved, 'transfer', 1000, 'friend', q.id, 'player gift');
  assert.equal(q.statistics.bugBounties, 2);
  q.online = true;
  q.age = saved.settings.maxAge + 1;
  advance(saved, 1);
  assert.equal(q.deaths, 1);
  assert.equal(q.statistics.bugBounties, 2);
  assert.match(statisticsHtml(saved, q), /Bug-bounty rewards received<\/dt><dd>2/);
  assert.throws(() => awardBugBounty(saved, q, 'bad', -1));
});

test('older players display zero bounties without resetting existing statistics', () => {
  const w = createWorld('test', 'Test', 'owner');
  const p = addPlayer(w, 'p', 'Player');
  assert.equal(p.statistics!.bugBounties, undefined);
  assert.match(statisticsHtml(w, p), /Bug-bounty rewards received<\/dt><dd>0/);
  delete p.statistics;
  assert.match(statisticsHtml(w, p), /Bug-bounty rewards received<\/dt><dd>0/);
});
