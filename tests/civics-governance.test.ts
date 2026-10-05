// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import type { World } from '../src/shared/types.ts';

const DAY = 600;
function setup(governance: World['towns'][0]['governance'] = 'election') {
  const w = createWorld('gov', 'Gov', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  w.settings.maxAge = 1e6;
  const town = w.towns[0];
  town.governance = governance;
  const plinth = w.buildings.find((b) => b.id === town.plinth)!;
  const owner = addPlayer(w, 'owner', 'Owner');
  Object.assign(owner, { x: plinth.x, z: plinth.z + 5 });
  const resident = (id: string) => {
    const p = addPlayer(w, id, id.toUpperCase());
    p.cash = 1_000_000;
    Object.assign(p, { x: plinth.x, z: plinth.z + 5 });
    act(w, id, { type: 'town', building: plinth.id, operation: 'join' });
    return p;
  };
  const op = (id: string, operation: string, extra: Record<string, unknown> = {}) =>
    act(w, id, { type: 'town', building: plinth.id, operation, ...extra });
  return { w, town, plinth, owner, resident, op };
}

test('a mayor changes delegated rules; others, undelegated rules and excess taxes are refused', () => {
  const { w, town, resident, op } = setup('appointed');
  const mayor = resident('m');
  resident('r');
  town.mayor = mayor.id;
  op('m', 'rule', { rule: 'salesTax', value: 0.08 });
  assert.equal(town.salesTax, 0.08);
  assert.throws(() => op('r', 'rule', { rule: 'salesTax', value: 0 }), /mayor/);
  assert.throws(() => op('m', 'rule', { rule: 'wageTax', value: 0.9 }), /Invalid number/);
  w.townCharter = { controls: ['salesTax'] };
  assert.throws(() => op('m', 'rule', { rule: 'wageTax', value: 0.1 }), /world/);
  op('owner', 'rule', { rule: 'wageTax', value: 0.9 });
  assert.equal(town.wageTax, 0.9, 'the world owner overrides every rule and limit');
  assert.throws(() => op('m', 'tax', { tax: 0.04 }), /world/);
  assert.equal(town.tax, 0.02, 'construction tax is not delegated');
});

test('zoning, permissions, names and governance are validated rules', () => {
  const { w, town, resident, op } = setup('appointed');
  town.mayor = resident('m').id;
  op('m', 'rule', { rule: 'zoning', value: { north: ['advanced'], south: ['industrial'] } });
  assert.deepEqual(town.zoning, { north: ['advanced'], south: ['industrial'] });
  assert.throws(() => op('m', 'rule', { rule: 'zoning', value: { north: ['castles'] } }));
  const perms = {
    residents: { build: true, roads: true, environment: true },
    guests: { build: false, roads: false, environment: false },
  };
  op('m', 'rule', { rule: 'permissions', value: perms });
  assert.deepEqual(town.permissions, perms);
  op('m', 'rule', { rule: 'name', value: 'Puddlewick Magna' });
  assert.equal(town.name, 'Puddlewick Magna');
  assert.equal(w.buildings.find((b) => b.id === town.plinth)!.name, 'Puddlewick Magna');
  w.townCharter = { governance: ['appointed', 'direct'] };
  assert.throws(() => op('m', 'rule', { rule: 'governance', value: 'auction' }), /not permitted/);
  op('m', 'rule', { rule: 'governance', value: 'direct' });
  assert.equal(town.governance, 'direct');
  assert.equal(town.mayor, undefined);
});

test('tax changes wait for the charter notice period', () => {
  const { w, town, resident, op } = setup('appointed');
  town.mayor = resident('m').id;
  w.townCharter = { taxNoticeDays: 2 };
  op('m', 'rule', { rule: 'constructionTax', value: 0.35 });
  assert.equal(town.tax, 0.02);
  assert.deepEqual(town.pendingTaxes, [{ rule: 'constructionTax', value: 0.35, at: 2 * DAY }]);
  advance(w, DAY);
  assert.equal(town.tax, 0.02);
  advance(w, DAY);
  assert.equal(town.tax, 0.35);
  assert.deepEqual(town.pendingTaxes, []);
});

test('the mayor pays from the treasury, never more than it holds', () => {
  const { w, town, resident, op } = setup('appointed');
  const m = resident('m'),
    r = resident('r');
  town.mayor = m.id;
  town.treasury = 5000;
  const cash = r.cash;
  op('m', 'rule', { rule: 'treasury', value: { to: 'r', amount: 3000 } });
  assert.equal(r.cash, cash + 3000);
  assert.equal(town.treasury, 2000);
  assert.equal(w.ledger.at(-1)!.from, 'town:puddlewick');
  assert.throws(() => op('m', 'rule', { rule: 'treasury', value: { to: 'r', amount: 3000 } }));
});

test('an election opens, takes deposits and bribe budgets, votes and seats the winner', () => {
  const { w, town, resident, op } = setup('election');
  delete town.mayor;
  const a = resident('a'),
    b = resident('b'),
    voters = ['v1', 'v2', 'v3'].map(resident);
  advance(w, 1);
  assert.equal(town.election?.phase, 'registration');
  const outsider = addPlayer(w, 'x', 'X');
  Object.assign(outsider, { x: a.x, z: a.z });
  assert.throws(() => op('x', 'stand'), /resident/);
  const aCash = a.cash;
  op('a', 'stand', { bribe: 500, budget: 2000 });
  op('b', 'stand');
  assert.equal(a.cash, aCash - 4000 - 2000);
  assert.equal(town.treasury, 8000, 'deposits fund the treasury');
  assert.throws(() => op('v1', 'vote', { candidate: 'a' }), /voting/);
  advance(w, 30 * DAY);
  assert.equal(town.election?.phase, 'voting');
  assert.throws(() => op('v1', 'stand'), /registration/);
  const v1 = voters[0].cash;
  op('v1', 'vote', { candidate: 'a' });
  op('v2', 'vote', { candidate: 'a' });
  op('v3', 'vote', { candidate: 'b' });
  op('v3', 'vote', { candidate: 'a' });
  assert.throws(() => op('x', 'vote', { candidate: 'a' }), /resident/);
  assert.throws(() => op('v1', 'vote', { candidate: 'nobody' }), /candidate/);
  const before = a.cash;
  advance(w, 60 * DAY);
  assert.equal(town.mayor, 'a');
  assert.equal(town.election, undefined);
  assert.equal(town.termEnds, w.time + 365 * DAY);
  assert.equal(voters[0].cash, v1 + 500, 'supporters receive the promised bribe');
  assert.equal(a.cash, before + 500, 'unspent campaign budget is refunded');
  assert.equal(b.cash, 1_000_000 - 4000);
});

test('a town without residents holds no election', () => {
  const { w, town } = setup('election');
  delete town.mayor;
  advance(w, DAY);
  assert.equal(town.election, undefined);
});

test('an election with too few candidates is deferred', () => {
  const { w, town, resident, op } = setup('election');
  delete town.mayor;
  resident('a');
  advance(w, 1);
  op('a', 'stand');
  advance(w, 30 * DAY);
  assert.equal(town.election?.phase, 'registration');
  assert.equal(town.election?.deferrals, 1);
  assert.match(w.messages.at(-1)!.text, /deferred/);
});

test('a mayor serves until the term ends, then a new election opens', () => {
  const { w, town, resident } = setup('election');
  town.mayor = resident('m').id;
  advance(w, 1);
  assert.equal(town.election, undefined);
  assert.equal(town.termEnds, 1 + 365 * DAY);
  advance(w, 365 * DAY);
  assert.equal(w.towns[0].election?.phase, 'registration');
  assert.equal(town.mayor, 'm', 'the sitting mayor serves through the election');
});

test('a mayoral auction escrows bids, seats the highest bidder and refunds the rest', () => {
  const { w, town, resident, op } = setup('auction');
  delete town.mayor;
  const a = resident('a'),
    b = resident('b');
  advance(w, 1);
  op('a', 'stand', { bid: 7000 });
  op('b', 'stand', { bid: 5000 });
  op('b', 'stand', { bid: 9000 });
  assert.equal(b.cash, 1_000_000 - 9000);
  assert.throws(() => op('a', 'stand', { bid: 6000 }), /raise/);
  advance(w, 30 * DAY);
  assert.equal(town.mayor, 'b');
  assert.equal(town.treasury, 9000);
  assert.equal(a.cash, 1_000_000);
});

test('direct democracy passes proposals with a quorum and majority', () => {
  const { w, town, resident, op } = setup('direct');
  delete town.mayor;
  ['a', 'b', 'c', 'd'].forEach(resident);
  assert.throws(() => op('a', 'rule', { rule: 'salesTax', value: 0.1 }), /proposal/);
  op('a', 'propose', { rule: 'salesTax', value: 0.1 });
  const [proposal] = town.proposals;
  op('a', 'ballot', { proposal: proposal.id, support: true });
  op('b', 'ballot', { proposal: proposal.id, support: true });
  op('c', 'ballot', { proposal: proposal.id, support: false });
  advance(w, 7 * DAY);
  assert.equal(town.salesTax, 0.1);
  assert.deepEqual(town.proposals, []);
  op('a', 'propose', { rule: 'wageTax', value: 0.2 });
  w.townCharter = { quorum: 0.5 };
  op('a', 'ballot', { proposal: w.towns[0].proposals[0].id, support: true });
  advance(w, 7 * DAY);
  assert.equal(town.wageTax, 0, 'one vote in four misses a 50% quorum');
  assert.match(w.messages.at(-1)!.text, /failed/);
});

test('voters must have lived in town for the charter residency period', () => {
  const { w, town, resident, op } = setup('direct');
  w.townCharter = { voterResidencyDays: 3 };
  resident('a');
  op('a', 'propose', { rule: 'salesTax', value: 0.1 });
  assert.throws(
    () => op('a', 'ballot', { proposal: town.proposals[0].id, support: true }),
    /3 days/,
  );
});

test('a proprietor lists the town for sale and a buyer takes it over', () => {
  const { w, town, resident, op } = setup('proprietor');
  const seller = resident('s'),
    buyer = resident('b');
  town.mayor = seller.id;
  op('s', 'rule', { rule: 'sale', value: 70000 });
  assert.equal(town.forSale, 70000);
  op('b', 'buyTown');
  assert.equal(town.mayor, 'b');
  assert.equal(town.forSale, undefined);
  assert.equal(seller.cash, 1_000_000 + 70000);
  assert.equal(buyer.cash, 1_000_000 - 70000);
  assert.throws(() => op('s', 'buyTown'), /not for sale/);
});

test('appointed towns take their mayor from the world owner only', () => {
  const { w, town, resident, op } = setup('appointed');
  delete town.mayor;
  resident('a');
  advance(w, DAY);
  assert.equal(town.election, undefined);
  assert.throws(() => op('a', 'stand'), /election/);
  assert.throws(() => op('a', 'appoint', { player: 'a' }), /Owner/);
  op('owner', 'appoint', { player: 'a' });
  assert.equal(town.mayor, 'a');
  op('a', 'resign');
  assert.equal(town.mayor, undefined);
});
