// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  say,
  advance,
} from '../src/shared/simulation.ts';
import {
  commitmentChoices,
  recordCommitment,
  checkCommitmentPrice,
  recordDelivery,
} from '../src/server/npc/commitments.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
const delivery = {
  summary: 'Sell 118 wheat to Hank’s mill at 6d each',
  cancel: false,
  delivery: {
    item: 'wheat',
    quantity: 118,
    unitPrice: 600,
    sourceBuilding: 'farm',
    destinationBuilding: 'mill',
  },
};
function setup() {
  const w = createWorld('puddlewick', 'Test', 'owner'),
    p = addPlayer(w, 'farmer', 'Rowan');
  const farm = makeBuilding('farm', 'farm', 0, 0),
    mill = makeBuilding('mill', 'mill', 30, 0);
  farm.owner = p.id;
  farm.stock = { wheat: 118 };
  mill.owner = 'human';
  mill.buy.wheat = 600;
  mill.stock = { wheat: 0 };
  mill.investment = 100000;
  w.buildings = [farm, mill];
  p.x = 0;
  p.z = 10;
  p.inventory.water = 100;
  return { w, p, farm, mill };
}
test('an agreed 118-wheat sale loads owned stock across capacity-limited trips and counts only successful receipts', () => {
  const { w, p, farm, mill } = setup(),
    state = { commitments: [] } as unknown as ResidentState;
  assert.equal(recordCommitment(state, delivery, 'message1', 'human', w), true);
  assert.equal(recordCommitment(state, delivery, 'message1', 'human', w), false);
  assert.equal(recordCommitment(state, delivery, 'message2', 'human', w), false);
  let loads = 0;
  const cash = p.cash;
  while (state.commitments![0].status !== 'completed' && loads < 10) {
    const choice = commitmentChoices(w, p, state)[0];
    assert.ok(choice);
    loads++;
    for (const s of choice.plan) {
      if (s.kind === 'travel') {
        const b = w.buildings.find((b) => b.id === s.destination)!;
        p.x = b.x;
        p.z = b.z;
      }
      if (s.kind === 'act') {
        checkCommitmentPrice(w, state, s.action);
        act(w, p.id, s.action);
        recordDelivery(state, w.id, s.action);
      }
    }
  }
  assert.ok(loads >= 2);
  assert.equal(mill.stock.wheat, 118);
  assert.equal(farm.stock.wheat, 0);
  assert.equal(state.commitments![0].delivered, 118);
  assert.equal(state.commitments![0].status, 'completed');
  assert.ok(p.cash > cash);
  assert.equal(commitmentChoices(w, p, state).length, 0);
});
test('delivery checks ownership, posted price, cash and storage, and cancellation belongs to the requester', () => {
  const { w, p, farm, mill } = setup(),
    state = {} as ResidentState;
  recordCommitment(state, delivery, '1', 'human', w);
  mill.buy.wheat = 500;
  assert.equal(commitmentChoices(w, p, state).length, 0);
  assert.match(state.commitments![0].outcome, /price/);
  assert.throws(
    () =>
      checkCommitmentPrice(w, state, {
        type: 'trade',
        building: mill.id,
        item: 'wheat',
        quantity: 1,
        direction: 'sell',
      }),
    /price/,
  );
  mill.buy.wheat = 600;
  farm.owner = 'someone';
  assert.equal(commitmentChoices(w, p, state).length, 0);
  farm.owner = p.id;
  mill.investment = 0;
  assert.equal(commitmentChoices(w, p, state).length, 0);
  mill.investment = 100000;
  mill.stock.wheat = mill.capacity;
  assert.equal(commitmentChoices(w, p, state).length, 0);
  assert.equal(recordCommitment(state, { ...delivery, cancel: true }, '2', 'bystander', w), false);
  assert.equal(recordCommitment(state, { ...delivery, cancel: true }, '3', 'human', w), true);
  assert.equal(state.commitments![0].status, 'cancelled');
});
test('overlapping delivery agreements cannot count sales below either promised minimum', () => {
  const { w, mill } = setup(),
    state = {} as ResidentState;
  recordCommitment(state, delivery, 'one', 'human', w);
  recordCommitment(
    state,
    { ...delivery, delivery: { ...delivery.delivery, unitPrice: 700 } },
    'two',
    'human',
    w,
  );
  const sale = { type: 'trade', building: mill.id, item: 'wheat', quantity: 1, direction: 'sell' };
  assert.throws(() => checkCommitmentPrice(w, state, sale), /price/);
  mill.buy.wheat = 700;
  assert.doesNotThrow(() => checkCommitmentPrice(w, state, sale));
});
test('conversation agreement wakes Jev exactly once, survives restart and drives a real delivery without another chat call', async (t) => {
  let now = Date.now(),
    speechCalls = 0,
    decisions = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    universe = new Universe(store),
    { w, farm, mill } = setup();
  delete w.players.farmer;
  const human = addPlayer(w, 'human', 'Hank');
  human.online = true;
  const worlds = new Map([[w.id, w]]),
    config = npcConfigSchema.parse({
      id: 'rowan',
      name: 'Rowan Field',
      provider: 'jev',
      activeAlone: true,
      intervalMs: 5000,
    });
  const idle = {
    intent: 'Wait',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 600 }],
    repeat: 1,
    reconsiderSeconds: 600,
  };
  const options = [
    {
      config,
      brain: {
        async decide(request: any) {
          decisions++;
          const choice = request.observation.choices.find((c: any) =>
            c.id.startsWith('commitment_'),
          );
          return {
            decision: choice
              ? { ...idle, intent: choice.description.slice(0, 300), plan: choice.plan }
              : idle,
            inputTokens: 10,
            outputTokens: 0,
          };
        },
      },
      dialogue: {
        provider: 'anthropic' as const,
        rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
        brain: {
          async decide() {
            speechCalls++;
            return {
              decision: {
                ...idle,
                speech: {
                  text: 'I will plan the delivery in loads, subject to the mill’s price and funding.',
                  to: null,
                },
              },
              gameplayRequest: delivery,
              inputTokens: 10,
              outputTokens: 5,
            };
          },
        },
      },
    },
  ];
  let r = new Residents(store, universe, worlds, options);
  try {
    const p = w.players[r.status()[0].playerId];
    farm.owner = p.id;
    p.inventory.water = 100;
    p.x = 0;
    p.z = 12;
    // Keep the real path short; the planner still navigates and applies actual trades.
    farm.x = 0;
    farm.z = 0;
    mill.x = 35;
    mill.z = 0;
    say(w, human.name, 'Rowan, please sell my mill all 118 wheat at 6d each.', 'chat');
    r.capture(w);
    r.tick(0.5, now);
    await r.settled();
    assert.equal(speechCalls, 1);
    assert.equal(r.memory.load('rowan')!.commitments![0].delivered, 0);
    r.close();
    r = new Residents(store, universe, worlds, options);
    for (
      let i = 0;
      i < 4000 && r.memory.load('rowan')!.commitments![0].status !== 'completed';
      i++
    ) {
      now += 250;
      advance(w, 0.25);
      r.tick(0.25, now);
      await r.settled();
    }
    assert.equal(r.memory.load('rowan')!.commitments![0].status, 'completed');
    assert.equal(mill.stock.wheat, 118);
    assert.equal(speechCalls, 1);
    assert.ok(decisions >= 3);
  } finally {
    r.close();
    store.close();
  }
});
