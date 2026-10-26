// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation.ts';
import { buildings } from '../src/shared/catalog.ts';
import { accounts } from '../src/shared/reports.ts';
import { perceivedWorld } from '../src/server/npc/perception.ts';
import { enterpriseChoices, economicMenu } from '../src/server/npc/enterprise.ts';
import { pickBuildSite } from '../src/server/npc/chains.ts';
import { settlementChoices } from '../src/server/npc/civic-ambition.ts';
import { productionBudget } from '../src/server/npc/business-policy.ts';
import { constructionBudget } from '../src/server/npc/construction-projects.ts';
import { operation, operationAction } from '../src/server/npc/player-operations.ts';
import { townMeeting, townCharter } from '../src/shared/town-charter.ts';
import { nearbyTownPanels } from '../src/client/town-panel.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { FarmerChoice } from '../src/server/npc/farmer.ts';
import type { Step } from '../src/server/npc/decision.ts';
import { prosperityBriefing, opportunityCounts } from '../src/server/npc/prosperity.ts';
import { liquidCapital } from '../src/server/npc/wealth.ts';
import { anotherFounding, publishFoundingIntent } from '../src/server/npc/cooperation.ts';

function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'owner', 'Ada Brook');
  p.cash = 5_000_000;
  p.inventory = { bread: 10, water: 20 };
  const state = { world: w.id, playerId: p.id, plan: [], index: 0 } as unknown as ResidentState;
  function run(plan: Step[]) {
    for (const step of plan) {
      if (step.kind === 'travel') {
        const target = w.buildings.find((b) => b.id === step.destination)!;
        Object.assign(p, { x: target.x, z: target.z });
      } else if (step.kind === 'move') Object.assign(p, { x: step.x, z: step.z });
      else if (step.kind === 'act') act(w, p.id, step.action);
      else if (step.kind === 'operation') act(w, p.id, operationAction(step));
    }
  }
  return { w, p, state, run };
}

test('a full pantry still has a recurring cost and growth choices are visible in decision evidence', () => {
  const { w, p, state } = setup();
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  p.home = home.id;
  home.stock = { bread: 100, water: 100 };
  const choices = economicMenu(w, p, [], 'owner', true, state);
  const report = prosperityBriefing(w, p, choices);
  assert.ok(report.dailyReplacementCost > 0);
  assert.equal(report.householdReserve, 0);
  assert.ok(report.opportunities.some((o) => o.project.startsWith('Acquire and fund')));
  assert.ok(opportunityCounts(choices).acquisition > 0);
  assert.ok(report.earningOptions.every((o) => o.tripsForDailyMeals > 0));
});

test('business capital transfers and unsold goods are not counted as new spendable wealth', () => {
  const { w, p, run } = setup();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  const before = liquidCapital(w, p);
  run([
    { kind: 'travel', destination: mill.id },
    {
      kind: 'act',
      action: { type: 'investment', building: mill.id, direction: 'deposit', amount: 10000 },
    },
  ]);
  assert.equal(liquidCapital(w, p), before);
  mill.stock.flour = (mill.stock.flour ?? 0) + 100;
  assert.equal(liquidCapital(w, p), before, 'unsold catalogue value is not cash');
});

test('one resident building a home does not prevent another from obtaining their own shelter', () => {
  const { w, p } = setup(),
    q = addPlayer(w, 'neighbour', 'Neighbour');
  p.online = true;
  publishFoundingIntent(w, p, 'home', 'home');
  assert.equal(anotherFounding(w, q, 'home'), undefined);
  publishFoundingIntent(w, p, 'mill', 'flour');
  assert.ok(
    anotherFounding(w, q, 'mill'),
    'competing commercial founding still considers announced supply',
  );
});

test('an owner uses invested purchasing capital to obtain inputs without raiding meals, payroll or claims', () => {
  const { w, p, run } = setup();
  const mill = w.buildings.find((b) => b.kind === 'mill')!,
    farm = w.buildings.find((b) => b.kind === 'farm')!;
  mill.owner = p.id;
  mill.stock = { wheat: 0, flour: 0 };
  mill.investment = 100000;
  mill.stakes = [{ investor: 'neighbour', principal: 5000, claim: 8000, paid: 0, opened: w.time }];
  farm.stock.wheat = 50;
  farm.sell.wheat = 500;
  p.cash = 0;
  const choice = enterpriseChoices(w, p).find(
    (c) =>
      c.description.startsWith(`Supply my ${mill.name}: buy`) && c.description.includes('wheat'),
  );
  assert.ok(
    choice,
    'operating input money is spendable on inputs even with empty personal pockets',
  );
  const payroll = 3 * mill.wage * (productionBudget(w, mill)?.idealWorkers ?? 1);
  const before = mill.investment;
  run(choice.plan);
  assert.equal(p.cash, 0, 'withdrawal is exactly the procurement cost');
  assert.equal(mill.stock.wheat, 30);
  assert.equal(before - mill.investment, 15000);
  assert.ok(mill.investment >= 8000 + payroll);
  mill.stock.wheat = 0;
  mill.investment = 8000 + payroll;
  assert.ok(
    !enterpriseChoices(w, p).some((c) => c.description.startsWith(`Supply my ${mill.name}: buy`)),
  );
});

test("owners can assess their own sales, without seeing anybody else's private accounts", () => {
  const { w, p, state } = setup();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  mill.owner = p.id;
  accounts(w, mill).receipts = 10000;
  accounts(w, bakery).receipts = 99999;
  Object.assign(p, { x: bakery.x, z: bakery.z });
  for (const guide of [false, true]) {
    const known = perceivedWorld(w, p, state, guide);
    assert.equal(known.buildings.find((b) => b.id === mill.id)!.accounts!.receipts, 10000);
    assert.equal(known.buildings.find((b) => b.id === bakery.id)!.accounts, undefined);
    known.buildings.find((b) => b.id === mill.id)!.accounts!.receipts++;
    assert.equal(mill.accounts!.receipts, 10000, 'observations are copies');
  }
});

test('an owner supplies a mill from their farm and a bakery from their mill without self-trading', () => {
  const { w, p, run } = setup();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  for (const b of [farm, mill, bakery]) {
    b.owner = p.id;
    b.investment = 100000;
    b.stock = {};
  }
  farm.stock.wheat = 60;
  mill.stock.flour = 12;
  const before = p.cash + farm.investment + mill.investment + bakery.investment;
  for (const [target, item] of [
    [bakery, 'flour'],
    [mill, 'wheat'],
  ] as const) {
    const choice = enterpriseChoices(w, p).find(
      (c) =>
        c.description.startsWith(`Supply my ${target.name}: transfer`) &&
        c.description.includes(item),
    );
    assert.ok(choice, `missing ${item} delivery`);
    assert.ok(!choice.plan.some((s) => s.kind === 'act' && s.action.type === 'trade'));
    run(choice.plan);
    assert.ok(target.stock[item] > 0);
  }
  assert.equal(before, p.cash + farm.investment + mill.investment + bakery.investment);
  assert.equal(farm.stock.wheat + mill.stock.wheat, 60);
  assert.equal(mill.stock.flour + bakery.stock.flour, 12);
});

test("internal deliveries do not raid home supplies or another factory's input reserve", () => {
  const { w, p } = setup();
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  bakery.owner = p.id;
  bakery.stock.flour = 0;
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  home.stock.flour = 100;
  const other = makeBuilding('second', 'bakery', 60, 60);
  other.owner = p.id;
  other.stock.flour = 1;
  w.buildings.push(other);
  for (const b of w.buildings) if (b.owner !== p.id) b.stock.flour = 0;
  assert.ok(
    !enterpriseChoices(w, p).some(
      (c) =>
        c.description.startsWith(`Supply my ${bakery.name}: transfer`) &&
        c.description.includes('flour'),
    ),
  );
});

test('construction and civic choices survive a crowded trade menu', () => {
  const { w, p, state } = setup();
  const trades: FarmerChoice[] = Array.from({ length: 100 }, (_, i) => ({
    id: `trade${i}`,
    description: 'Trade route: an alternative',
    plan: [{ kind: 'wait', seconds: 10 }],
    careerGoal: { kind: 'trade', target: `b${i}`, source: 'source', item: 'wheat' },
  }));
  const civic: FarmerChoice = {
    id: 'civic_unique',
    description: 'Join town government',
    plan: [operation('town', { building: 'town-centre:puddlewick', operation: 'join' })],
  };
  const growth: FarmerChoice = {
    id: 'growth_unique',
    description: 'Found a useful business',
    plan: [operation('construct', { kind: 'mill' })],
  };
  const menu = economicMenu(w, p, [...trades, civic, growth], 'trader', false, state);
  assert.ok(menu.some((c) => c.id === civic.id));
  assert.ok(menu.some((c) => c.id === growth.id));
  assert.ok(menu.length <= 44);
});

test('builders use the real map bounds rather than the old village-sized box', () => {
  const { w, p } = setup();
  w.settings.seaLevel = -100;
  p.x = 700;
  p.z = 700;
  const site = pickBuildSite(w, p, 'home');
  assert.ok(site && site.x > 230 && site.z > 230);
});

test('town-centre government remains accessible without a council building, with normal range checks', () => {
  const { w, p } = setup();
  const town = w.towns[0];
  w.buildings = w.buildings.filter((b) => b.id !== town.plinth);
  const meeting = townMeeting(w, town);
  Object.assign(p, { x: town.x + 100, z: town.z + 100 });
  assert.throws(
    () => act(w, p.id, { type: 'town', building: meeting.id, operation: 'join' }),
    /near|clos|visit/i,
  );
  assert.equal(nearbyTownPanels(w, p), '');
  Object.assign(p, { x: town.x, z: town.z });
  assert.match(nearbyTownPanels(w, p), /Become a resident|Join|residen/i);
  act(w, p.id, { type: 'town', building: meeting.id, operation: 'join' });
  assert.ok(town.residents.includes(p.id));
  assert.throws(() =>
    act(w, p.id, { type: 'town', building: 'town-centre:invented', operation: 'join' }),
  );
});

test('a prosperous owner can choose to found a distant town and pays the normal charter', () => {
  const { w, p, run, state } = setup();
  w.settings.seaLevel = -100;
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.investment = 100000;
  accounts(w, mill).receipts = 20000;
  // All starter supplies have actually been visited; no unseen quote privilege.
  for (const b of w.buildings) {
    Object.assign(p, { x: b.x, z: b.z });
    perceivedWorld(w, p, state);
  }
  Object.assign(p, { x: 0, z: 0 });
  const choice = settlementChoices(perceivedWorld(w, p, state), p)[0];
  assert.ok(choice);
  const before = p.cash,
    towns = w.towns.length;
  run(choice.plan);
  assert.equal(w.towns.length, towns + 1);
  assert.equal(w.towns.at(-1)!.founder, p.id);
  assert.equal(p.cash, before - townCharter(w).foundingCost);
  assert.deepEqual(settlementChoices(w, p), [], 'one founded town before further expansion');
});

test('startup and operating budgets cover a full crew and starter livestock', () => {
  const { w, p } = setup();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.employees = [];
  mill.stock = {};
  const budget = productionBudget(w, mill)!;
  assert.ok(budget.reserve >= 3 * (budget.inputs + budget.idealWorkers * mill.wage));
  mill.stock.wheat = 500;
  assert.equal(
    productionBudget(w, mill)!.reserve,
    6 * budget.idealWorkers * mill.wage,
    'held inputs already fund production; retain cash for the crew, not duplicate stock',
  );
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  for (const item of Object.keys(buildings.dairy.materials)) {
    shop.stock[item] = 100;
    shop.sell[item] = 100;
  }
  shop.stock.cows = 2;
  shop.sell.cows = 20000;
  p.x = 80;
  p.z = -130;
  const dairy = constructionBudget(w, p, 'dairy', p);
  assert.ok(dairy && dairy.livestockCost >= 40000);
  for (const b of w.buildings) b.stock.cows = 0;
  assert.equal(
    constructionBudget(w, p, 'dairy', p),
    undefined,
    'do not build a shed with no source of animals',
  );
});

test('the controller reviews a completed career but does not replace an accepted errand with a routine shift', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const { reviewInterval } = await import('../src/server/npc/prosperity.ts');
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const worlds = new Map([[w.id, w]]);
  let calls = 0;
  const brain = {
    async decide() {
      calls++;
      return {
        decision: {
          intent: 'Review my next investment',
          notebook: '',
          speech: null,
          plan: [{ kind: 'wait' as const, seconds: 10 }],
          repeat: 1,
          reconsiderSeconds: 600,
        },
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
  const options = [
    { config: npcConfigSchema.parse({ id: 'mabel', provider: 'jev', activeAlone: true }), brain },
  ];
  let r = new Residents(store, universe, worlds, options);
  try {
    const p = w.players[r.status()[0].playerId];
    p.hunger = p.thirst = 0;
    p.cash = 100000;
    p.inventory = { bread: 10, water: 20 };
    const mill = w.buildings.find((b) => b.kind === 'mill')!;
    mill.stock.wheat = 100;
    mill.investment = 100000;
    p.skills = ['miller'];
    p.job = mill.id;
    mill.employees = [p.id];
    p.activeUntil = 0;
    Object.assign(p, { x: mill.x, z: mill.z + 10 });
    const now = Date.now();
    r.close();
    const state = r.memory.load('mabel')!;
    const errand: Step[] = [
      { kind: 'wait', seconds: 1 },
      { kind: 'travel', destination: w.buildings.find((b) => b.kind === 'starport')!.id },
    ];
    Object.assign(state, {
      plan: errand,
      index: 1,
      repeats: 1,
      until: now + 86400000,
      nextAt: now + 86400000,
      waitUntil: 0,
      needsDecision: false,
      pending: false,
      strategyReviewedAt: w.time,
    });
    delete state.routine;
    r.memory.save('mabel', state);
    r = new Residents(store, universe, worlds, options);
    r.tick(0.1, now);
    await r.settled();
    assert.equal(calls, 0);
    assert.deepEqual(r.memory.load('mabel')!.plan, errand);
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM npc_journal WHERE kind='employment-routine'").get()!
        .n,
      0,
    );
    r.close();
    const completed = r.memory.load('mabel')!;
    Object.assign(completed, {
      plan: errand,
      index: errand.length,
      waitUntil: 0,
      strategyReviewedAt: w.time,
    });
    r.memory.save('mabel', completed);
    w.time += reviewInterval(p.id) + 1;
    r = new Residents(store, universe, worlds, options);
    r.tick(0.1, now + 5000);
    await r.settled();
    assert.equal(calls, 1, 'a periodic strategy review reaches the brain');
    assert.equal(r.memory.load('mabel')!.strategyReviewedAt, w.time);
    assert.equal(w.messages.filter((m) => m.name === p.name).length, 0, 'no unsolicited speech');
  } finally {
    r.close();
    store.close();
  }
});
