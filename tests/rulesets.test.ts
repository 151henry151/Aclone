// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { applyPreset } from '../src/server/world-design.ts';
import { rulesSummary } from '../src/shared/rulesets.ts';

test('relaxed owners run supplied businesses without payroll; jobs are rejected', () => {
  const w = createWorld('r', 'Relaxed', 'owner');
  applyPreset(w, 'relaxed');
  const p = addPlayer(w, 'owner', 'Owner'),
    q = addPlayer(w, 'worker', 'Worker'),
    b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.stock = { wheat: 10 };
  b.investment = 0;
  p.skills = q.skills = ['miller'];
  p.x = q.x = b.x;
  p.z = q.z = b.z;
  assert.throws(() => act(w, q.id, { type: 'job', building: b.id }), /disabled/);
  act(w, p.id, { type: 'work', building: b.id });
  const cash = p.cash;
  advance(w, 600);
  assert.equal(b.stock.flour, 3);
  assert.equal(b.investment, 0);
  assert.equal(p.cash, cash);
  assert.match(rulesSummary(w), /Hunger and thirst are disabled/);
});
test('active owner shifts expire at cycle boundaries and default worlds prohibit self-employment', () => {
  const w = createWorld('s', 'Standard', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  p.skills = ['miller'];
  p.x = b.x;
  p.z = b.z;
  b.stock = { wheat: 20 };
  b.investment = 0;
  assert.throws(() => act(w, p.id, { type: 'work', building: b.id }), /own building/);
  w.settings.ownerOperation = true;
  w.settings.offlineEfficiency = 0;
  act(w, p.id, { type: 'work', building: b.id });
  advance(w, 1800);
  assert.equal(b.stock.flour, 6);
});
test('post-death needs grace expires offline and bulk catch-up matches short ticks', () => {
  const a = createWorld('s', 'Survival', 'owner');
  applyPreset(a, 'survival');
  a.buildings = [];
  const p = addPlayer(a, 'p', 'Player');
  p.health = 1;
  p.hunger = p.thirst = 50000;
  p.online = false;
  const b = structuredClone(a);
  advance(a, 7200);
  for (let i = 0; i < 720; i++) advance(b, 10);
  const q = b.players.p;
  assert.equal(p.deaths, 1);
  assert.ok(p.hunger > 5000);
  assert.ok(p.needsGraceUntil! < a.time);
  assert.ok(Math.abs(q.hunger - p.hunger) < 1e-6);
  assert.ok(Math.abs(q.thirst - p.thirst) < 1e-6);
});
