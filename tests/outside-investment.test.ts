// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import {
  collectableReturn,
  operatingReserve,
  ownerWithdrawable,
  stakeClaim,
  unpaidPrincipal,
} from '../src/shared/stakes.ts';
import { inventHypotheses } from '../src/server/npc/hypotheses.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

function fixture() {
  const w = createWorld('stakes', 'Stakes', 'owner');
  const owner = addPlayer(w, 'owner', 'Toby');
  const neighbour = addPlayer(w, 'ada', 'Ada');
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = owner.id;
  mill.investment = 60;
  mill.stock.flour = 8;
  mill.sell.flour = 2000;
  owner.x = mill.x;
  owner.z = mill.z;
  neighbour.x = mill.x;
  neighbour.z = mill.z;
  neighbour.cash = 20000;
  owner.cash = 500;
  owner.npc = true;
  const state = {
    playerId: neighbour.id,
    world: w.id,
    name: neighbour.name,
    personality: 'Curious',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    experiences: [],
  } as unknown as ResidentState;
  return { w, owner, neighbour, mill, state };
}

test('a neighbour can fund a mill they do not own', () => {
  const { w, neighbour, mill } = fixture();
  const cash = neighbour.cash;
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'deposit',
    amount: 5000,
  });
  assert.equal(mill.investment, 5060);
  assert.equal(neighbour.cash, cash - 5000);
  assert.equal(mill.stakes?.length, 1);
  assert.equal(mill.stakes![0]!.principal, 5000);
  assert.equal(mill.stakes![0]!.claim, stakeClaim(5000));
  assert.equal(mill.stakes![0]!.paid, 0);
});

test('an outside investor cannot pull the stake back before the mill earns', () => {
  const { w, neighbour, mill } = fixture();
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'deposit',
    amount: 5000,
  });
  assert.equal(collectableReturn(w, mill, neighbour.id), 0);
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, neighbour.id, {
        type: 'investment',
        building: mill.id,
        direction: 'withdraw',
        amount: 1000,
      }),
    /profit|return|earn/i,
  );
  assert.equal(JSON.stringify(w), before);
});

test('after the mill sells, the investor can collect profit up to a 25% return, not the whole till', () => {
  const { w, neighbour, mill } = fixture();
  const buyer = addPlayer(w, 'buyer', 'Buyer');
  buyer.x = mill.x;
  buyer.z = mill.z;
  buyer.cash = 200000;
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'deposit',
    amount: 8000,
  });
  const watermark = mill.investment;
  act(w, buyer.id, {
    type: 'trade',
    building: mill.id,
    direction: 'buy',
    item: 'flour',
    quantity: 3,
  });
  assert.ok(mill.investment > watermark);
  const due = collectableReturn(w, mill, neighbour.id);
  assert.ok(due > 0);
  assert.ok(due < mill.investment);
  const cash = neighbour.cash;
  const till = mill.investment;
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'withdraw',
    amount: due,
  });
  assert.equal(neighbour.cash, cash + due);
  assert.equal(mill.investment, till - due);
  assert.ok((mill.stakes![0]!.paid ?? 0) >= due);
  mill.watermark = 0;
  mill.investment = 100000;
  const leftover = collectableReturn(w, mill, neighbour.id);
  assert.ok(leftover + due <= stakeClaim(8000));
});

test('collecting stops once the capped return is paid, even if the mill stays rich', () => {
  const { w, neighbour, mill } = fixture();
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'deposit',
    amount: 2000,
  });
  mill.stakes![0]!.paid = stakeClaim(2000);
  mill.investment = 80000;
  mill.watermark = 0;
  assert.equal(collectableReturn(w, mill, neighbour.id), 0);
  assert.throws(() =>
    act(w, neighbour.id, {
      type: 'investment',
      building: mill.id,
      direction: 'withdraw',
      amount: 100,
    }),
  );
});

test('an investor cannot drain the operating reserve, and the owner cannot pocket the stake', () => {
  const { w, owner, neighbour, mill } = fixture();
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'deposit',
    amount: 4000,
  });
  mill.watermark = 0;
  mill.investment = operatingReserve(w, mill);
  assert.equal(collectableReturn(w, mill, neighbour.id), 0);
  mill.investment = unpaidPrincipal(mill);
  assert.equal(ownerWithdrawable(w, mill), 0);
  owner.x = mill.x;
  owner.z = mill.z;
  assert.throws(
    () =>
      act(w, owner.id, {
        type: 'investment',
        building: mill.id,
        direction: 'withdraw',
        amount: 500,
      }),
    /stake|investor|capital/i,
  );
});

test('the owner can still withdraw surplus above unpaid outside principal', () => {
  const { w, owner, neighbour, mill } = fixture();
  act(w, neighbour.id, {
    type: 'investment',
    building: mill.id,
    direction: 'deposit',
    amount: 4000,
  });
  mill.investment += 3000;
  owner.cash = 0;
  const allowed = ownerWithdrawable(w, mill);
  assert.ok(allowed >= 3000);
  act(w, owner.id, {
    type: 'investment',
    building: mill.id,
    direction: 'withdraw',
    amount: 3000,
  });
  assert.equal(owner.cash, 3000);
  assert.equal(mill.stakes![0]!.principal, 4000);
});

test('government shops do not take outside stakes', () => {
  const { w, neighbour } = fixture();
  const school = w.buildings.find((b) => b.kind === 'school')!;
  neighbour.x = school.x;
  neighbour.z = school.z;
  assert.throws(() =>
    act(w, neighbour.id, {
      type: 'investment',
      building: school.id,
      direction: 'deposit',
      amount: 1000,
    }),
  );
});

test('NPCs invent funding a starved mill they do not own, and owners invent a careful till withdrawal', () => {
  const { w, owner, neighbour, mill, state } = fixture();
  mill.buy.wheat = 600;
  mill.investment = 60;
  neighbour.cash = 8000;
  neighbour.npc = true;
  const ideas = inventHypotheses(w, neighbour, state);
  assert.ok(
    ideas.some(
      (c) =>
        c.plan.some(
          (s) =>
            s.kind === 'act' &&
            s.action.type === 'investment' &&
            s.action.building === mill.id &&
            s.action.direction === 'deposit',
        ),
    ),
    'neighbours invent an outside stake when the mill cannot pay',
  );

  owner.cash = 200;
  owner.fuel = 2;
  owner.hunger = 0;
  owner.thirst = 0;
  mill.owner = owner.id;
  mill.investment = 40000;
  mill.stakes = [];
  const ownerState = { ...state, playerId: owner.id } as ResidentState;
  const ownerIdeas = inventHypotheses(w, owner, ownerState);
  const draw = ownerIdeas.find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'investment' &&
        s.action.building === mill.id &&
        s.action.direction === 'withdraw',
    ),
  );
  assert.ok(draw, 'a broke owner invents withdrawing operating cash');
  const step = draw.plan.find((s) => s.kind === 'act' && s.action.type === 'investment');
  assert.ok(step?.kind === 'act' && step.action.type === 'investment');
  const amount = 'amount' in step.action ? Number(step.action.amount) : 0;
  assert.ok(amount > 0);
  assert.ok(amount <= ownerWithdrawable(w, mill, true));
  assert.ok(adaptiveChoices(w, owner, ownerState).some((c) => c.description.includes('withdraw')));
});
