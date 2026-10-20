// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { NpcMemory, type ResidentState } from '../src/server/npc/memory.ts';
import { NpcBudget, budgetSchema } from '../src/server/npc/budget.ts';
import { createWorld, addPlayer, advance, makeBuilding } from '../src/shared/simulation.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { Universe } from '../src/server/universe.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import {
  careerChoices,
  startCareer,
  continueCareer,
  finishCareer,
} from '../src/server/npc/projects.ts';
import { planQuotes, changedQuote } from '../src/server/npc/execution.ts';
import { inspectionChoices, perceivedWorld } from '../src/server/npc/perception.ts';
import { shortlist, decisionDomain } from '../src/server/npc/planning.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import type { FarmerChoice } from '../src/server/npc/farmer.ts';

test('chat cannot consume protected daily/monthly spending or request capacity, including across restart', () => {
  const store = new Store(':memory:');
  try {
    const memory = new NpcMemory(store);
    const config = budgetSchema.parse({ dailyUsd: 1, monthlyUsd: 1, callsPerHour: 4 });
    let budget = new NpcBudget(memory, config);
    const rates = { inputUsdPerMillion: 100, outputUsdPerMillion: 0 };
    const id = budget.reserve('chatty', 2000, 0, Date.now(), rates, 'chat')!;
    assert.ok(id);
    budget.failed(id); // unknown provider billing must not free the protection
    budget = new NpcBudget(memory, config);
    assert.equal(budget.reserve('chatty', 2000, 0, Date.now(), rates, 'chat'), undefined);
    assert.ok(budget.reserve('worker', 2000, 0, Date.now(), rates, 'gameplay'));
    assert.ok(budget.usage().dayUsd <= 1);
    const now = Date.now() + 86400000;
    assert.equal(
      budget.reserve('chatty', 2000, 0, now, rates, 'chat'),
      undefined,
      'monthly ceiling also persists',
    );
    const calls = new NpcBudget(
      memory,
      budgetSchema.parse({ callsPerHour: 2, dailyUsd: 10, monthlyUsd: 10 }),
    );
    assert.equal(
      calls.reserve(
        'chatty',
        0,
        0,
        Date.now(),
        { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
        'chat',
      ),
      undefined,
    );
  } finally {
    store.close();
  }
});

function fixture() {
  const w = createWorld('puddlewick', 'Test', 'server'),
    p = addPlayer(w, 'worker', 'Worker');
  const state = {
    world: w.id,
    playerId: p.id,
    plan: [],
    index: 0,
    intent: '',
  } as unknown as ResidentState;
  p.hunger = p.thirst = 0;
  p.inventory = { bread: 10, water: 20, chainsaw: 1 };
  p.cash = 200000;
  return { w, p, state };
}

test('trade career retains a temporary blocker, resumes, and archives measured outcomes instead of forgetting', () => {
  const { w, p, state } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!,
    bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  for (const b of w.buildings) delete b.buy.flour;
  mill.stock.flour = 20;
  mill.sell.flour = 100;
  bakery.buy.flour = 2000;
  bakery.stock.flour = 0;
  bakery.investment = 1000000;
  const choice = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.source === mill.id && c.careerGoal?.target === bakery.id,
  )!;
  assert.ok(choice);
  startCareer(w, p, state, choice.careerGoal!);
  mill.stock.flour = 0;
  assert.equal(continueCareer(w, p, state), undefined);
  assert.ok(state.career?.blockedSince !== undefined);
  mill.stock.flour = 20;
  w.time += 601;
  assert.ok(continueCareer(w, p, state));
  assert.equal(state.career?.blockedSince, undefined);
  p.cash += 1234;
  finishCareer(w, p, state, 'Review completed');
  assert.equal(state.projectHistory?.[0].liquidChange, 1234);
  assert.equal(state.career, undefined);
});

test('price protection uses observed quotes and only notices adverse changes on arrival', () => {
  const { w, p, state } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.sell.flour = 100;
  p.x = mill.x;
  p.z = mill.z;
  const action = {
    type: 'trade' as const,
    building: mill.id,
    item: 'flour',
    quantity: 2,
    direction: 'buy' as const,
  };
  const quotes = planQuotes(perceivedWorld(w, p, state), [{ kind: 'act', action }]);
  mill.sell.flour = 200;
  p.x += 100;
  assert.equal(changedQuote(w, p, action, quotes), undefined);
  p.x = mill.x;
  assert.match(changedQuote(w, p, action, quotes)!, /changed/);
  mill.sell.flour = 90;
  assert.equal(changedQuote(w, p, action, quotes), undefined);
});

test('inspection does not send homeless residents to occupied private cottages', () => {
  const { w, p, state } = fixture();
  const home = makeBuilding('private', 'home', p.x, p.z);
  home.owner = 'someone';
  home.forSale = false;
  w.buildings.push(home);
  assert.ok(!inspectionChoices(w, p, state).some((c) => c.id === 'inspect_private'));
  home.forSale = true;
  assert.ok(inspectionChoices(w, p, state).some((c) => c.id === 'inspect_private'));
});

test('a broad candidate pool retains multiple domains, rotates alternatives and never truncates a trade', () => {
  const choices: FarmerChoice[] = Array.from({ length: 100 }, (_, i) => ({
    id: 'trade_' + i,
    description: `Buy ${i} wheat at farm; sell at mill; profit ${i * 10} after fuel.`,
    careerGoal: { kind: 'trade', target: 'mill', source: 'farm', item: 'wheat' },
    plan: [{ kind: 'wait', seconds: 1 }],
    expectedCash: i * 10,
    durationSeconds: 10,
  }));
  choices.push({
    id: 'build',
    description: 'Complete my house',
    careerGoal: { kind: 'housing', target: 'home' },
    plan: [{ kind: 'wait', seconds: 1 }],
  });
  const first = shortlist(choices, 'farmer', 0);
  assert.ok(first.some((c) => decisionDomain(c) === 'housing'));
  const seen = new Set<string>();
  for (let t = 0; t < 20; t++)
    shortlist(choices, 'farmer', t * 1800).forEach((c) => seen.add(c.id));
  assert.ok(seen.size > 18);
  const prepared = new JevBrain('unused', 'test').prepare({
    instructions: '',
    observation: { choices, calendar: { season: 'winter' }, currentWork: { remaining: 100 } },
  });
  const body = JSON.parse(prepared.preparedBody!);
  for (const [id, c] of Object.entries(body.questions.next_action.criteria) as [string, any][])
    assert.equal(c.description, choices.find((c) => c.id === id)!.description);
  assert.equal(body.state.calendar.season, 'winter');
  assert.equal(body.state.currentWork.remaining, 100);
});

for (const failure of ['budget', 'provider'] as const)
  test(`${failure} outage does not block a healthy, broke Mabel from earning through ordinary labour, including restart`, async () => {
    const store = new Store(':memory:'),
      universe = new Universe(store);
    const w = createWorld('puddlewick', 'Test', 'server');
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const worlds = new Map([[w.id, w]]);
    let calls = 0;
    const options = [
      {
        config: npcConfigSchema.parse({
          id: 'mabel',
          provider: 'jev',
          presence: 'always',
          activeAlone: true,
        }),
        brain: {
          async decide(): Promise<never> {
            calls++;
            throw Error('AI provider HTTP 503');
          },
        },
      },
    ];
    const cap = failure === 'budget' ? { dailyUsd: 0 } : {};
    let residents = new Residents(store, universe, worlds, options, cap);
    const p = w.players[residents.status()[0].playerId];
    const office = w.buildings.find((b) => b.kind === 'workhouse')!;
    p.cash = p.bank = 0;
    p.hunger = p.thirst = 0;
    p.inventory = {};
    p.x = office.x;
    p.z = office.z + 12;
    p.fuel = 60;
    // No funded arbitrage; the office is the ordinary bootstrap opportunity.
    for (const b of w.buildings) b.buy = {};
    let now = Date.now();
    try {
      residents.tick(0.1, now);
      await residents.settled();
      assert.equal(calls, failure === 'budget' ? 0 : 1);
      for (let i = 0; i < 800 && p.cash === 0; i++) {
        now += 100;
        advance(w, 0.1);
        residents.tick(0.1, now);
        if (i % 10 === 0) await residents.settled();
        if (i === 100) {
          residents.close();
          residents = new Residents(store, universe, worlds, options, cap);
        }
      }
      assert.ok(p.cash > 0, 'earned real wages without waiting for a strategic answer');
      assert.equal(p.deaths, 0);
      assert.ok(residents.memory.recent('mabel', 100).some((e) => e.kind === 'hustle'));
    } finally {
      residents.close();
      store.close();
    }
  });

test('saving toward an observed business pairs a concrete funding target with real income actions', async () => {
  const { savingChoices } = await import('../src/server/npc/ambitions.ts');
  const { w, p, state } = fixture();
  p.cash = 10000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = 'seller';
  mill.forSale = true;
  mill.price = 200000;
  mill.sell.flour = 5000;
  mill.stock.wheat = 30;
  mill.investment = 100000;
  for (const b of w.buildings) {
    b.buy.logs = 1000;
    b.investment = 100000;
  }
  const offers = savingChoices(w, p, state);
  assert.ok(offers.length);
  for (const choice of offers) {
    assert.ok(choice.ambition!.requiredCash > p.cash);
    assert.ok(
      choice.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'sell',
      ),
    );
    assert.ok((choice.expectedCash ?? 0) > 0);
  }
  state.ambition = offers[0].ambition;
  const target = w.buildings.find((b) => b.id === state.ambition!.target)!;
  target.owner = p.id;
  savingChoices(w, p, state);
  assert.equal(state.ambition, undefined, 'ownership satisfies the saved milestone');
});

test('Jev retains quote and savings metadata across transport rather than accepting later changed prices', async () => {
  const choice: FarmerChoice = {
    id: 'income',
    description: 'Earn toward a mill',
    plan: [{ kind: 'wait', seconds: 1 }],
    tradeQuotes: { 'mill:buy:flour': 100 },
    ambition: {
      world: 'test',
      deaths: 0,
      target: 'mill',
      kind: 'business',
      requiredCash: 50000,
      chosenAt: 1,
    },
  };
  const brain = new JevBrain('unused', 'test', async () =>
    Response.json({
      answers: {
        next_action: {
          type: 'choice',
          choice: 'income',
          confidence: 1,
          probabilities: { income: 1 },
        },
      },
      usage: { input_tokens: 1, output_tokens: 0 },
    }),
  );
  const result = await brain.decide(
    { instructions: '', observation: { choices: [choice] } },
    new AbortController().signal,
  );
  assert.deepEqual(result.tradeQuotes, choice.tradeQuotes);
  assert.deepEqual(result.ambition, choice.ambition);
});

test('experience ranking does not punish moving cash into a business or unsold inventory as a failed trade', async () => {
  const { rankIdeas } = await import('../src/server/npc/hypotheses.ts');
  const idea: FarmerChoice = {
    id: 'fund',
    description: 'Fund my mill',
    plan: [{ kind: 'wait', seconds: 1 }],
    expectedCash: 0,
  };
  const other = { ...idea, id: 'other', description: 'Another idea' };
  const outcome = {
    goal: 'Fund my mill',
    elapsedSeconds: 60,
    cashChange: -10000,
    bankChange: 0,
    liquidCapitalChange: 0,
    netAssetChange: 0,
    healthChange: 0,
    previousJob: null,
    currentJob: null,
  };
  assert.equal(rankIdeas([idea, other], [outcome])[0].id, 'fund');
  assert.equal(
    rankIdeas(
      [idea, other],
      [{ ...outcome, netAssetChange: -10000, liquidCapitalChange: -10000 }],
    )[0].id,
    'other',
  );
});

test('project receipts exclude unrelated side hustles while the main project is blocked', async () => {
  const { projectTrade } = await import('../src/server/npc/projects.ts');
  const goal = { kind: 'trade' as const, source: 'farm', target: 'mill', item: 'wheat' };
  assert.equal(projectTrade(goal, { building: 'mill', item: 'wheat' }), true);
  assert.equal(projectTrade(goal, { building: 'market', item: 'logs' }), false);
  assert.equal(projectTrade(goal, { building: 'mill', item: 'flour' }), false);
});

test('unclassified historical calls retain global charges without consuming the new chat-only allocation', () => {
  const store = new Store(':memory:');
  try {
    const memory = new NpcMemory(store),
      now = Date.now();
    store.db
      .prepare(
        'INSERT INTO npc_calls(resident,at,reserved,charged,status,lane) VALUES (?,?,?,?,?,?)',
      )
      .run('old', now, 19.99, 19.99, 'uncertain', 'legacy');
    const budget = new NpcBudget(
      memory,
      budgetSchema.parse({ monthlyUsd: 40, dailyUsd: 40, callsPerHour: 120 }),
    );
    assert.equal(budget.usage(now).monthUsd, 19.99);
    assert.equal(budget.usage(now).chatMonthUsd, 0);
    assert.ok(
      budget.reserve(
        'mabel',
        5000,
        1000,
        now,
        { inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
        'chat',
      ),
    );
    assert.equal(
      new NpcBudget(memory, budgetSchema.parse({ monthlyUsd: 20, dailyUsd: 40 })).reserve(
        'mabel',
        50000,
        1000,
        now,
        { inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
        'chat',
      ),
      undefined,
      'legacy spending still exhausts the global cap',
    );
  } finally {
    store.close();
  }
});
