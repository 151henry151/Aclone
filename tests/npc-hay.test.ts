// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation.ts';
import { livestockSupplyInputs } from '../src/shared/livestock.ts';
import { recipes } from '../src/shared/catalog.ts';
import { farmDuty } from '../src/server/npc/farmer.ts';
import { stepSchema } from '../src/server/npc/decision.ts';
import { hayMerchantChoices } from '../src/server/npc/hay-merchant.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
test('farm workers can plan and validate harvests beyond the original four plots', () => {
  const w = createWorld('hay', 'Hay', 'p'),
    p = addPlayer(w, 'p', 'Farmer'),
    b = makeBuilding('farm', 'farm', 0, 0);
  b.owner = p.id;
  b.farmPlots = 8;
  b.investment = 100000;
  p.skills = ['farmer'];
  w.buildings = [b];
  b.plots = Array.from({ length: 8 }, () => ({
    crop: 'hay',
    planted: 0,
    ready: 10000,
    water: 3,
    fertilized: true,
  }));
  b.plots[7].ready = 0;
  const steps = farmDuty(w, p, b, { plan: [], index: 0 } as unknown as ResidentState);
  const harvest = steps.find((s) => s.kind === 'act' && s.action.type === 'farm');
  assert.ok(harvest && harvest.kind === 'act' && harvest.action.type === 'farm');
  assert.equal(harvest.action.plot, 7);
  assert.equal(harvest.action.operation, 'harvest');
  assert.doesNotThrow(() => stepSchema.parse(harvest));
});
test('observed affordable hay can replace feed supply errands without teaching omniscient quotes', () => {
  const w = createWorld('hay', 'Hay', 'p'),
    b = makeBuilding('cows', 'dairy', 0, 0),
    seller = makeBuilding('hay', 'haybarn', 10, 0);
  b.stock = { cows: 2, water: 20 };
  seller.stock = { hay: 20 };
  w.buildings = [b, seller];
  assert.deepEqual(livestockSupplyInputs(w, b, recipes.dairy.inputs), { hay: 2, water: 2 });
  w.buildings = [b];
  assert.deepEqual(livestockSupplyInputs(w, b, recipes.dairy.inputs), { feed: 2, water: 2 });
});
test('hay merchants generate funded, capacity-limited restocking plans and preserve living funds', () => {
  const w = createWorld('hay', 'Hay', 'p'),
    p = addPlayer(w, 'p', 'Trader'),
    b = makeBuilding('barn', 'haybarn', 0, 0),
    farm = makeBuilding('farm', 'farm', 20, 0),
    dairy = makeBuilding('dairy', 'dairy', 40, 0);
  b.owner = p.id;
  farm.stock = { hay: 100 };
  dairy.stock = { cows: 2 };
  dairy.investment = 100000;
  w.buildings = [b, farm, dairy];
  p.cash = 1000000;
  const choices = hayMerchantChoices(w, p);
  assert.ok(choices.some((c) => c.plan.some((s) => s.kind === 'act' && s.action.type === 'stock')));
  for (const c of choices) for (const s of c.plan) assert.doesNotThrow(() => stepSchema.parse(s));
  p.cash = 0;
  assert.equal(hayMerchantChoices(w, p).length, 0);
});
