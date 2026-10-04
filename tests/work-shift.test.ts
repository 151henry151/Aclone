// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { workShift } from '../src/client/work-shift.ts';

function fixture() {
  const w = createWorld('work-ui', 'Work', 'owner');
  const p = addPlayer(w, 'worker', 'Worker');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  Object.assign(b, { owner: 'owner', stock: { wheat: 20 }, investment: 20000, wage: 1000 });
  Object.assign(p, { x: b.x, z: b.z, skills: ['miller'] });
  w.time = 590;
  return { w, p, b };
}
test('shift tracks actual cycle boundaries, remains eligible away/offline and then expires', () => {
  const { w, p, b } = fixture();
  act(w, p.id, { type: 'job', building: b.id });
  assert.equal(workShift(w, p, b)!.checks, 2);
  assert.equal(workShift(w, p, b)!.nextIn, 10);
  assert.equal(workShift(w, p, b)!.remaining, 1200);
  const cash = p.cash;
  p.x += 100;
  p.online = false;
  advance(w, 10);
  assert.ok(p.cash > cash);
  assert.equal(workShift(w, p, b)!.checks, 1);
  advance(w, 600);
  assert.equal(workShift(w, p, b)!.checks, 0);
  assert.match(workShift(w, p, b)!.label, /Shift active/);
  assert.equal(workShift(w, p, b)!.canRenew, true);
  advance(w, 591);
  assert.match(workShift(w, p, b)!.label, /Shift ended/);
});
test('renewal is available during the final cycle, not repeatedly at the start', () => {
  const { w, p, b } = fixture();
  act(w, p.id, { type: 'job', building: b.id });
  assert.equal(workShift(w, p, b)!.canRenew, false);
  advance(w, 600);
  assert.equal(workShift(w, p, b)!.canRenew, true);
  assert.match(workShift(w, p, b)!.button, /Renew/);
});
test('unrestricted worlds, farms and owner operation explain their different rules', () => {
  const { w, p, b } = fixture();
  act(w, p.id, { type: 'job', building: b.id });
  w.settings.activeWork = false;
  assert.match(workShift(w, p, b)!.label, /No renewal needed/);
  assert.equal(workShift(w, p, b)!.canRenew, false);
  w.settings.activeWork = true;
  b.kind = 'farm';
  assert.match(workShift(w, p, b)!.detail, /harvest/);
  assert.equal(workShift(w, p, b)!.checks, undefined);
  b.kind = 'mill';
  b.owner = p.id;
  w.settings.ownerOperation = true;
  b.ownerActiveUntil = w.time + 1200;
  assert.match(workShift(w, p, b)!.detail, /without wages/);
  w.settings.jobsEnabled = false;
  b.owner = 'owner';
  assert.equal(workShift(w, p, b), undefined);
});
