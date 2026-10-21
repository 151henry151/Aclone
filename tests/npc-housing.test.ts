// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { homecomingPlan, offlineReadiness, returnDelay } from '../src/server/npc/homecoming.ts';
import { housingChoices, checkHousingPurchase } from '../src/server/npc/housing.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import type { Step } from '../src/server/npc/decision.ts';

function fixture() {
  const w = createWorld('housing', 'Housing', 'server'),
    p = addPlayer(w, 'builder', 'Builder');
  // Reproduce the live situation: no unclaimed cottage, no open hotel.
  w.buildings = w.buildings.filter((b) => b.kind !== 'home' && !b.lodging);
  p.cash = 1_500_000;
  p.inventory = { bread: 3, water: 6 };
  p.hunger = p.thirst = 0;
  const run = (plan: Step[]) => {
    for (const s of plan) {
      if (s.kind === 'travel') {
        const b = w.buildings.find((b) => b.id === s.destination)!;
        p.x = b.x;
        p.z = b.z;
      } else if (s.kind === 'move') {
        p.x = s.x;
        p.z = s.z;
      } else if (s.kind === 'act') act(w, p.id, s.action);
      else if (s.kind === 'operation') act(w, p.id, operationAction(s));
      else if (s.kind === 'wait') advance(w, s.seconds);
    }
  };
  return { w, p, run };
}

test('logout preparation builds, finishes, stocks and enters a cottage using ordinary paid actions', () => {
  const { w, p, run } = fixture();
  assert.ok(
    housingChoices(w, p)[0].plan.some((s) => s.kind === 'operation' && s.operation === 'construct'),
  );
  const cash = p.cash;
  let legs = 0;
  while (legs++ < 60) {
    const ready = offlineReadiness(w, p, 86400);
    if (ready.stocked && ready.atHome) break;
    const plan = homecomingPlan(w, p, 86400);
    assert.ok(plan.length, 'each bounded housing leg advances toward safe departure');
    run(JSON.parse(JSON.stringify(plan)));
  }
  const home = w.buildings.find((b) => b.owner === p.id && b.kind === 'home');
  assert.ok(home && !home.construction);
  assert.ok(legs > 3 && legs < 60);
  assert.ok(p.cash < cash && p.cash > 0);
  assert.ok(offlineReadiness(w, p, 86400).stocked);
  assert.equal(returnDelay(w, p, 86400), 86400);
  const deaths = p.deaths;
  p.online = false;
  // Small clock steps exercise normal offline feeding, not a special NPC exemption.
  for (let i = 0; i < 1440; i++) advance(w, 60);
  assert.equal(p.deaths, deaths);
  assert.ok(p.health >= 59000);
});

test('building requires observed materials and full budget; savings can bridge a cash shortfall', () => {
  const { w, p, run } = fixture();
  p.cash = 100;
  p.bank = 1_500_000;
  const choice = housingChoices(w, p)[0];
  assert.equal(choice.id, 'housing_savings');
  const total = p.cash + p.bank;
  run(choice.plan);
  assert.equal(p.cash + p.bank, total);
  assert.ok(
    housingChoices(w, p)[0].plan.some((s) => s.kind === 'operation' && s.operation === 'construct'),
  );
  for (const b of w.buildings) b.stock = {};
  assert.deepEqual(
    housingChoices(w, p),
    [],
    'unknown or absent building materials cannot become a promised home',
  );
  p.cash = p.bank = 0;
  assert.deepEqual(housingChoices(w, p), []);
});

test('owned foundations and cottages prevent redundant housing even with a stale home pointer', () => {
  const { w, p } = fixture();
  const home = makeBuilding('mine', 'home', 20, 20);
  home.owner = p.id;
  w.buildings.push(home);
  p.home = 'old-hotel-room';
  assert.deepEqual(housingChoices(w, p), []);
  assert.throws(
    () => checkHousingPurchase(w, p, { type: 'construct', kind: 'home' }),
    /already own/,
  );
  const other = makeBuilding('another', 'home', 30, 30);
  w.buildings.push(other);
  assert.throws(
    () => checkHousingPurchase(w, p, { type: 'buyBuilding', building: other.id }),
    /already own/,
  );
  assert.doesNotThrow(() => checkHousingPurchase(w, p, { type: 'construct', kind: 'mill' }));
  home.construction = { wood: 4 };
  assert.deepEqual(housingChoices(w, p), []);
  assert.throws(
    () => checkHousingPurchase(w, p, { type: 'construct', kind: 'home' }),
    /already own/,
  );
  home.owner = 'someone-else';
  assert.doesNotThrow(() =>
    checkHousingPurchase(w, p, { type: 'buyBuilding', building: other.id }),
  );
});
