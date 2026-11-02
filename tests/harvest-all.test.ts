// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { cropStatus, harvestOffer } from '../src/shared/farming.ts';

function ripePair() {
  const w = createWorld('ha', 'Harvest', 'o');
  const p = addPlayer(w, 'o', 'Farmer');
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  b.owner = p.id;
  b.investment = 100000;
  b.stock = {};
  p.skills.push('farmer');
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'wheat' });
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 1, crop: 'wheat' });
  advance(w, b.plots![0].ready - w.time);
  return { w, p, b };
}

test('harvest all takes half again as long as each plot and gathers every ripe plot', () => {
  const { w, p, b } = ripePair();
  const offer = harvestOffer(w, b, p);
  const expected = cropStatus(w, b, 0).yield + cropStatus(w, b, 1).yield;
  assert.equal(offer.percent, 100);
  assert.equal(offer.seconds, 45);
  assert.match(offer.note, /45 seconds/);
  assert.match(offer.note, /half again/);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvestAll' });
  assert.deepEqual(p.task?.plots, [0, 1]);
  assert.equal(p.task?.end, w.time + 45);
  assert.equal(b.plots![0].harvest?.player, p.id);
  assert.equal(b.plots![1].harvest?.player, p.id);
  advance(w, 15);
  assert.equal(b.stock.wheat, undefined);
  advance(w, 30);
  assert.equal(b.stock.wheat, expected);
  assert.equal(b.plots![0].crop, undefined);
  assert.equal(b.plots![1].crop, undefined);
  assert.equal(p.task, undefined);
});

test('a short stockroom harvests the share that fits and says so', () => {
  const { w, p, b } = ripePair();
  const one = cropStatus(w, b, 0).yield;
  b.capacity = one;
  const offer = harvestOffer(w, b, p);
  assert.equal(offer.percent, 50);
  assert.deepEqual(offer.plots, [0]);
  assert.match(offer.note, /room for 50%/);
  assert.match(offer.note, /only that share/);
  assert.match(offer.note, /22\.5 seconds/);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvestAll' });
  assert.deepEqual(p.task?.plots, [0]);
  assert.equal(b.plots![1].harvest, undefined);
  advance(w, 22.5);
  assert.equal(b.stock.wheat, one);
  assert.equal(b.plots![0].crop, undefined);
  assert.equal(b.plots![1].crop, 'wheat');
});

test('a full stockroom refuses harvest all and names the empty share', () => {
  const { w, p, b } = ripePair();
  b.stock.wheat = b.capacity;
  const offer = harvestOffer(w, b, p);
  assert.equal(offer.percent, 0);
  assert.match(offer.note, /0% of the ripe crops/);
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'harvestAll' }),
    /0% of the ripe crops/,
  );
  assert.equal(p.task, undefined);
  assert.equal(b.plots![0].crop, 'wheat');
});

test('harvest all leaves a crop that does not fit and takes one that does', () => {
  const { w, p, b } = ripePair();
  b.plots![1].crop = 'potatoes';
  b.stock.wheat = b.capacity;
  const offer = harvestOffer(w, b, p);
  assert.deepEqual(offer.plots, [1]);
  assert.ok(offer.percent > 0 && offer.percent < 100);
  assert.match(offer.note, /Wheat/);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvestAll' });
  advance(w, offer.seconds);
  assert.equal(b.plots![0].crop, 'wheat');
  assert.ok((b.stock.potatoes ?? 0) > 0);
});

test('paid harvest all stops when the till covers only some plots', () => {
  const { w, p, b } = ripePair();
  const hand = addPlayer(w, 'hand', 'Hand');
  hand.skills = ['farmer'];
  hand.x = b.x;
  hand.z = b.z;
  b.employees = [hand.id];
  b.wage = 1000;
  b.investment = 1000;
  const offer = harvestOffer(w, b, hand);
  assert.deepEqual(offer.plots, [0]);
  assert.match(offer.note, /wages for 1 of 2/);
  const cash = hand.cash;
  act(w, hand.id, { type: 'farm', building: b.id, operation: 'harvestAll' });
  advance(w, 22.5);
  assert.equal(hand.cash - cash, 1000 - Math.floor(1000 * w.settings.wageTax));
  assert.equal(b.plots![1].crop, 'wheat');
  assert.equal(b.investment, 0);
});
