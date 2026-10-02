// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  habitSchema,
  initialPresence,
  beginVisit,
  nextVisit,
  timeZoneSchema,
} from '../src/server/npc/habits.ts';
import { population, veteranHabits } from '../src/server/npc/population.ts';
import { npcConfigSchema, residentsEnvironment } from '../src/server/npc/config.ts';
import { homecomingPlan, offlineReadiness, returnDelay } from '../src/server/npc/homecoming.ts';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { stepSchema } from '../src/server/npc/decision.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';

test('19 distinct residents keep provider split, varied preferences, explicit population enable and shared caps', () => {
  const env = {
    NPC_ENABLED: 'true',
    NPC_BAKER_ENABLED: 'true',
    NPC_FARMER_ENABLED: 'true',
    NPC_INDEPENDENT_ENABLED: 'true',
    NPC_POPULATION_ENABLED: 'true',
    OPENAI_API_KEY: 'test',
    CLAUDE_API_KEY: 'test',
    JEV_API_KEY: 'test',
  };
  const result = residentsEnvironment(env)!;
  assert.equal(result.residents.length, 19);
  assert.equal(new Set(result.residents.map((r) => r.config.name)).size, 19);
  assert.equal(new Set(result.residents.map((r) => r.config.personality)).size, 19);
  assert.ok(result.residents.every((r) => r.config.provider === 'jev'));
  assert.equal(result.residents[0].config.presence, 'always');
  assert.equal(result.residents[0].dialogue?.provider, 'openai');
  assert.ok(
    result.residents
      .slice(1)
      .every((r) => r.config.presence === 'scheduled' && r.dialogue?.provider === 'anthropic'),
  );
  assert.ok(result.residents.slice(1, 4).every((r) => r.config.habit.multiplier === 3));
  assert.equal(new Set(population.map((p) => p.preference)).size, 6);
  assert.equal(result.budget.monthlyUsd, 20);
  assert.equal(
    residentsEnvironment({ ...env, NPC_POPULATION_ENABLED: 'false' })!.residents.length,
    4,
  );
  assert.throws(() => residentsEnvironment({ NPC_POPULATION_ENABLED: 'true' }), /CLAUDE_API_KEY/);
  assert.throws(() => residentsEnvironment({ ...env, NPC_TIME_ZONE: 'Mars' }), /time zone/);
});

test('habitual sessions vary by day, scatter arrivals, respect local hours/DST and average occasional long visits', () => {
  const start = Date.parse('2026-10-01T00:00:00Z');
  const arrivals = population.map(
    (p) => initialPresence(p.id, p.habit, 'America/New_York', start).nextAt,
  );
  assert.equal(new Set(arrivals).size, 15);
  assert.ok(Math.max(...arrivals) - Math.min(...arrivals) > 16 * 3600000);
  let long = 0,
    short = 0;
  const habit = habitSchema.parse({ hour: 14, spreadHours: 1, randomChance: 0 });
  const s = initialPresence('test', habit, 'America/New_York', start);
  const hours = new Set<string>();
  for (let i = 0; i < 180; i++) {
    const now = s.nextAt;
    hours.add(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    beginVisit(s, 'test', habit, 'America/New_York', now);
    const length = (s.endsAt - now) / 60000;
    if (length >= 120) {
      long++;
      assert.ok(length <= 180);
    } else {
      short++;
      assert.ok(length >= 26 && length <= 44);
    }
    if (i === 0) assert.ok(length >= 120, 'first visit is long');
    assert.ok(s.nextRegularAt > s.endsAt);
    s.nextAt = s.nextRegularAt;
  }
  assert.ok(long > 20 && long < 65 && short > 100);
  assert.ok(hours.size > 40);
  const dst = nextVisit('dst', habit, 'America/New_York', Date.parse('2026-11-01T10:00:00Z'));
  const localHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(dst),
  );
  assert.ok(localHour >= 13 && localHour <= 14);
  assert.throws(() => timeZoneSchema.parse('not-a-zone'));
  const base = initialPresence('same', habit, 'UTC', start),
    veteran = structuredClone(base);
  beginVisit(base, 'same', habit, 'UTC', base.nextAt);
  beginVisit(veteran, 'same', { ...habit, multiplier: 3 }, 'UTC', veteran.nextAt);
  assert.ok(
    Math.abs((veteran.endsAt - veteran.startedAt!) / (base.endsAt - base.startedAt!) - 3) < 0.00001,
  );
  assert.equal(veteranHabits.toby.multiplier, 3);
});

test('homecoming eats first, buys real goods, stocks and enters a home; offline feeding consumes stock', () => {
  const w = createWorld('puddlewick', 'Test', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  const b = w.buildings.find((b) => b.kind === 'home')!;
  b.owner = p.id;
  b.stock = {};
  p.cash = 500000;
  p.hunger = p.thirst = 40000;
  const initial = p.cash;
  for (let turn = 0; turn < 30; turn++) {
    const plan = homecomingPlan(w, p, 12 * 3600);
    for (const step of plan) {
      stepSchema.parse(step);
      if (step.kind === 'travel') {
        const target = w.buildings.find((b) => b.id === step.destination)!;
        p.x = target.x;
        p.z = target.z;
      }
      if (step.kind === 'act') act(w, p.id, step.action);
      if (step.kind === 'operation') act(w, p.id, operationAction(step));
    }
    if (!plan.length) break;
  }
  const ready = offlineReadiness(w, p, 12 * 3600);
  assert.equal(ready.stocked, true);
  assert.equal(ready.atHome, true);
  assert.equal(ready.comfortable, true);
  assert.ok(p.cash < initial);
  assert.ok(b.stock.bread > 0 && b.stock.water > 0);
  assert.equal(returnDelay(w, p, 43200), 43200);
  const bread = b.stock.bread,
    water = b.stock.water;
  p.online = false;
  advance(w, 43200);
  assert.ok(b.stock.bread < bread && b.stock.water < water);
  assert.ok(p.hunger < 30000 && p.thirst < 30000);
});

test('unprepared residents return early; booked-room coverage uses only personal stock and expiry', () => {
  const w = createWorld('puddlewick', 'Test', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  p.hunger = p.thirst = 45000;
  assert.equal(returnDelay(w, p, 86400), 600);
  const b = makeBuilding('hotel', 'hotel', 0, 0);
  b.owner = 'owner';
  b.stock = { bread: 500, water: 500 };
  b.lodging = {
    open: true,
    rate: 600,
    guests: {
      p: { until: w.time + 1200, stock: {} },
      other: { until: w.time + 86400, stock: { bread: 100, water: 100 } },
    },
  };
  w.buildings.push(b);
  p.atHome = true;
  p.home = b.id;
  p.hunger = p.thirst = 5000;
  const ready = offlineReadiness(w, p, 86400);
  assert.equal(ready.stocked, false);
  assert.ok(ready.coveredSeconds <= 1200);
  assert.ok(returnDelay(w, p, 86400) <= 1200);
});

test('sleeping controllers make no calls, persist visits, prepare home locally, and keep Mabel present at zero budget', async (t) => {
  let now = Date.parse('2026-10-01T12:00:00Z'),
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    universe = new Universe(store);
  const w = createWorld('puddlewick', 'Test', 'owner'),
    worlds = new Map([[w.id, w]]);
  const config = npcConfigSchema.parse({ id: 'ada', name: 'Ada Mercer', presence: 'scheduled' });
  const brain = {
    async decide() {
      calls++;
      return {
        decision: {
          intent: 'Wait',
          notebook: '',
          speech: null,
          plan: [{ kind: 'wait' as const, seconds: 600 }],
          repeat: 1,
          reconsiderSeconds: 600,
        },
        inputTokens: 10,
        outputTokens: 1,
      };
    },
  };
  let r = new Residents(store, universe, worlds, [{ config, brain }]);
  try {
    r.tick(0.5, now);
    await r.settled();
    assert.equal(calls, 0);
    const persisted = r.memory.load('ada')!.presence!;
    r.close();
    r = new Residents(store, universe, worlds, [{ config, brain }]);
    assert.deepEqual(r.memory.load('ada')!.presence, persisted);
    now = persisted.nextAt;
    r.tick(0.5, now);
    await r.settled();
    assert.equal(calls, 1);
    const p = w.players[r.status()[0].playerId];
    const b = w.buildings.find((b) => b.kind === 'home')!;
    b.owner = p.id;
    b.stock = { bread: 100, water: 100 };
    p.x = b.x;
    p.z = b.z;
    now = r.memory.load('ada')!.presence!.endsAt - 300000;
    for (let i = 0; i < 20; i++) {
      now += 500;
      r.tick(0.5, now);
      await r.settled();
    }
    assert.equal(p.atHome, true);
    now = r.memory.load('ada')!.presence!.endsAt + 1;
    r.tick(0.5, now);
    await r.settled();
    assert.equal(p.online, false);
    assert.equal(calls, 1);
    assert.equal(r.memory.load('ada')!.presence!.phase, 'offline');
    assert.equal(r.memory.paused('ada'), false);
    now += 60000;
    r.tick(0.5, now);
    assert.equal(calls, 1);
    r.close();
    r = new Residents(
      store,
      universe,
      worlds,
      [{ config: npcConfigSchema.parse({ presence: 'always' }), brain }],
      { dailyUsd: 0 },
    );
    r.tick(0.5, now);
    await r.settled();
    assert.equal(w.players[r.status()[0].playerId].online, true);
    assert.equal(calls, 1);
  } finally {
    r.close();
    store.close();
  }
});

test('unavailable supplies cannot keep a scheduled resident online indefinitely or wake speech while asleep', async (t) => {
  let now = Date.parse('2026-10-01T12:00:00Z'),
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    universe = new Universe(store);
  const w = createWorld('puddlewick', 'Test', 'owner'),
    worlds = new Map([[w.id, w]]);
  const config = npcConfigSchema.parse({ id: 'ada', name: 'Ada Mercer', presence: 'scheduled' });
  const brain = {
    async decide(): Promise<never> {
      calls++;
      throw Error('should not call model');
    },
  };
  let r = new Residents(store, universe, worlds, [{ config, brain }]);
  try {
    const state = r.memory.load('ada')!;
    state.presence = {
      phase: 'playing',
      sessions: 1,
      nextAt: now,
      endsAt: now + 1000,
      nextRegularAt: now + 86400000,
      preparationUntil: now + 601000,
    };
    r.memory.save('ada', state);
    r.close();
    // close checkpoints the in-memory state, so apply our simulated saved session afterward.
    r.memory.save('ada', state);
    r = new Residents(store, universe, worlds, [{ config, brain }]);
    const p = w.players[r.status()[0].playerId];
    p.cash = 0;
    p.inventory = {};
    p.hunger = p.thirst = 45000;
    r.tick(0.5, now);
    await r.settled();
    now += 602000;
    r.tick(0.5, now);
    await r.settled();
    assert.equal(p.online, false);
    const asleep = r.memory.load('ada')!.presence!;
    assert.equal(asleep.phase, 'offline');
    assert.equal(asleep.shortVisit, true);
    assert.equal(asleep.nextAt, now + 600000);
    assert.equal(calls, 0);
    const human = addPlayer(w, 'human', 'Robin');
    const { say } = await import('../src/shared/simulation.ts');
    say(w, human.name, 'Ada, are you there?', 'chat', p.id);
    r.capture(w);
    now += 1000;
    r.tick(0.5, now);
    await r.settled();
    assert.equal(calls, 0);
    assert.equal(r.memory.load('ada')!.helpQuestion, undefined);
    beginVisit(asleep, 'ada', config.habit, config.timeZone, asleep.nextAt);
    assert.ok(
      asleep.endsAt - asleep.startedAt! <= 20 * 60000,
      'welfare check does not repeat the first long visit',
    );
  } finally {
    r.close();
    store.close();
  }
});

test('career guidance favours different actions without removing any alternatives', async () => {
  const { preferChoices } = await import('../src/server/npc/preferences.ts');
  const choices = [
    {
      id: 'trade',
      description: 'Sell a cargo',
      plan: [
        {
          kind: 'act' as const,
          action: {
            type: 'trade' as const,
            building: 'b',
            item: 'wood',
            quantity: 1,
            direction: 'sell' as const,
          },
        },
      ],
    },
    {
      id: 'gather',
      description: 'Gather wood',
      plan: [{ kind: 'act' as const, action: { type: 'gather' as const, node: 'forest' } }],
    },
    {
      id: 'job',
      description: 'Take a job',
      plan: [{ kind: 'act' as const, action: { type: 'job' as const, building: 'b' } }],
    },
    {
      id: 'own',
      description: 'Buy a mill',
      plan: [{ kind: 'act' as const, action: { type: 'buyBuilding' as const, building: 'b' } }],
    },
  ];
  for (const [preference, id] of [
    ['trader', 'trade'],
    ['gatherer', 'gather'],
    ['employee', 'job'],
    ['owner', 'own'],
  ] as const) {
    const result = preferChoices(choices, preference);
    assert.deepEqual(
      result.map((c) => c.plan),
      choices.map((c) => c.plan),
    );
    for (let i = 0; i < result.length; i++)
      assert.ok(
        result[i].description.startsWith(choices[i].description),
        'Short wire descriptions retain the actual action before preference guidance',
      );
    assert.deepEqual(
      result.filter((c) => c.description.includes('[Fits')).map((c) => c.id),
      [id],
    );
  }
});
