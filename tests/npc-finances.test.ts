// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation.ts';
import { accounts, recentOperatingCash, recordMoney } from '../src/shared/reports.ts';
import { financialBriefing } from '../src/server/npc/finances.ts';
import { perceivedWorld } from '../src/server/npc/perception.ts';
import { observe } from '../src/server/npc/observation.ts';
import { conversationView } from '../src/server/npc/agenda.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import { capitalChoices } from '../src/server/npc/prosperity.ts';
import { retainedCapital, ownerBidRoutine } from '../src/server/npc/business-policy.ts';
import { recordCommitment, commitmentChoices } from '../src/server/npc/commitments.ts';
import {
  businessRequestBlocker,
  checkBusinessAction,
  recordBusinessAction,
} from '../src/server/npc/business-requests.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { conversationTool, unqueuedPromise } from '../src/server/npc/conversation.ts';
import { Store } from '../src/server/store.ts';
import type { ResidentState, NpcMemory } from '../src/server/npc/memory.ts';
import type { Action } from '../src/shared/types.ts';

function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'toby', 'Toby Finch');
  const human = addPlayer(w, 'bio', 'BioHaze');
  const b = makeBuilding('bakery', 'bakery', 0, 0);
  b.owner = p.id;
  b.investment = 4789330;
  b.stock = { flour: 206, bread: 30 };
  b.buy = {};
  b.pausedPrices = { buy: { flour: 5181 } };
  b.stakes = [{ investor: human.id, principal: 2000, claim: 2268, paid: 0, opened: w.time }];
  const mill = makeBuilding('mill', 'mill', 100, 100);
  mill.stock.flour = 20;
  mill.sell.flour = 4050;
  w.buildings = [b, mill];
  p.x = p.z = 0;
  p.cash = 868224;
  p.bank = 799282;
  const state = {
    world: w.id,
    playerId: p.id,
    plan: [],
    index: 0,
    intent: 'Manage bakery',
    helpQuestion: 'Explain your bakery till',
    questionFrom: human.id,
    questionFromName: human.name,
    replyTo: human.id,
  } as unknown as ResidentState;
  return { w, p, human, b, mill, state };
}
const request = {
  summary: 'Withdraw excess bakery cash, keeping 10000d available for operations.',
  cancel: false,
  delivery: null,
  employment: null,
  business: { building: 'bakery', keepDenarii: 10000, pricing: null },
};
function nextAction(f: ReturnType<typeof setup>) {
  const choice = commitmentChoices(f.w, f.p, f.state)[0];
  assert.ok(choice);
  const step = choice.plan.find((s) => s.kind === 'act' || s.kind === 'operation')!;
  return step.kind === 'act'
    ? step.action
    : operationAction(step as Extract<typeof step, { kind: 'operation' }>);
}
function run(f: ReturnType<typeof setup>, a: Action) {
  checkBusinessAction(f.w, f.p, f.state, a);
  act(f.w, f.p.id, a);
  return recordBusinessAction(f.w, f.p, f.state, a);
}

test('Finch financial facts separate 479s cash from inventory and old negative cash flow', () => {
  const { w, p, b, state } = setup();
  accounts(w, b).materials = 371400;
  const f = financialBriefing(w, p, state);
  assert.equal(f.personal.cash.denarii, 8682.24);
  assert.equal(f.businesses[0].tillCash.denarii, 47893.3);
  assert.equal(f.businesses[0].tillCash.display, '478s 93.3d');
  assert.equal(f.businesses[0].lifetimeOperatingCashFlowDenarii, -3714);
  assert.equal(
    f.businesses[0].recentOperatingCashFlow,
    null,
    'legacy history is unknown, not zero',
  );
  assert.equal(
    f.businesses[0].safelyWithdrawable.denarii,
    (b.investment - 2268 - retainedCapital(w, b)) / 100,
  );
  assert.equal(f.businesses[0].purchasing[0].acceptingDeliveries, false);
  assert.equal(f.businesses[0].purchasing[0].target, 12);
  assert.match(f.businesses[0].purchasing[0].policy, /Input reserve/);
  const stockValue = f.businesses[0].stockCatalogueValueDenarii;
  b.stock.flour *= 2;
  assert.equal(financialBriefing(w, p, state).businesses[0].tillCash.denarii, 47893.3);
  assert.ok(financialBriefing(w, p, state).businesses[0].stockCatalogueValueDenarii > stockValue);
  w.settings.exchangeRate = 10;
  assert.equal(financialBriefing(w, p, state).businesses[0].tillCash.display, '4,789s 3.3d');
});

test('financial observations respect visits and explicitly calculate reversed hauling margins', () => {
  const { w, p, b, mill, state } = setup();
  b.buy.flour = 3950;
  let f = financialBriefing(perceivedWorld(w, p, state), p, state);
  assert.equal(f.businesses[0].purchasing[0].observedSupplier, null);
  assert.equal(f.businesses[0].estimatedBatch?.marginBuyingAtObservedSuppliersDenarii, null);
  p.x = p.z = 100;
  f = financialBriefing(perceivedWorld(w, p, state), p, state);
  assert.equal(f.businesses[0].purchasing[0].observedSupplier?.haulierMarginDenarii, -1);
  b.buy.flour = 4150;
  assert.equal(
    financialBriefing(perceivedWorld(w, p, state), p, state).businesses[0].purchasing[0]
      .observedSupplier?.haulierMarginDenarii,
    1,
  );
  assert.ok(!f.businesses.some((q) => q.building === mill.id), 'no competitor private accounts');
});

test('identical financial facts reach conversation and a bounded Jev request', () => {
  const { w, p, state } = setup();
  const memory = { recent: () => [], conversation: () => [] } as unknown as NpcMemory;
  const observation = observe(perceivedWorld(w, p, state), p, state, memory, 'toby');
  assert.equal(observation.currentConversation?.speakerName, 'BioHaze');
  const chat = conversationView(observation, state, 'bio', true);
  assert.deepEqual(chat.finances, observation.finances);
  const brain = new JevBrain('unused', 'test');
  const prepared = brain.prepare({
    instructions: 'Choose a project.',
    observation: {
      ...observation,
      choices: [{ id: 'wait', description: 'Wait briefly', plan: [{ kind: 'wait', seconds: 30 }] }],
    },
  });
  const body = JSON.parse(prepared.preparedBody!);
  assert.equal(body.state.finances.businesses[0].tillCash.denarii, 47893.3);
  assert.equal(
    body.state.finances.businesses[0].safelyWithdrawable.denarii,
    observation.finances.businesses[0].safelyWithdrawable.denarii,
  );
  assert.ok(Buffer.byteLength(prepared.preparedBody!) <= 24000);
});

test('recent cash flow is bounded, persists, excludes capital and separates legacy losses', () => {
  const { w, b } = setup();
  accounts(w, b).materials = 999999;
  w.time = 100;
  const entry = (amount: number, reason: string, from: string, to: string) =>
    recordMoney(w, { id: w.time, time: w.time, amount, reason, from, to, kind: 'transfer' });
  entry(5000, 'investment', 'toby', b.id);
  entry(7000, 'purchase', 'buyer', b.id);
  entry(2000, 'sale', b.id, 'supplier');
  entry(1000, 'wage', b.id, 'worker');
  entry(3000, 'withdrawal', b.id, 'toby');
  assert.equal(recentOperatingCash(w, b)?.amount, 4000);
  for (let hour = 1; hour <= 40; hour++) {
    w.time = hour * 3600 + 100;
    entry(100, 'purchase', 'buyer', b.id);
  }
  assert.ok(b.accounts!.recentOperating!.hours.length <= 25);
  assert.equal(recentOperatingCash(w, b)?.amount, 2400);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    assert.deepEqual(
      recentOperatingCash(
        saved,
        saved.buildings.find((q) => q.id === b.id)!,
      ),
      recentOperatingCash(w, b),
    );
  } finally {
    store.close();
  }
  w.time += 86400 * 2;
  assert.equal(recentOperatingCash(w, b)?.amount, 0);
});

test('an agreed cash draw executes once, preserves claims and survives serialized restart', () => {
  const f = setup();
  const cash = f.p.cash;
  assert.ok(recordCommitment(f.state, request, 'message1', f.human.id, f.w, f.human.id));
  assert.equal(f.b.investment, 4789330, 'agreement is not execution');
  assert.ok(run(f, nextAction(f)));
  assert.equal(f.b.investment, 1000000 + 2268);
  assert.equal(f.p.cash - cash, 4789330 - 1002268);
  assert.equal(f.state.commitments![0].status, 'completed');
  f.state = JSON.parse(JSON.stringify(f.state));
  f.b.investment += 100000;
  assert.deepEqual(commitmentChoices(f.w, f.p, f.state), []);
  assert.equal(f.p.cash - cash, 4789330 - 1002268, 'later revenue does not repeat the old draw');
});

test('live withdrawal guards reject changed cash, investor claims and lost ownership', () => {
  for (const change of ['cash', 'claim', 'owner'] as const) {
    const f = setup();
    recordCommitment(f.state, request, 'message', f.human.id, f.w);
    const a = nextAction(f);
    if (change === 'cash') f.b.investment -= 5000;
    if (change === 'claim') f.b.stakes![0].claim += 5000;
    if (change === 'owner') f.b.owner = f.human.id;
    assert.throws(() => checkBusinessAction(f.w, f.p, f.state, a));
    assert.equal(f.state.commitments![0].status, 'pending');
    assert.equal(f.state.commitments![0].businessProgress?.withdrawn, undefined);
  }
});

test('price change then cash draw uses the new operating reserve and durable receipts', () => {
  const f = setup();
  f.b.stock = { flour: 0, bread: 0 };
  const business = {
    building: f.b.id,
    keepDenarii: 0,
    pricing: { item: 'flour', side: 'buy' as const, enabled: true, priceDenarii: 41.5 },
  };
  recordCommitment(f.state, { ...request, business }, 'message', f.human.id, f.w);
  const price = nextAction(f);
  assert.equal(price.type, 'buildingAdmin');
  assert.ok(run(f, price));
  assert.equal(f.b.buy.flour, 4150);
  assert.equal(f.state.commitments![0].status, 'pending');
  f.state = JSON.parse(JSON.stringify(f.state));
  const draw = nextAction(f);
  assert.equal(draw.type, 'investment');
  run(f, draw);
  assert.equal(f.b.investment, retainedCapital(f.w, f.b) + 2268);
  assert.equal(f.state.commitments![0].status, 'completed');
});

test('overstocked reopening is declined and an explicit pause is not automatically undone', () => {
  const f = setup();
  const business = {
    building: f.b.id,
    keepDenarii: null,
    pricing: { item: 'flour', side: 'buy' as const, enabled: true, priceDenarii: 41.5 },
  };
  assert.match(businessRequestBlocker(f.w, f.p, business)!, /already have 206/);
  business.pricing.enabled = false;
  recordCommitment(f.state, { ...request, business }, 'message', f.human.id, f.w);
  run(f, nextAction(f));
  f.b.stock = { flour: 0, bread: 0 };
  f.state = JSON.parse(JSON.stringify(f.state));
  assert.deepEqual(ownerBidRoutine(f.w, f.p, f.state), []);
});

test('surplus choice remains available when an owner already has more than a farm budget', () => {
  const f = setup();
  f.p.cash = 50000000;
  const home = makeBuilding('home', 'home', 30, 30);
  home.owner = f.p.id;
  f.p.home = home.id;
  f.w.buildings.push(home);
  const choices = capitalChoices(f.w, f.p);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].expectedCash, undefined, 'capital transfer must not look like earnings');
  assert.match(choices[0].description, /opportunity I choose/);
});

test('business schema stays strict, promises are checked and cancellation respects channel/world', () => {
  const schema = conversationTool.parameters as any;
  const g = schema.properties.gameplayRequest.anyOf.find((s: any) => s.type === 'object');
  assert.ok(g.required.includes('business'));
  const f = setup();
  recordCommitment(f.state, request, 'private', f.human.id, f.w, f.human.id);
  assert.equal(
    recordCommitment(f.state, { ...request, cancel: true }, 'public', f.human.id, f.w, null),
    false,
  );
  assert.equal(
    recordCommitment(
      f.state,
      { ...request, cancel: true },
      'other-world',
      f.human.id,
      { ...f.w, id: 'elsewhere' },
      f.human.id,
    ),
    false,
  );
  assert.ok(unqueuedPromise("I'll withdraw the surplus."));
  assert.ok(unqueuedPromise('I will set my buy price.'));
  assert.equal(unqueuedPromise("I'll work out the numbers."), false);
});

import { Residents } from '../src/server/npc/residents.ts';
import { Universe } from '../src/server/universe.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { say } from '../src/shared/simulation.ts';
test('chat agreement reaches actual owner actions after restart without extra gameplay model calls', async (t) => {
  let now = Date.now(),
    chatCalls = 0,
    gameCalls = 0;
  t.mock.method(Date, 'now', () => now);
  const f = setup();
  delete f.w.players[f.p.id];
  f.human.online = true;
  const store = new Store(':memory:'),
    universe = new Universe(store),
    worlds = new Map([[f.w.id, f.w]]);
  const idle = {
    intent: 'Wait',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 60 }],
    repeat: 1,
    reconsiderSeconds: 60,
  };
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'toby',
        name: 'Toby Finch',
        provider: 'jev',
        activeAlone: true,
        intervalMs: 5000,
      }),
      brain: {
        async decide() {
          gameCalls++;
          return { decision: idle, inputTokens: 0, outputTokens: 0 };
        },
      },
      dialogue: {
        provider: 'anthropic' as const,
        rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
        brain: {
          async decide(input: any) {
            chatCalls++;
            if (chatCalls === 1) {
              assert.equal(input.observation.finances.businesses[0].tillCash.denarii, 47893.3);
              assert.equal(input.observation.currentConversation.speakerName, 'BioHaze');
            }
            return {
              decision: { ...idle, speech: { text: 'I have withdrawn it already.', to: null } },
              gameplayRequest: request,
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
    const p = f.w.players[r.status()[0].playerId];
    f.b.owner = p.id;
    p.x = 0;
    p.z = 10;
    p.inventory = { water: 10, bread: 10 };
    const cash = p.cash;
    say(
      f.w,
      f.human.name,
      'Toby, withdraw the excess bakery cash, keeping 10000d in the till.',
      'chat',
    );
    r.capture(f.w);
    r.tick(0.5, now);
    await r.settled();
    assert.equal(r.memory.load('toby')!.commitments![0].status, 'pending');
    assert.match(
      f.w.messages.filter((m) => m.name === p.name && m.kind === 'chat').at(-1)!.text,
      /No cash has been withdrawn/,
    );
    r.close();
    r = new Residents(store, universe, worlds, options);
    for (let i = 0; i < 100 && r.memory.load('toby')!.commitments![0].status !== 'completed'; i++) {
      now += 500;
      r.tick(0.5, now);
      await r.settled();
    }
    assert.equal(r.memory.load('toby')!.commitments![0].status, 'completed');
    assert.equal(f.b.investment, 1002268);
    assert.equal(p.cash - cash, 3787062);
    assert.equal(chatCalls, 2, 'initial reply plus the existing bounded agreement receipt');
    assert.equal(gameCalls, 0, 'a sole accepted feasible stage requires no paid selection');
  } finally {
    r.close();
    store.close();
  }
});

import { constructionBudget } from '../src/server/npc/construction-projects.ts';
import { pickBuildSite } from '../src/server/npc/chains.ts';
test('a small remaining housing shortfall still has a capital draw', () => {
  const w = createWorld('test', 'Town', 'server'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.investment = 2000000;
  const quote = constructionBudget(w, p, 'home', pickBuildSite(w, p, 'home')!)!;
  p.cash = quote.total - 5000;
  const action = capitalChoices(w, p)[0]?.plan.find(
    (s) => s.kind === 'act' && s.action.type === 'investment',
  );
  assert.ok(action?.kind === 'act' && action.action.type === 'investment');
  assert.equal(action.action.amount, 5000);
});
