// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { workplace } from '../src/server/npc/workplace.ts';

function millFixture() {
  const w = createWorld('test', 'Test parish', 'owner');
  const p = addPlayer(w, 'mabel', 'Mabel');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = 'owner';
  b.stock = { wheat: 12, flour: 29 };
  b.investment = 1459;
  b.wage = 2200;
  p.skills = ['miller'];
  p.x = b.x;
  p.z = b.z;
  w.time = 590;
  return { w, p, b };
}

test('mill diagnosis separates stored inputs, employment and prospective wage funding', () => {
  const { w, p, b } = millFixture();
  const report = workplace(w, p, b)!;
  assert.equal(report.mode, 'automatic');
  assert.equal(report.employedHere, false);
  assert.equal(report.canTakeJob, true);
  assert.equal(report.nextCycleInSeconds, 10);
  assert.deepEqual(report.recipe.inputs, { wheat: 5 });
  assert.deepEqual(report.ifYouWork, { wagesRequired: 2200, capitalShortfall: 741 });
  assert.equal(
    report.blockers.some((s) => s.includes('wheat')),
    false,
  );
  assert.equal(report.inputSource, 'building stockroom');
  assert.equal(report.outputDestination, 'building stockroom');
});

test('reported production boundary matches real flour and employee wages without personal wheat', () => {
  const { w, p, b } = millFixture();
  b.investment = 11000;
  const cash = p.cash;
  act(w, p.id, { type: 'job', building: b.id });
  act(w, p.id, { type: 'work', building: b.id });
  const report = workplace(w, p, b)!;
  assert.equal(report.employedHere, true);
  assert.equal(report.workActive, true);
  assert.equal(report.activeEmployeesNextCycle, 1);
  assert.deepEqual(report.blockers, []);
  advance(w, 10);
  assert.equal(b.stock.wheat, 7);
  assert.equal(b.stock.flour, 32);
  assert.equal(p.inventory.wheat, undefined);
  assert.equal(p.cash, cash + 1980);
  assert.equal(b.investment, 8800);
});

test('custom recipes, expiring shifts, missing stock and output capacity reflect live rules', () => {
  const { w, p, b } = millFixture();
  b.production = {
    inputs: { wheat: 9 },
    outputs: { flour: 5 },
    skill: 'miller',
    seconds: 30,
    tier: 0,
  };
  b.employees = [p.id];
  p.job = b.id;
  p.activeUntil = 599;
  b.stock = { wheat: 8, flour: 498 };
  const report = workplace(w, p, b)!;
  assert.equal(report.intervalSeconds, 30);
  assert.equal(report.activeEmployeesNextCycle, 0);
  assert.equal(report.workActive, true);
  assert.ok(report.blockers.some((s) => s.includes('wheat')));
  assert.ok(report.blockers.some((s) => s.includes('flour')));
  assert.equal(report.ifYouWork.capitalShortfall, 741);
  w.settings.activeWork = false;
  assert.equal(workplace(w, p, b)!.activeEmployeesNextCycle, 1);
  b.owner = p.id;
  assert.equal(workplace(w, p, b)!.canTakeJob, false);
});

test('farms are plots rather than automatic legacy wheat factories', () => {
  const { w, p } = millFixture();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  assert.equal(workplace(w, p, farm)!.mode, 'seasonal plots');
  assert.equal(
    workplace(
      w,
      p,
      w.buildings.find((b) => b.kind === 'workhouse')!,
    ),
    undefined,
  );
});

test('expired employment is explicit: waiting cannot renew the shift', () => {
  const { w, p, b } = millFixture();
  b.investment = 20000;
  b.employees = [p.id];
  p.job = b.id;
  p.activeUntil = w.time - 40000;
  const report = workplace(w, p, b)!;
  assert.equal(report.workActive, false);
  assert.equal(report.workActiveNextCycle, false);
  assert.match(report.summary, /shift has expired/i);
  assert.match(report.summary, /waiting.*does not renew/i);
  assert.deepEqual(report.renewAction, { type: 'work', building: b.id });
  assert.equal(report.efficiencyNextCycle, 0.01);
  assert.ok(report.blockers.some((s) => /no active employees/i.test(s)));
});

test('accepting the same job renews an expired shift without duplicate staff or wages', () => {
  const { w, p, b } = millFixture();
  b.investment = 20000;
  p.job = b.id;
  p.activeUntil = w.time - 40000;
  b.employees = [p.id, ...Array.from({ length: 15 }, (_, i) => `absent-${i}`)];
  const cash = p.cash;
  act(w, p.id, { type: 'job', building: b.id });
  act(w, p.id, { type: 'job', building: b.id });
  assert.equal(b.employees.length, 16);
  assert.equal(b.employees.filter((id) => id === p.id).length, 1);
  assert.equal(p.activeUntil, w.time + 1200);
  assert.equal(p.cash, cash);
  assert.equal(b.stock.flour, 29);
  advance(w, 10);
  assert.equal(b.stock.flour, 32);
  assert.equal(b.stock.wheat, 7);
  assert.equal(p.cash, cash + 1980);
  assert.equal(b.investment, 17800);
});

test('job renewal still enforces proximity, ownership, qualification and another job', () => {
  const { w, p, b } = millFixture();
  p.job = b.id;
  b.employees = [p.id];
  p.x = b.x + 100;
  assert.throws(() => act(w, p.id, { type: 'job', building: b.id }));
  p.x = b.x;
  b.owner = p.id;
  assert.throws(() => act(w, p.id, { type: 'job', building: b.id }), /own building/);
  b.owner = 'owner';
  p.skills = [];
  assert.throws(() => act(w, p.id, { type: 'job', building: b.id }), /Learn miller/);
  p.skills = ['miller'];
  p.job = 'other-job';
  assert.throws(() => act(w, p.id, { type: 'job', building: b.id }), /Quit your current job/);
});
