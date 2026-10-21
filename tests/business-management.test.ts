// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { hiringLimit, jobVacancy } from '../src/shared/staffing.ts';
import { businessEconomics } from '../src/shared/business-economics.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { ownerStaffingRoutine } from '../src/server/npc/business-policy.ts';

function setup() {
  const w = createWorld('test', 'Test', 'server');
  const owner = addPlayer(w, 'owner', 'BioHaze');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = owner.id;
  owner.x = b.x;
  owner.z = b.z + 12;
  w.settings.activeWork = false;
  w.settings.ownerOperation = false;
  w.settings.salesTax = 0;
  w.towns.forEach((t) => (t.salesTax = 0));
  b.buy = { wheat: 600 };
  b.sell = { flour: 3000 };
  b.wage = 1000;
  const workers = Array.from({ length: 3 }, (_, i) => addPlayer(w, 'worker' + i, 'Worker ' + i));
  workers.forEach((p) => {
    p.x = owner.x;
    p.z = owner.z;
    p.skills = ['miller'];
  });
  return { w, owner, b, workers };
}
test('hiring limits are server enforced and dismissals prevent immediate rehiring', () => {
  const { w, owner, b, workers } = setup();
  const action = (id: string, a: { type: string; [key: string]: unknown }) =>
    act(w, id, { building: b.id, ...a });
  assert.equal(hiringLimit(w, b), 2);
  workers.slice(0, 2).forEach((p) => action(p.id, { type: 'job' }));
  assert.throws(() => action(workers[2].id, { type: 'job' }), /limit 2/);
  assert.throws(() => action(workers[2].id, { type: 'staffing', limit: 0 }), /own/i);
  action(owner.id, { type: 'staffing', limit: 0 });
  assert.equal(b.employees.length, 2, 'lowering does not fire');
  action(workers[0].id, { type: 'job' }); // renewal still allowed
  assert.throws(
    () => action(owner.id, { type: 'staffing', limit: -1, dismiss: workers[0].id }),
    /range|number|invalid/i,
  );
  assert.equal(b.employees.length, 2, 'invalid input is atomic');
  action(owner.id, { type: 'staffing', dismiss: workers[0].id });
  assert.equal(workers[0].job, undefined);
  assert.equal(w.messages.at(-1)?.to, workers[0].id);
  action(owner.id, { type: 'staffing', automatic: true });
  assert.equal(hiringLimit(w, b), 2);
  assert.equal(jobVacancy(w, b, workers[0].id), false);
  assert.throws(() => action(workers[0].id, { type: 'job' }), /dismissed/);
  w.time += 3600;
  action(workers[0].id, { type: 'job' });
  assert.equal(workers[0].job, b.id);
  w.settings.ownerOperation = true;
  owner.skills = ['miller'];
  assert.equal(hiringLimit(w, b), 1, 'working owner fills one place');
});
test('staffing respects in-progress tasks and farm harvest pay has no hourly forecast', () => {
  const { w, owner, b, workers } = setup();
  const p = workers[0];
  act(w, p.id, { type: 'job', building: b.id });
  p.task = { kind: 'labour', building: b.id, ends: w.time + 15 } as any;
  assert.throws(
    () => act(w, owner.id, { type: 'staffing', building: b.id, dismiss: p.id }),
    /finishes/,
  );
  assert.equal(p.job, b.id);
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  assert.equal(hiringLimit(w, farm), 16);
  assert.equal(businessEconomics(w, farm), null);
});
test('batch and hourly margins distinguish staffing cost from production speed and unpaid owner work', () => {
  const { w, owner, b, workers } = setup();
  b.employees = [workers[0].id];
  workers[0].job = b.id;
  let e = businessEconomics(w, b)!;
  assert.equal(e.current.margin, 5000);
  assert.equal(e.current.profitPerHour, 15000);
  assert.equal(e.bestPaidWorkers, 2, 'two workers make less per batch but more per hour');
  w.settings.ownerOperation = true;
  owner.skills = ['miller'];
  e = businessEconomics(w, b)!;
  assert.equal(e.current.payroll, 1000);
  assert.equal(e.current.efficiency, 1);
  assert.equal(e.current.profitPerHour, 30000);
  assert.equal(e.bestPaidWorkers, 1);
  b.wage = 4000;
  assert.equal(businessEconomics(w, b)!.bestPaidWorkers, 0, 'unpaid owner can operate alone');
  delete b.buy.wheat;
  b.pausedPrices = { buy: { wheat: 600 } };
  assert.equal(businessEconomics(w, b)!.inputs, 3000, 'paused bid is a replacement-cost estimate');
  delete b.sell.flour;
  assert.equal(businessEconomics(w, b)!.hourlyReliable, false);
});
test('NPC owner plans adjust limits and dismiss excess workers using hourly margins', () => {
  const { w, owner, b, workers } = setup();
  b.hiringLimit = 16;
  b.employees = workers.map((p) => p.id);
  workers.forEach((p) => (p.job = b.id));
  const plan = ownerStaffingRoutine(w, owner);
  const actions = plan.flatMap((s) => (s.kind === 'operation' ? [operationAction(s)] : []));
  assert.deepEqual(
    actions.map((a) => a.type),
    ['staffing', 'staffing'],
  );
  assert.equal(actions[0].limit, 2);
  assert.equal(actions[1].dismiss, workers[2].id);
  actions.forEach((a) => act(w, owner.id, a));
  assert.equal(b.employees.length, 2);
  assert.equal(ownerStaffingRoutine(w, owner).length, 0);
});
