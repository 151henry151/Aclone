// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { travelPrep, drivePlan } from '../src/server/npc/travel.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { pricingChoices, sustainableAsk } from '../src/server/npc/pricing.ts';

const setup = () => {
  const w = createWorld('test', 'Test', 'server');
  const p = addPlayer(w, 'resident', 'Resident');
  return { w, p };
};

test('walking residents remount AND start the engine, including after refuelling; repeated preparation never toggles it off', () => {
  const { w, p } = setup();
  for (const planner of [travelPrep, (p: ReturnType<typeof addPlayer>) => drivePlan(w, p)]) {
    p.vehicle = 5;
    p.engine = false;
    p.fuel = 25;
    for (const s of planner(p)) if (s.kind === 'act') act(w, p.id, s.action);
    assert.equal(p.vehicle, 0);
    assert.equal(p.engine, true);
    for (const s of planner(p)) if (s.kind === 'act') act(w, p.id, s.action);
    assert.equal(p.engine, true);
  }
  p.vehicle = 5;
  p.fuel = 0;
  p.engine = false;
  p.inventory.fuel = 1;
  for (const s of travelPrep(p)) if (s.kind === 'act') act(w, p.id, s.action);
  assert.equal(p.vehicle, 0);
  assert.equal(p.engine, true);
  assert.ok(p.fuel > 0);
});

test('surplus farm markdown leaves transport profit, respects costs and requires a funded buyer', () => {
  const { w, p } = setup();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  const market = w.buildings.find((b) => b.kind === 'market')!;
  farm.owner = p.id;
  farm.stock.hops = farm.capacity;
  farm.sell.hops = 1200;
  farm.wage = 1000;
  for (const b of w.buildings) delete b.buy.hops;
  market.buy.hops = 1080;
  market.stock.hops = 0;
  market.investment = 100000;
  p.x = farm.x;
  p.z = farm.z;
  const option = pricingChoices(w, p).find((c) => c.id.endsWith('_hops'))!;
  assert.ok(option);
  const step = option.plan.at(-1)!;
  assert.equal(step.kind, 'operation');
  if (step.kind !== 'operation') return;
  act(w, p.id, operationAction(step));
  assert.ok(farm.sell.hops < market.buy.hops);
  assert.ok(farm.sell.hops >= sustainableAsk(w, farm, 'hops')!);
  assert.ok(
    !pricingChoices(w, p).some((c) => c.id.endsWith('_hops')),
    'no repeated markdown at same quote',
  );
  farm.sell.hops = 1200;
  market.investment = 1080;
  assert.ok(!pricingChoices(w, p).some((c) => c.id.endsWith('_hops')));
  market.investment = 100000;
  farm.wage = 1000000;
  assert.ok(
    !pricingChoices(w, p).some((c) => c.id.endsWith('_hops')),
    'never price below replacement costs',
  );
});
