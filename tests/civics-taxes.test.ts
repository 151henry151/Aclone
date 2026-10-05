// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  makeBuilding,
  productionInterval,
} from '../src/shared/simulation.ts';
import { recipes } from '../src/shared/catalog.ts';
import { drySite } from './civics-helpers.ts';

function market(at: { x: number; z: number }) {
  const w = createWorld('tax', 'Tax', 'owner');
  w.settings.salesTax = 0.05;
  w.towns[0].salesTax = 0.1;
  const b = makeBuilding('shop', 'market', at.x, at.z);
  b.stock = { bread: 100 };
  w.buildings = [b];
  const p = addPlayer(w, 'p', 'Shopper');
  p.cash = 1_000_000;
  Object.assign(p, { x: b.x, z: b.z + 3 });
  return { w, p, b, town: w.towns[0] };
}

test('sales tax splits between the world sink and the town treasury', () => {
  const { w, p, b, town } = market({ x: 40, z: 60 });
  const investment = b.investment;
  act(w, p.id, { type: 'trade', building: b.id, item: 'bread', quantity: 10, direction: 'buy' });
  const total = b.sell.bread * 10;
  assert.equal(town.treasury, Math.floor(total * 0.1));
  assert.equal(
    b.investment - investment,
    total - Math.floor(total * 0.05) - Math.floor(total * 0.1),
  );
  const sunk = w.ledger.filter((e) => e.kind === 'sink').reduce((s, e) => s + e.amount, 0);
  assert.equal(sunk, Math.floor(total * 0.05));
});

test('shops outside every town pay only the world sales tax', () => {
  const probe = createWorld('probe', 'Probe', 'owner');
  const { w, p, b, town } = market(drySite(probe, 900));
  act(w, p.id, { type: 'trade', building: b.id, item: 'bread', quantity: 10, direction: 'buy' });
  assert.equal(town.treasury, 0);
});

test('town wage tax is withheld into the treasury on top of the world wage tax', () => {
  const w = createWorld('wages', 'Wages', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  w.settings.wageTax = 0.1;
  w.towns[0].wageTax = 0.2;
  const b = makeBuilding('mill', 'sawmill', 40, 60);
  const recipe = recipes[b.recipe!];
  b.investment = 10_000_000;
  b.stock = { ...recipe.inputs };
  w.buildings = [b];
  const worker = addPlayer(w, 'worker', 'Worker');
  Object.assign(worker, { x: b.x, z: b.z });
  worker.skills = [recipe.skill];
  act(w, worker.id, { type: 'job', building: b.id });
  const cash = worker.cash;
  advance(w, productionInterval(w, b));
  const world = Math.floor(b.wage * 0.1),
    local = Math.floor(b.wage * 0.2);
  assert.equal(worker.cash - cash, b.wage - world - local);
  assert.equal(w.towns[0].treasury, local);
});
