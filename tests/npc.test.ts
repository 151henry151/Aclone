// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { budgetSchema, NpcBudget } from '../src/server/npc/budget.ts';
import { NpcMemory } from '../src/server/npc/memory.ts';
import { createWorld, addPlayer, advance, say } from '../src/shared/simulation.ts';
import type { Brain, BrainRequest, BrainResult, Decision } from '../src/server/npc/decision.ts';
const decision = (plan: Decision['plan']): Decision => ({
  intent: 'Earn a living',
  notebook: 'Ada likes blue tractors.',
  speech: null,
  plan,
  repeat: 1,
  reconsiderSeconds: 600,
});
const answer = (d: Decision): BrainResult => ({ decision: d, inputTokens: 500, outputTokens: 200 });
function setup(brain: Brain, population = 1) {
  const store = new Store(':memory:'),
    universe = new Universe(store),
    w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.script = '';
  const worlds = new Map([[w.id, w]]);
  const configs = Array.from({ length: population }, (_, i) =>
    npcConfigSchema.parse({
      id: 'resident-' + i,
      name: 'Resident ' + i,
      intervalMs: 5000,
      activeAlone: true,
    }),
  );
  const residents = new Residents(
    store,
    universe,
    worlds,
    configs.map((config) => ({ config, brain })),
    { dailyUsd: 20 },
  );
  return { store, universe, worlds, w, residents, configs };
}
test('one AI plan drives, earns ordinary wages and consumes supplies with no per-step API calls', async () => {
  let calls = 0;
  const s = setup({
    async decide() {
      calls++;
      return answer(
        decision([
          { kind: 'travel', destination: 'workhouse' },
          { kind: 'act', action: { type: 'task', building: 'workhouse', task: 'labour' } },
          { kind: 'act', action: { type: 'use', item: 'water' } },
        ]),
      );
    },
  });
  // Use generated IDs, not assumptions about the content template.
  const office = s.w.buildings.find((b) => b.kind === 'workhouse')!;
  office.id = 'workhouse';
  const id = s.residents.status()[0].playerId,
    p = s.w.players[id],
    cash = p.cash,
    water = p.inventory.water;
  const start = Date.now();
  s.residents.tick(0.05, start);
  await s.residents.settled();
  for (let i = 1; i < 5000; i++) {
    advance(s.worlds.get(s.w.id)!, 0.05);
    s.residents.tick(0.05, start + i * 50);
  }
  const current = s.worlds.get(s.w.id)!.players[id];
  assert.equal(current.cash, cash + 4500);
  assert.equal(current.inventory.water, water - 1);
  assert.equal(calls, 1);
  assert.equal(current.authority, 0);
  assert.equal(current.npc, true);
  assert.ok(s.residents.memory.recent('resident-0', 100).some((e) => e.kind === 'task-complete'));
  const saved = s.residents.memory.load('resident-0')!;
  assert.equal(saved.notebook, 'Ada likes blue tractors.');
  s.residents.close();
  const worlds = new Map(s.store.loadWorlds().map((x) => [x.world.id, x.world]));
  const resumed = new Residents(s.store, s.universe, worlds, [
    {
      config: s.configs[0],
      brain: {
        async decide() {
          throw Error('unexpected');
        },
      },
    },
  ]);
  assert.equal(resumed.status()[0].playerId, id);
  assert.equal(worlds.get(s.w.id)!.players[id].cash, cash + 4500);
  assert.equal(resumed.memory.load('resident-0')!.notebook, saved.notebook);
  resumed.close();
  s.store.close();
});
test('NPC journal captures more than the chat ring, excludes others private messages and does not wake for NPC chatter', async () => {
  let calls = 0;
  const seen: BrainRequest[] = [];
  const s = setup({
    async decide(r) {
      calls++;
      seen.push(r);
      return answer(decision([{ kind: 'wait', seconds: 600 }]));
    },
  });
  const p = addPlayer(s.w, 'ada', 'Ada'),
    other = addPlayer(s.w, 'bob', 'Bob');
  p.online = other.online = true;
  const id = s.residents.status()[0].playerId;
  for (let i = 0; i < 140; i++) {
    say(s.w, p.name, 'hello ' + i, 'chat', id);
    s.store.saveWorld(s.w, Date.now() / 1000, () => s.residents.capture(s.w));
  }
  say(s.w, other.name, 'private secret', 'chat', p.id);
  s.store.saveWorld(s.w, Date.now() / 1000, () => s.residents.capture(s.w));
  assert.equal(s.residents.memory.search('resident-0', 'private secret', null).length, 0);
  assert.ok(s.residents.memory.search('resident-0', 'hello 0', null).length);
  const now = Date.now();
  s.residents.tick(0.05, now);
  await s.residents.settled();
  assert.ok(!JSON.stringify(seen).includes('private secret'));
  say(s.w, 'Robot', 'Resident hello', 'chat');
  s.w.messages.at(-1)!.npc = true;
  const robot = addPlayer(s.w, 'robot', 'Robot');
  robot.npc = true;
  s.residents.tick(0.05, now + 20000);
  await s.residents.settled();
  assert.equal(calls, 1);
  s.residents.close();
  s.store.close();
});
test('shared budget and reservations survive restarts and limit all NPCs together', () => {
  const store = new Store(':memory:'),
    memory = new NpcMemory(store),
    config = budgetSchema.parse({ dailyUsd: 0.01, monthlyUsd: 0.01 });
  const budget = new NpcBudget(memory, config);
  const first = budget.reserve('a', 1000, 2200)!;
  assert.ok(first);
  budget.failed(first);
  const restarted = new NpcBudget(new NpcMemory(store), config);
  assert.equal(restarted.reserve('b', 50000, 2200), undefined);
  assert.ok(restarted.usage().dayUsd > 0);
  store.close();
});
test('scheduler bounds concurrency for a 50-resident fixture; pausing discards late model actions', async () => {
  const resolvers: ((r: BrainResult) => void)[] = [];
  const s = setup(
    {
      decide() {
        return new Promise((resolve) => resolvers.push(resolve));
      },
    },
    50,
  );
  const now = Date.now();
  s.residents.tick(0.05, now);
  assert.equal(resolvers.length, 2);
  s.residents.memory.pause('resident-0', true);
  resolvers[0](
    answer({
      ...decision([{ kind: 'wait', seconds: 600 }]),
      speech: { text: 'Should never appear', to: null },
    }),
  );
  resolvers[1](answer(decision([{ kind: 'wait', seconds: 600 }])));
  await s.residents.settled();
  assert.ok(!s.w.messages.some((m) => m.text === 'Should never appear'));
  s.residents.close();
  s.store.close();
});
test('invalid and remote actions cannot mint wealth, and provider failure rests the NPC', async () => {
  const s = setup({
    async decide() {
      return answer(
        decision([
          {
            kind: 'act',
            action: {
              type: 'trade',
              building: 'missing',
              item: 'bread',
              quantity: 1,
              direction: 'sell',
            },
          },
        ]),
      );
    },
  });
  const id = s.residents.status()[0].playerId,
    cash = s.w.players[id].cash,
    now = Date.now();
  s.residents.tick(0.05, now);
  await s.residents.settled();
  s.residents.tick(0.05, now + 500);
  assert.equal(s.worlds.get(s.w.id)!.players[id].cash, cash);
  assert.ok(s.residents.memory.recent('resident-0', 10).some((e) => e.kind === 'failure'));
  s.residents.close();
  s.store.close();
  const failure = setup({
    async decide() {
      throw Error('SECRET provider payload');
    },
  });
  failure.residents.tick(0.05, Date.now());
  await failure.residents.settled();
  assert.equal(failure.residents.status()[0].online, false);
  assert.ok(!JSON.stringify(failure.residents.memory.recent('resident-0')).includes('SECRET'));
  failure.residents.close();
  failure.store.close();
});
test('private replies stay private and a moderator kick requires an operator resume', async () => {
  const s = setup({
    async decide() {
      return answer({
        ...decision([{ kind: 'wait', seconds: 600 }]),
        intent: 'Private personal goal',
        speech: { text: 'Your secret stays here.', to: null },
      });
    },
  });
  const id = s.residents.status()[0].playerId;
  addPlayer(s.w, 'ada', 'Ada').online = true;
  say(s.w, 'Ada', 'Mabel, a private question', 'chat', id);
  const now = Date.now();
  s.residents.tick(0.05, now);
  await s.residents.settled();
  assert.equal(s.w.messages.find((m) => m.text === 'Your secret stays here.')?.to, 'ada');
  s.w.players[id].online = false;
  s.residents.tick(0.05, now + 1000);
  assert.equal(s.residents.memory.paused('resident-0'), true);
  assert.equal(s.w.players[id].online, false);
  assert.ok(!JSON.stringify(s.residents.status()).includes('Private personal goal'));
  s.residents.close();
  s.store.close();
});
test('navigation journals only coordinates, never a destination building private contents', async () => {
  const s = setup({
    async decide() {
      return answer(decision([{ kind: 'travel', destination: 'target' }]));
    },
  });
  const building = s.w.buildings[0];
  building.id = 'target';
  Object.assign(building, { privateTest: 'NOT_FOR_THE_AGENT' });
  const now = Date.now();
  s.residents.tick(0.05, now);
  await s.residents.settled();
  s.residents.tick(0.05, now + 500);
  const entries = s.residents.memory.recent('resident-0', 30);
  assert.ok(entries.some((e) => e.kind === 'journey'));
  assert.ok(!JSON.stringify(entries).includes('NOT_FOR_THE_AGENT'));
  s.residents.close();
  s.store.close();
});
test('a queued private interaction survives controller restart and failed saves do not lose chat', async () => {
  const brain: Brain = {
    async decide() {
      return answer({
        ...decision([{ kind: 'wait', seconds: 600 }]),
        speech: { text: 'Remembered after restart.', to: null },
      });
    },
  };
  const s = setup(brain);
  const id = s.residents.status()[0].playerId;
  addPlayer(s.w, 'ada', 'Ada').online = true;
  say(s.w, 'Ada', 'Mabel, remember this message.', 'chat', id);
  assert.throws(() =>
    s.store.transaction(() => {
      s.residents.capture(s.w);
      throw Error('Simulated save failure');
    }),
  );
  s.store.saveWorld(s.w, Date.now() / 1000, () => s.residents.capture(s.w));
  assert.equal(s.residents.memory.search('resident-0', 'remember this message', null).length, 1);
  s.residents.close();
  const worlds = new Map(s.store.loadWorlds().map((x) => [x.world.id, x.world]));
  const resumed = new Residents(s.store, s.universe, worlds, [{ config: s.configs[0], brain }]);
  resumed.tick(0.05);
  await resumed.settled();
  assert.equal(
    worlds.get(s.w.id)!.messages.find((m) => m.text === 'Remembered after restart.')?.to,
    'ada',
  );
  resumed.close();
  s.store.close();
});
test('Mabel receives help for addressed questions and can look up more without game actions', async () => {
  const seen: BrainRequest[] = [];
  const s = setup({
    async decide(request) {
      seen.push(request);
      if (seen.length === 1) return answer(decision([{ kind: 'guide', query: 'recipe:sawmill' }]));
      return answer({
        ...decision([{ kind: 'wait', seconds: 600 }]),
        speech: { text: 'A sawmill turns two logs into four timber.', to: null },
      });
    },
  });
  const id = s.residents.status()[0].playerId,
    p = s.w.players[id];
  const before = { cash: p.cash, x: p.x, z: p.z };
  addPlayer(s.w, 'ada', 'Ada').online = true;
  say(s.w, 'Ada', 'Mabel, how do I use the sawmill?', 'chat', id);
  const now = Date.now();
  s.residents.tick(0.05, now);
  await s.residents.settled();
  const initial = seen[0].observation as any;
  assert.match(initial.gameGuide.controls, /F4/);
  assert.ok(initial.gameGuide.excerpts.some((e: any) => /sawmill/i.test(e.text)));
  assert.equal(initial.worldRules.maxSkills, s.w.settings.maxSkills);
  assert.equal(initial.currentConversation.speakerId, 'ada');
  assert.match(initial.currentConversation.question, /sawmill/i);
  s.residents.tick(0.05, now + 500);
  s.residents.tick(0.05, now + 6000);
  await s.residents.settled();
  const lookedUp = seen[1].observation as any;
  assert.equal(lookedUp.gameGuide.excerpts[0].id, 'recipe:sawmill');
  assert.deepEqual({ cash: p.cash, x: p.x, z: p.z }, before);
  assert.equal(s.w.messages.at(-1)?.to, 'ada');
  assert.ok(s.residents.memory.recent('resident-0', 30).some((e) => e.kind === 'guide-lookup'));
  assert.equal(s.residents.memory.load('resident-0')?.helpQuestion, undefined);
  s.residents.close();
  s.store.close();
});
test('SQLite backup restores NPC identity, journal, pause state and charged budget together', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'aclone-npc-backup-'));
  const s = setup({
    async decide() {
      return answer(decision([{ kind: 'wait', seconds: 600 }]));
    },
  });
  try {
    const id = s.residents.status()[0].playerId;
    s.residents.memory.append('resident-0', 0, 'chat', { text: 'A remembered conversation' });
    s.residents.memory.pause('resident-0', true);
    assert.ok(s.residents.budget.reserve('resident-0', 5000, 2200));
    await s.store.backup(join(dir, 'backup.sqlite'));
    const restored = new Store(join(dir, 'backup.sqlite'));
    try {
      const memory = new NpcMemory(restored);
      assert.equal(memory.load('resident-0')!.playerId, id);
      assert.ok(memory.search('resident-0', 'remembered conversation', null).length);
      assert.equal(memory.paused('resident-0'), true);
      assert.ok(new NpcBudget(memory, budgetSchema.parse({})).usage().dayUsd > 0);
      assert.ok(restored.loadWorlds().some((x) => x.world.players[id]?.npc));
    } finally {
      restored.close();
    }
  } finally {
    s.residents.close();
    s.store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resident observes mill diagnosis, accepts employment and records verifiable production wages', async () => {
  const s = setup({
    async decide(request) {
      const o = request.observation as any;
      const b = o.nearbyBuildings.find((b: any) => b.kind === 'mill');
      assert.equal(b.workplace.employedHere, false);
      assert.equal(b.workplace.ifYouWork.capitalShortfall, 0);
      assert.match(JSON.stringify(o.gameGuide.fundamentals), /Work two cycles/);
      return answer(
        decision([
          { kind: 'act', action: { type: 'job', building: b.id } },
          { kind: 'act', action: { type: 'work', building: b.id } },
          { kind: 'wait', seconds: 20 },
        ]),
      );
    },
  });
  try {
    const p = s.w.players[s.residents.status()[0].playerId];
    const b = s.w.buildings.find((b) => b.kind === 'mill')!;
    p.x = b.x;
    p.z = b.z;
    p.skills = ['miller'];
    b.owner = 'other';
    b.stock = { wheat: 12, flour: 29 };
    b.investment = 11000;
    s.w.time = 590;
    const now = Date.now();
    s.residents.tick(0.05, now);
    await s.residents.settled();
    s.residents.tick(0.05, now + 500);
    s.residents.tick(0.05, now + 1000);
    const journal = s.residents.memory.recent('resident-0', 20);
    const job = journal.find((e) => (e.data as any).action?.type === 'job')!.data as any;
    assert.equal(job.before.job, null);
    assert.equal(job.after.job, b.id);
    assert.equal(job.after.building.employedHere, true);
    advance(s.w, 10);
    const { observe } = await import('../src/server/npc/observation.ts');
    const o = observe(
      s.w,
      p,
      s.residents.memory.load('resident-0')!,
      s.residents.memory,
      'resident-0',
    );
    assert.equal(o.nearbyBuildings.find((q) => q.id === b.id)!.stock.flour, 32);
    assert.equal(o.recentWages.at(-1)!.netPay, 1980);
    assert.equal(o.lastOutcome!.ok, true);
  } finally {
    s.residents.close();
    s.store.close();
  }
});

test('failed workplace actions retain the attempted action through chat and restart', async () => {
  const s = setup({
    async decide() {
      return answer(
        decision([{ kind: 'act', action: { type: 'task', building: 'mill', task: 'craft' } }]),
      );
    },
  });
  const p = s.w.players[s.residents.status()[0].playerId];
  const b = s.w.buildings.find((b) => b.kind === 'mill')!;
  b.id = 'mill';
  p.x = b.x;
  p.z = b.z;
  const now = Date.now();
  s.residents.tick(0.05, now);
  await s.residents.settled();
  s.residents.tick(0.05, now + 500);
  const outcome = s.residents.memory.load('resident-0')!.lastOutcome!;
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /Wrong workplace/);
  assert.deepEqual(outcome.attempted, {
    kind: 'act',
    action: { type: 'task', building: 'mill', task: 'craft' },
  });
  s.residents.close();
  const resumed = new Residents(s.store, s.universe, s.worlds, [
    {
      config: s.configs[0],
      brain: {
        async decide(request) {
          assert.deepEqual((request.observation as any).lastOutcome, outcome);
          return answer({
            ...decision([{ kind: 'wait', seconds: 60 }]),
            speech: { text: 'I used the wrong task; I need a miller job.', to: null },
          });
        },
      },
    },
  ]);
  try {
    resumed.tick(0.05, now + 6000);
    await resumed.settled();
    assert.deepEqual(
      resumed.memory.load('resident-0')!.lastOutcome,
      outcome,
      'speech cannot hide the failed action',
    );
  } finally {
    resumed.close();
    s.store.close();
  }
});

test('a looping model is throttled and silenced across restart, while a new private question still gets an answer', async () => {
  let calls = 0;
  const brain: Brain = {
    async decide(request) {
      calls++;
      const o = request.observation as any;
      if (o.currentConversation) {
        assert.ok(o.recovery.blockedSteps.length);
        return answer({
          ...decision([{ kind: 'wait', seconds: 60 }]),
          speech: { text: 'That route failed; I need a different destination.', to: 'reader' },
        });
      }
      return answer({
        ...decision([
          { kind: 'act', action: { type: 'outside' } },
          { kind: 'travel', destination: 'missing' },
        ]),
        speech: { text: 'I will walk to the mill and make flour.', to: null },
      });
    },
  };
  const s = setup(brain);
  const now = Date.now();
  const id = s.residents.status()[0].playerId;
  // Several minutes of simulation would previously trigger a decision and chat
  // every minimum interval. No-op outside actions must not clear the failures.
  for (let i = 0; i < 600; i++) {
    advance(s.worlds.get(s.w.id)!, 0.5);
    s.residents.tick(0.05, now + i * 500);
    await s.residents.settled();
  }
  assert.ok(calls <= 6, `retry requests should back off, got ${calls}`);
  assert.equal(s.w.messages.filter((m) => m.npc).length, 1, 'one autonomous announcement');
  const saved = s.residents.memory.load('resident-0')!;
  assert.ok(saved.recovery!.retryAt! > s.w.time);
  assert.ok(saved.recovery!.failures!.some((f) => f.until > s.w.time));
  s.residents.close();
  const resumed = new Residents(s.store, s.universe, s.worlds, [{ config: s.configs[0], brain }]);
  try {
    const before = calls;
    resumed.tick(0.05, now + 400000);
    await resumed.settled();
    assert.equal(calls, before, 'restart retains recovery wait');
    const human = addPlayer(s.w, 'reader', 'Reader');
    human.online = true;
    say(s.w, human.name, 'Can you explain what went wrong?', 'chat', id);
    resumed.tick(0.05, now + 401000);
    await resumed.settled();
    assert.equal(calls, before + 1, 'human question wakes a resting resident');
    assert.equal(s.w.messages.at(-1)!.to, 'reader');
    assert.match(s.w.messages.at(-1)!.text, /route failed/);
    assert.ok(
      resumed.memory.load('resident-0')!.recovery!.failures!.some((f) => f.until > s.w.time),
    );
  } finally {
    resumed.close();
    s.store.close();
  }
});
