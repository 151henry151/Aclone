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
  deliveryBlocker,
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
test('conversation agreement uses a bounded receipt reply, survives restart and drives a real delivery without paid decisions', async (t) => {
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
    assert.equal(speechCalls, 2);
    const acknowledgement = w.messages
      .filter((m) => m.name === p.name && m.kind === 'chat')
      .at(-1)!;
    assert.match(acknowledgement.text, /still needs to be planned/);
    assert.match(acknowledgement.text, /nothing has been delivered/);
    assert.equal(acknowledgement.to, undefined);
    assert.equal(r.memory.load('rowan')!.commitments![0].replyTo, null);
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
    assert.equal(speechCalls, 2);
    assert.equal(decisions, 0, 'A sole safe accepted plan needs no paid selection');
  } finally {
    r.close();
    store.close();
  }
});

test('delivery validation distinguishes employment from stock ownership and reports specific blockers', () => {
  const { w, p, farm, mill } = setup();
  farm.owner = undefined;
  p.job = farm.id;
  assert.match(deliveryBlocker(w, p, delivery.delivery, 118, true)!, /do not own.*employee/i);
  farm.owner = p.id;
  farm.stock.wheat = 12;
  assert.match(deliveryBlocker(w, p, delivery.delivery, 118, true)!, /12.*118/);
  farm.stock.wheat = 118;
  mill.investment = 100;
  assert.match(deliveryBlocker(w, p, delivery.delivery, 118, true)!, /investment/);
  mill.investment = 100000;
  mill.stock.wheat = mill.capacity;
  assert.match(deliveryBlocker(w, p, delivery.delivery, 118, true)!, /storage/);
  mill.stock.wheat = 0;
  assert.equal(deliveryBlocker(w, p, delivery.delivery, 118, true), undefined);
  p.inventory.wheat = 118;
  farm.owner = undefined;
  assert.equal(deliveryBlocker(w, p, delivery.delivery, 118, true), undefined);
});

for (const privateChat of [false, true]) {
  test(`an employee cannot promise farm goods in ${privateChat ? 'private' : 'public'} chat, even with a hallucinated reply`, async () => {
    const store = new Store(':memory:'),
      universe = new Universe(store),
      { w, farm } = setup();
    delete w.players.farmer;
    const human = addPlayer(w, 'human', 'Hank');
    human.online = true;
    let chatCalls = 0;
    const idle = {
      intent: 'Rest',
      notebook: '',
      speech: null,
      plan: [{ kind: 'wait' as const, seconds: 180 }],
      repeat: 1,
      reconsiderSeconds: 180,
    };
    const residents = new Residents(store, universe, new Map([[w.id, w]]), [
      {
        config: npcConfigSchema.parse({
          id: 'rowan',
          name: 'Rowan Field',
          provider: 'jev',
          activeAlone: true,
          intervalMs: 5000,
        }),
        brain: {
          async decide() {
            return { decision: idle, inputTokens: 1, outputTokens: 0 };
          },
        },
        dialogue: {
          rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
          brain: {
            async decide(request: any) {
              chatCalls++;
              const observed = request.observation.nearbyBuildings.find(
                (b: any) => b.id === farm.id,
              );
              assert.match(observed.stockAccess, /Employee only/);
              assert.equal(request.observation.availableDeliveryStock.ownedStockrooms.length, 0);
              return {
                decision: {
                  ...idle,
                  speech: { text: 'All 118 wheat are mine. I am loading them now!', to: null },
                },
                gameplayRequest: delivery,
                inputTokens: 1,
                outputTokens: 1,
              };
            },
          },
        },
      },
    ]);
    try {
      const p = w.players[residents.status()[0].playerId];
      farm.owner = undefined;
      p.job = farm.id;
      say(
        w,
        human.name,
        'Rowan, bring 118 wheat to my mill at 6d each.',
        'chat',
        privateChat ? p.id : undefined,
      );
      residents.capture(w);
      residents.tick(0.5, Date.now());
      await residents.settled();
      const replies = w.messages.filter((m) => m.name === p.name && m.kind === 'chat');
      assert.equal(chatCalls, 2);
      assert.equal(replies.length, 1);
      assert.match(replies[0].text, /do not own.*employee/);
      assert.doesNotMatch(replies[0].text, /loading them now/);
      assert.equal(replies[0].to, privateChat ? human.id : undefined);
      assert.equal(residents.memory.load('rowan')!.commitments?.length ?? 0, 0);
      assert.equal(farm.stock.wheat, 118);
    } finally {
      residents.close();
      store.close();
    }
  });
}

test('recheck live ownership after the chat call and persist one legacy blocker notice across restart without speech calls', async (t) => {
  let now = Date.now(),
    chatCalls = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    universe = new Universe(store),
    { w, farm } = setup();
  delete w.players.farmer;
  const human = addPlayer(w, 'human', 'Hank');
  human.online = true;
  const worlds = new Map([[w.id, w]]);
  const idle = {
    intent: 'Rest',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 60 }],
    repeat: 1,
    reconsiderSeconds: 60,
  };
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'rowan',
        name: 'Rowan Field',
        provider: 'jev',
        activeAlone: true,
        intervalMs: 5000,
      }),
      brain: {
        async decide() {
          return { decision: idle, inputTokens: 1, outputTokens: 0 };
        },
      },
      dialogue: {
        rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
        brain: {
          async decide(request: any) {
            chatCalls++;
            assert.equal(request.observation.availableDeliveryStock.ownedStockrooms[0].id, farm.id);
            // A sale/transferred property while the provider is thinking invalidates its snapshot.
            farm.owner = 'someone-else';
            return {
              decision: { ...idle, speech: { text: 'I am bringing the wheat now.', to: null } },
              gameplayRequest: delivery,
              inputTokens: 1,
              outputTokens: 1,
            };
          },
        },
      },
    },
  ];
  let residents = new Residents(store, universe, worlds, options);
  try {
    const p = w.players[residents.status()[0].playerId];
    farm.owner = p.id;
    say(w, human.name, 'Rowan, please deliver the wheat.', 'chat');
    residents.capture(w);
    residents.tick(0.5, now);
    await residents.settled();
    assert.equal(chatCalls, 2);
    assert.match(
      w.messages.filter((m) => m.name === p.name && m.kind === 'chat').at(-1)!.text,
      /do not own/,
    );
    assert.equal(residents.memory.load('rowan')!.commitments?.length ?? 0, 0);
    residents.close();
    // Old agreements without a saved reply channel must not leak into public chat.
    const state = residents.memory.load('rowan')!;
    recordCommitment(state, delivery, 'legacy', human.id, w);
    state.commitments![0].status = 'blocked';
    state.commitments![0].outcome = 'Old generic error';
    state.helpQuestion = undefined;
    state.needsDecision = true;
    state.plan = [];
    residents.memory.save('rowan', state);
    for (let i = 0; i < 2; i++) {
      now += 300000;
      residents = new Residents(store, universe, worlds, options);
      residents.tick(0.5, now);
      await residents.settled();
      residents.close();
    }
    const notices = w.messages.filter(
      (m) => m.name === p.name && m.text.startsWith('My delivery is blocked:'),
    );
    assert.equal(notices.length, 1);
    assert.match(notices[0].text, /do not own/);
    assert.equal(notices[0].to, human.id);
    assert.equal(chatCalls, 2);
    assert.equal(residents.memory.load('rowan')!.commitments![0].blockedNoticeSent, true);
  } finally {
    residents.close();
    store.close();
  }
});
