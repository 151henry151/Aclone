// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation.ts';
import {
  rememberFollowThrough,
  followThroughPlan,
  pursuingFollowThrough,
} from '../src/server/npc/follow-through.ts';
import { jobTraining } from '../src/server/npc/job-training.ts';
import { suspendPlan, resumePlan, hustleRoutine } from '../src/server/npc/routines.ts';
import { operation, operationAction } from '../src/server/npc/player-operations.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';

function setup() {
  const w = createWorld('follow', 'Follow through', 'server');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  w.settings.activeWork = false;
  w.tier = 2;
  const p = addPlayer(w, 'worker', 'Worker');
  p.cash = 1000000;
  p.skills = ['farmer', 'baker'];
  p.vehicle = 5;
  p.inventory = { bread: 10, water: 20 };
  const press = makeBuilding('press', 'winery', 36, 0);
  press.owner = 'owner';
  press.investment = 100000;
  press.stock = { grapes: 30, wood: 6 };
  const school = makeBuilding('school', 'school', 0, 0);
  w.buildings.push(press, school);
  const state = {
    world: w.id,
    playerId: p.id,
    plan: [],
    index: 0,
    intent: '',
    repeats: 1,
  } as unknown as ResidentState;
  return { w, p, press, state };
}
function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, plan: Step[]) {
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
}
test('training survives a different household career and restart, then accepts the job and produces wine', () => {
  const { w, p, press, state } = setup();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  p.job = farm.id;
  farm.employees = [p.id];
  const training = jobTraining(w, p, press)!;
  rememberFollowThrough(w, p, state, training.plan, training.careerGoal);
  run(w, p, training.plan);
  const afterTuition = p.cash;
  assert.equal(p.learning?.skill, 'vintner');
  // A household choice can replace the ordinary career while the lesson runs.
  state.career = { kind: 'housing', target: 'cottage' } as any;
  let restored = JSON.parse(JSON.stringify(state));
  assert.equal(followThroughPlan(w, p, restored), undefined);
  advance(w, p.learning!.end - w.time + 0.1);
  const plan = followThroughPlan(w, p, restored)!;
  assert.ok(plan);
  assert.deepEqual(
    plan.filter((s) => s.kind === 'act').map((s) => s.action.type),
    ['quit', 'job'],
  );
  run(w, p, plan);
  assert.equal(p.cash, afterTuition, 'tuition is not charged again');
  assert.equal(p.job, press.id);
  assert.ok(!farm.employees.includes(p.id));
  assert.equal(followThroughPlan(w, p, restored), undefined);
  assert.equal(restored.followThrough, undefined, 'actual employment completes the goal');
  advance(w, 2400);
  assert.equal(press.stock.wine, 3);
  assert.ok(p.cash > afterTuition, 'the trained employee earns wages');
});
test('a filled or unfunded vacancy preserves the old job; player requests and death override follow-through', () => {
  const { w, p, press, state } = setup();
  const training = jobTraining(w, p, press)!;
  rememberFollowThrough(w, p, state, training.plan, training.careerGoal);
  p.skills.push('vintner');
  p.job = 'old-job';
  press.investment = 0;
  assert.equal(followThroughPlan(w, p, state), undefined);
  assert.equal(p.job, 'old-job');
  press.investment = 100000;
  press.hiringLimit = 0;
  w.time += 61;
  assert.equal(followThroughPlan(w, p, state), undefined);
  press.hiringLimit = 2;
  w.time += 61;
  state.commitments = [{ world: w.id, status: 'pending' }] as any;
  assert.equal(followThroughPlan(w, p, state), undefined);
  state.commitments = [];
  assert.ok(followThroughPlan(w, p, state));
  p.deaths++;
  assert.equal(followThroughPlan(w, p, state), undefined);
  assert.equal(state.followThrough, undefined);
});
test('a brewery trip survives the review deadline and a meal, finishes materials, and never builds twice', () => {
  const { w, p, state } = setup();
  const site = { x: -90, z: -130 };
  const plan: Step[] = [{ kind: 'move', ...site }, operation('construct', { kind: 'brewery' })];
  // Keep known materials on sale for both the initial budget and delivery legs.
  for (const item of ['wood', 'blocks']) {
    const market = w.buildings.find((b) => b.kind === 'market')!;
    market.stock[item] = 100;
    market.sell[item] = 100;
  }
  rememberFollowThrough(w, p, state, plan);
  state.plan = plan;
  state.until = state.nextAt = 300000;
  w.time += 301;
  assert.equal(pursuingFollowThrough(w, p, state), true);
  state.index = 1;
  p.x = site.x;
  p.z = site.z;
  suspendPlan(w, p, state);
  state.plan = [];
  state.index = 0;
  p.x = 0;
  p.z = 0;
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(resumePlan(w, p, restored), true);
  assert.ok(restored.plan.some((s: Step) => s.kind === 'move' && s.x === site.x && s.z === site.z));
  run(w, p, restored.plan);
  const built = w.buildings.at(-1)!;
  assert.equal(built.kind, 'brewery');
  restored.followThrough.building = built.id; // Executor records the actual new foundation.
  let legs = 0;
  while (built.construction && legs++ < 30) {
    const next = followThroughPlan(w, p, restored);
    assert.ok(next, 'a funded construction site has a next delivery');
    run(w, p, next);
  }
  assert.ok(!built.construction);
  assert.equal(followThroughPlan(w, p, restored), undefined);
  assert.equal(w.buildings.filter((b) => b.kind === 'brewery').length, 1);
});
test('construction rechecks funding, site occupation, life and repeated failures', () => {
  for (const change of ['cash', 'occupied', 'life', 'failures', 'world', 'expired']) {
    const { w, p, state } = setup();
    const plan: Step[] = [
      { kind: 'move', x: -90, z: -130 },
      operation('construct', { kind: 'brewery' }),
    ];
    rememberFollowThrough(w, p, state, plan);
    if (change === 'cash') {
      p.cash = 0;
      p.bank = 0;
    }
    if (change === 'occupied') w.buildings.push(makeBuilding('obstacle', 'home', -90, -130));
    if (change === 'life') p.deaths++;
    if (change === 'failures') state.followThrough!.failures = 3;
    if (change === 'world') state.followThrough!.world = 'elsewhere';
    if (change === 'expired') w.time += 7 * 86400 + 1;
    assert.equal(followThroughPlan(w, p, state), undefined, change);
  }
});
test('an unemployed qualified visitor accepts ongoing production work before gathering, without stealing filled jobs', () => {
  const { w, p, press, state } = setup();
  p.skills = ['vintner'];
  p.job = undefined;
  p.inventory = { bread: 3, water: 6, pickaxe: 1 };
  const plan = hustleRoutine(w, p, state);
  assert.ok(
    plan.some((s) => s.kind === 'act' && s.action.type === 'job' && s.action.building === press.id),
  );
  run(w, p, plan);
  assert.equal(p.job, press.id);
  assert.ok(!hustleRoutine(w, p, state).some((s) => s.kind === 'act' && s.action.type === 'quit'));
  p.job = undefined;
  press.hiringLimit = 0;
  press.employees = [];
  assert.ok(
    !hustleRoutine(w, p, state).some(
      (s) => s.kind === 'act' && s.action.type === 'job' && s.action.building === press.id,
    ),
  );
});

test('resident executor retains training through its timer and a restart without another model decision', async (t) => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const { w, press } = setup();
  delete w.players.worker;
  // School and press must be visible for the ordinary perception checks.
  press.x = 30;
  press.z = 0;
  w.buildings = [w.buildings.find((b) => b.id === 'school')!, press];
  const store = new Store(':memory:');
  const universe = new Universe(store);
  let now = Date.now(),
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'student',
        name: 'Student',
        world: w.id,
        provider: 'jev',
        activeAlone: true,
        intervalMs: 5000,
      }),
      brain: {
        async decide() {
          calls++;
          const p = Object.values(w.players).find((p) => p.npc)!;
          const choice = jobTraining(w, p, press);
          return {
            decision: {
              intent: 'Train for the press',
              notebook: '',
              speech: null,
              plan: choice?.plan ?? [{ kind: 'wait' as const, seconds: 60 }],
              repeat: 1,
              reconsiderSeconds: 60,
            },
            careerGoal: choice?.careerGoal,
            inputTokens: 0,
            outputTokens: 0,
          };
        },
      },
    },
  ];
  let residents = new Residents(store, universe, new Map([[w.id, w]]), options);
  try {
    const p = w.players[residents.status()[0].playerId];
    p.skills = ['farmer', 'baker'];
    p.cash = 1000000;
    p.inventory = { bread: 3, water: 6 };
    p.x = 15;
    p.z = 0;
    for (let i = 0; i < 400 && !p.learning; i++) {
      now += 500;
      advance(w, 0.5);
      residents.tick(0.5, now);
      await residents.settled();
    }
    assert.equal(p.learning?.skill, 'vintner');
    const afterSelection = calls;
    now += 301000;
    advance(w, 301);
    residents.tick(0.5, now);
    await residents.settled();
    assert.equal(calls, afterSelection, 'review timer cannot discard the lesson target');
    residents.close();
    residents = new Residents(store, universe, new Map([[w.id, w]]), options);
    const lessonRemaining = p.learning!.end - w.time + 1;
    advance(w, lessonRemaining);
    now += lessonRemaining * 1000;
    for (let i = 0; i < 800 && p.job !== press.id; i++) {
      now += 500;
      advance(w, 0.5);
      residents.tick(0.5, now);
      await residents.settled();
    }
    assert.equal(p.job, press.id);
    assert.equal(calls, afterSelection, 'qualification leads into the actual job locally');
  } finally {
    residents.close();
    store.close();
  }
});

test('resident construction travel is not replaced when the model review timer expires', async (t) => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const { w } = setup();
  delete w.players.worker;
  const store = new Store(':memory:');
  const universe = new Universe(store);
  let now = Date.now(),
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const plan: Step[] = [
    { kind: 'move', x: -90, z: -130 },
    operation('construct', { kind: 'brewery' }),
  ];
  const residents = new Residents(store, universe, new Map([[w.id, w]]), [
    {
      config: npcConfigSchema.parse({
        id: 'builder',
        name: 'Builder',
        world: w.id,
        provider: 'jev',
        activeAlone: true,
        intervalMs: 5000,
      }),
      brain: {
        async decide() {
          calls++;
          return {
            decision: {
              intent: 'Build a brewery',
              notebook: '',
              speech: null,
              plan,
              repeat: 1,
              reconsiderSeconds: 300,
            },
            inputTokens: 0,
            outputTokens: 0,
          };
        },
      },
    },
  ]);
  try {
    const p = w.players[residents.status()[0].playerId];
    p.cash = 1000000;
    p.inventory = { bread: 3, water: 6 };
    p.x = 15;
    p.z = 0;
    residents.tick(0.5, now);
    await residents.settled();
    assert.equal(calls, 1);
    now += 500;
    residents.tick(0.5, now);
    await residents.settled();
    now += 301000;
    advance(w, 301);
    residents.tick(0.5, now);
    await residents.settled();
    assert.equal(calls, 1, 'no fresh strategic decision during accepted construction travel');
    assert.equal(residents.memory.load('builder')?.followThrough?.kind, 'construction');
  } finally {
    residents.close();
    store.close();
  }
});

test('construction refreshes forgotten site knowledge instead of abandoning remaining deliveries', () => {
  const { w, p, state } = setup();
  rememberFollowThrough(w, p, state, [
    { kind: 'move', x: -90, z: -130 },
    operation('construct', { kind: 'brewery' }),
  ]);
  assert.equal(state.followThrough?.kind, 'construction');
  if (state.followThrough?.kind !== 'construction') return;
  state.followThrough.building = 'forgotten-site';
  const plan = followThroughPlan(w, p, state)!;
  assert.ok(plan.some((s) => s.kind === 'travel' && s.destination === 'forgotten-site'));
  state.plan = plan;
  assert.equal(pursuingFollowThrough(w, p, state), true);
  const site = makeBuilding('forgotten-site', 'brewery', -90, -130);
  site.owner = 'new-owner';
  w.buildings.push(site);
  assert.equal(followThroughPlan(w, p, state), undefined);
  assert.equal(state.followThrough, undefined, 'confirmed ownership change cancels the project');
});

for (const closure of ['hiring limit', 'dismissal', 'world jobs disabled']) {
  test(`resident keeps its old job when ${closure} changes after accepting a job-switch plan`, async () => {
    const { Store } = await import('../src/server/store.ts');
    const { Universe } = await import('../src/server/universe.ts');
    const { Residents } = await import('../src/server/npc/residents.ts');
    const { npcConfigSchema } = await import('../src/server/npc/config.ts');
    const { w, press } = setup();
    delete w.players.worker;
    const store = new Store(':memory:');
    const residents = new Residents(store, new Universe(store), new Map([[w.id, w]]), [
      {
        config: npcConfigSchema.parse({
          id: 'switcher',
          name: 'Switcher',
          world: w.id,
          provider: 'jev',
          activeAlone: true,
          intervalMs: 5000,
        }),
        brain: {
          async decide() {
            return {
              decision: {
                intent: 'Take the funded press job',
                notebook: '',
                speech: null,
                plan: [
                  { kind: 'act' as const, action: { type: 'quit' as const } },
                  { kind: 'act' as const, action: { type: 'job' as const, building: press.id } },
                ],
                repeat: 1,
                reconsiderSeconds: 300,
              },
              inputTokens: 0,
              outputTokens: 0,
            };
          },
        },
      },
    ]);
    try {
      const p = w.players[residents.status()[0].playerId];
      const farm = w.buildings.find((b) => b.kind === 'farm')!;
      p.job = farm.id;
      farm.employees = [p.id];
      p.skills = ['farmer', 'vintner'];
      p.cash = 1000000;
      p.inventory = { bread: 10, water: 20 };
      p.x = press.x;
      p.z = press.z + 9;
      const now = Date.now();
      residents.tick(0.5, now);
      await residents.settled();
      assert.equal(residents.memory.load('switcher')?.plan[0]?.kind, 'act');
      if (closure === 'hiring limit') press.hiringLimit = 0;
      if (closure === 'dismissal') press.dismissedUntil = { [p.id]: w.time + 86400 };
      if (closure === 'world jobs disabled') w.settings.jobsEnabled = false;
      residents.tick(0.5, now + 500);
      await residents.settled();
      assert.equal(p.job, farm.id);
      assert.ok(farm.employees.includes(p.id));
      assert.ok(
        residents.memory
          .recent('switcher', 20)
          .some(
            (e) =>
              e.kind === 'failure' && JSON.stringify(e).includes('no longer has an available job'),
          ),
      );
    } finally {
      residents.close();
      store.close();
    }
  });
}
