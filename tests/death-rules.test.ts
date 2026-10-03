// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance, act } from '../src/shared/simulation.ts';
import { loanQuote } from '../src/shared/loans.ts';
function setup() {
  const w = createWorld('rules', 'World', 'p'),
    p = addPlayer(w, 'p', 'Player');
  p.skills = ['miller'];
  p.inventory = { wheat: 3 };
  p.cash = 100000;
  p.bank = 20000;
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.stock = { flour: 5 };
  b.investment = 50000;
  return { w, p, b };
}
function die(w: ReturnType<typeof setup>['w'], p: ReturnType<typeof setup>['p']) {
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
  assert.equal(p.deaths, 1);
}
test('world owners can keep skills while releasing property, or retain all ordinary assets', () => {
  for (const keep of [false, true]) {
    const { w, p, b } = setup();
    w.settings.loseSkillsOnDeath = false;
    w.settings.losePropertyOnDeath = !keep;
    w.settings.loseInventoryOnDeath = !keep;
    w.settings.retainEstateContents = true;
    die(w, p);
    assert.deepEqual(p.skills, ['miller']);
    assert.equal(b.owner, keep ? p.id : undefined);
    assert.equal(b.stock.flour, 5);
    assert.equal(b.investment, 50000);
    assert.equal(p.inventory.wheat, keep ? 3 : undefined);
    assert.equal(p.cash, 100000);
    assert.equal(p.bank, 20000);
  }
});
test('cash/savings retention is configurable and losses are accounted for', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'settings', patch: { deathCashRetention: 0.75, deathBankRetention: 0.5 } });
  die(w, p);
  assert.equal(p.cash, 75000);
  assert.equal(p.bank, 10000);
  assert.equal(
    w.ledger.filter((e) => e.reason.startsWith('death ')).reduce((n, e) => n + e.amount, 0),
    35000,
  );
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { deathCashRetention: 1.1 } }));
});
test('survival-free worlds can enforce one inactivity consequence per absence', () => {
  const { w, p } = setup();
  w.settings.hungerRate = w.settings.thirstRate = 0;
  w.settings.maxOfflineDays = 1;
  p.hunger = p.thirst = 0;
  p.online = false;
  p.lastSeen = w.time;
  advance(w, 86399);
  assert.equal(p.deaths, 0);
  advance(w, 1);
  assert.equal(p.deaths, 1);
  advance(w, 86400);
  assert.equal(p.deaths, 1);
  p.online = true;
  advance(w, 1);
  p.online = false;
  advance(w, 86400);
  assert.equal(p.deaths, 2);
});
test('keeping property through death keeps its mortgage active instead of foreclosing', () => {
  const { w, p, b } = setup();
  p.cash = 1000000;
  w.settings.losePropertyOnDeath = false;
  const bank = w.buildings.find((b) => b.kind === 'bank')!;
  p.x = bank.x;
  p.z = bank.z;
  const q = loanQuote(w, p, bank, 10000, 12, b.id);
  assert.ok(q.approved);
  act(w, p.id, {
    type: 'loan',
    building: bank.id,
    operation: 'borrow',
    amount: 10000,
    months: 12,
    collateral: b.id,
    apr: q.apr,
    payment: q.payment,
    accepted: true,
  });
  die(w, p);
  assert.equal(p.loans![0].status, 'active');
  assert.equal(b.owner, p.id);
  assert.ok(b.lien);
});

test('offline catch-up applies the absence penalty at the same boundary as live ticks', () => {
  const { w, p } = setup();
  w.settings.maxOfflineDays = 100 / 86400;
  p.online = false;
  p.lastSeen = w.time;
  p.hunger = p.thirst = 0;
  const split = structuredClone(w);
  advance(w, 150);
  advance(split, 100);
  advance(split, 50);
  const other = split.players[p.id];
  for (const key of ['deaths', 'health', 'hunger', 'thirst', 'cash', 'bank'] as const)
    assert.equal(p[key], other[key], key);
  assert.equal(p.hunger, 5000 + w.settings.hungerRate * 50);
});
test('retained courses and jobs survive death while default job loss clears employment', () => {
  for (const keep of [false, true]) {
    const { w, p, b } = setup();
    delete b.owner;
    p.job = b.id;
    p.activeUntil = 1000;
    b.employees = [p.id];
    p.learning = { skill: 'baker', end: 1000 };
    w.settings.loseSkillsOnDeath = !keep;
    w.settings.loseJobOnDeath = !keep;
    die(w, p);
    assert.equal(p.job, keep ? b.id : undefined);
    assert.equal(b.employees.includes(p.id), keep);
    assert.equal(p.learning?.skill, keep ? 'baker' : undefined);
    assert.equal(p.activeUntil, keep ? 1000 : 0);
  }
});
