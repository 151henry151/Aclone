// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { migrateEmploymentPolicy } from '../src/shared/employment-policy.ts';
import { productionStaffing } from '../src/shared/sound-state.ts';
import { workShift } from '../src/client/work-shift.ts';

const setup = () => {
  const w = createWorld('test', 'Test', 'server');
  const p = addPlayer(w, 'resident', 'Resident');
  return { w, p };
};

test('starter parish changes once, preserving later custom policy edits and other worlds', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(w.employmentPolicyVersion, 1);
  assert.equal(w.settings.activeWork, false);
  assert.equal(w.settings.ownerOperation, true);
  w.settings.activeWork = true;
  w.settings.ownerOperation = false;
  migrateEmploymentPolicy(w);
  assert.equal(w.settings.activeWork, true);
  assert.equal(w.settings.ownerOperation, false);
  const other = createWorld('elsewhere', 'Other world', 'server');
  migrateEmploymentPolicy(other);
  assert.equal(other.employmentPolicyVersion, undefined);
  assert.equal(other.settings.activeWork, true);
  delete w.employmentPolicyVersion;
  migrateEmploymentPolicy(w);
  assert.equal(w.settings.activeWork, false, 'existing starter worlds migrate too');
});

test('persistent employment pays offline after the old shift expires, but never without inputs or funds', () => {
  const { w, p } = setup();
  w.settings.activeWork = false;
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  Object.assign(b, { stock: { wheat: 20, flour: 0 }, investment: 10000, wage: 1000 });
  Object.assign(p, { x: b.x, z: b.z, skills: ['miller'] });
  act(w, p.id, { type: 'job', building: b.id });
  p.online = false;
  p.activeUntil = 0;
  const cash = p.cash;
  advance(w, 2400);
  assert.ok(p.cash > cash);
  assert.ok(b.stock.flour > 0);
  assert.equal(workShift(w, p, b)!.canRenew, false);
  const earned = p.cash,
    produced = b.stock.flour;
  b.investment = 0;
  advance(w, 1200);
  assert.equal(p.cash, earned);
  assert.equal(b.stock.flour, produced);
  b.investment = 10000;
  b.stock.wheat = 0;
  advance(w, 1200);
  assert.equal(p.cash, earned);
});

test('qualified owner operates continuously without drawing a wage; unqualified owner is not shown working', () => {
  const { w, p } = setup();
  w.settings.ownerOperation = true;
  w.settings.activeWork = false;
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  Object.assign(b, { owner: p.id, stock: { wheat: 20, flour: 0 }, investment: 0 });
  assert.equal(workShift(w, p, b), undefined);
  assert.equal(productionStaffing(w, b).ownerOperating, false);
  p.skills.push('miller');
  assert.equal(productionStaffing(w, b).ownerOperating, true);
  assert.match(workShift(w, p, b)!.label, /Operating/);
  const cash = p.cash;
  advance(w, 1200);
  assert.ok(b.stock.flour > 0);
  assert.equal(p.cash, cash);
});
