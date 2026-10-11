// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { travelPrep, drivePlan } from '../src/server/npc/travel.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';

function fixture() {
  const w = createWorld('drive', 'Drive', 'owner');
  const p = addPlayer(w, 'driver', 'Driver');
  p.npc = true;
  p.hunger = 0;
  p.thirst = 0;
  p.cash = 20000;
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
  } as unknown as ResidentState;
  return { w, p, state };
}

const vehicleSlot = (plan: Step[], slot: number) =>
  plan.some((s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === slot);

const buysFuel = (plan: Step[]) =>
  plan.some(
    (s) =>
      s.kind === 'act' &&
      s.action.type === 'trade' &&
      s.action.item === 'fuel' &&
      s.action.direction === 'buy',
  );

test('an empty tank permits walking and an affordable pump trip remounts afterwards', () => {
  const { w, p } = fixture();
  p.vehicle = 0;
  p.fuel = 0;
  p.engine = true;
  const prep = travelPrep(p);
  assert.ok(vehicleSlot(prep, 5));
  const drive = drivePlan(w, p);
  assert.ok(buysFuel(drive));
  const walkAt = drive.findIndex(
    (s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === 5,
  );
  const mountAt = drive.findIndex(
    (s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === 0,
  );
  if (walkAt >= 0) assert.ok(mountAt > walkAt, 'a pump trip on foot must remount afterwards');
});

test('a penniless resident can walk to earn or return to shelter', () => {
  const { w, p } = fixture();
  p.fuel = 0;
  p.cash = 0;
  assert.ok(vehicleSlot(drivePlan(w, p), 5));
  assert.ok(vehicleSlot(travelPrep(p), 5));
  p.vehicle = 5;
  assert.deepEqual(drivePlan(w, p), []);
});

test('a walker with fuel remounts instead of touring on foot', () => {
  const { w, p } = fixture();
  p.vehicle = 5;
  p.fuel = 20;
  p.engine = true;
  const drive = drivePlan(w, p);
  assert.ok(vehicleSlot(drive, 0));
  assert.ok(!vehicleSlot(drive, 5));
});

test('a walker with an empty tank buys fuel, uses it and remounts', () => {
  const { w, p } = fixture();
  p.vehicle = 5;
  p.fuel = 0;
  p.engine = true;
  const shop = w.buildings.find((b) => (b.stock.fuel ?? 0) > 0 && (b.sell.fuel ?? 0) > 0)!;
  assert.ok(shop);
  const drive = drivePlan(w, p);
  assert.ok(buysFuel(drive));
  assert.ok(
    drive.some((s) => s.kind === 'act' && s.action.type === 'use' && s.action.item === 'fuel'),
  );
  assert.ok(vehicleSlot(drive, 0));
  for (const step of drive) {
    if (step.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === step.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (step.kind === 'act') act(w, p.id, step.action);
  }
  assert.equal(p.vehicle, 0);
  assert.ok(p.fuel > 0);
});

test('the garage catalogue does not offer walking as a vehicle to collect', () => {
  const { w, p, state } = fixture();
  p.vehicle = 0;
  p.fuel = 20;
  p.cash = 200000;
  const walking = adaptiveChoices(w, p, state).filter((c) => vehicleSlot(c.plan, 5));
  assert.equal(walking.length, 0);
});

test('stranded navigation uses carried fuel before trying to unload into walking capacity', () => {
  const { w, p } = fixture();
  p.fuel = 0;
  p.engine = false;
  p.inventory = { fuel: 1, wheat: 149 };
  const plan = travelPrep(p);
  assert.ok(
    plan.some((s) => s.kind === 'act' && s.action.type === 'use' && s.action.item === 'fuel'),
  );
  for (const s of plan) if (s.kind === 'act') act(w, p.id, s.action);
  assert.ok(p.fuel > 0);
  for (const s of travelPrep(p)) if (s.kind === 'act') act(w, p.id, s.action);
  assert.equal(p.vehicle, 0);
  assert.ok(p.engine);
});

test('urgent self-care leaves a robocrow before trying to drink', async () => {
  const { carePlan } = await import('../src/server/npc/care.ts');
  const { operationAction } = await import('../src/server/npc/player-operations.ts');
  const { w, p } = fixture();
  p.inventory = { rc: 1, water: 1 };
  p.thirst = 40000;
  act(w, p.id, { type: 'crow' });
  const returnPlan = carePlan(w, p);
  assert.equal(returnPlan[0].kind, 'operation');
  for (const s of returnPlan) if (s.kind === 'operation') act(w, p.id, operationAction(s));
  for (const s of carePlan(w, p)) if (s.kind === 'act') act(w, p.id, s.action);
  assert.equal(p.crowBody, undefined);
  assert.ok(p.thirst < 40000);
});
