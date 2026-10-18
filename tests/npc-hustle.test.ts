// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { completePuddlewick } from '../src/server/parish-services.ts';
import { economicMenu } from '../src/server/npc/enterprise.ts';
import { hustleRoutine, visitorShouldHustle } from '../src/server/npc/routines.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { FarmerChoice } from '../src/server/npc/farmer.ts';
import { beginVisit, initialPresence, habitSchema } from '../src/server/npc/habits.ts';

test('real scheduled visits can earn before departure preparation', () => {
  const now = 1_790_000_000_000;
  const habit = habitSchema.parse({});
  const presence = initialPresence('ada', habit, 'America/New_York', now);
  beginVisit(presence, 'ada', habit, 'America/New_York', now);
  assert.equal(visitorShouldHustle('ada', presence, now), true);
  presence.phase = 'preparing';
  assert.equal(visitorShouldHustle('ada', presence, now), false);
});

function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  completePuddlewick(w);
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'visitor', 'Ada Mercer');
  p.npc = true;
  p.hunger = 0;
  p.thirst = 0;
  p.cash = 80000;
  const state = {
    playerId: p.id,
    world: w.id,
    intent: '',
    plan: [],
    index: 0,
  } as unknown as ResidentState;
  return { w, p, state };
}

test('scheduled visitors hustle while online; Mabel and departing neighbours may rest', () => {
  const now = 1_000_000;
  assert.equal(
    visitorShouldHustle('mabel', { phase: 'playing', endsAt: now + 3_600_000 }, now),
    false,
  );
  assert.equal(
    visitorShouldHustle(
      'ada',
      { phase: 'playing', endsAt: now + 1_800_000, preparationUntil: 0 },
      now,
    ),
    true,
  );
  assert.equal(
    visitorShouldHustle(
      'ada',
      { phase: 'preparing', endsAt: now + 300_000, preparationUntil: now + 300_000 },
      now,
    ),
    false,
  );
  assert.equal(
    visitorShouldHustle(
      'ada',
      { phase: 'playing', endsAt: now + 5 * 60_000, preparationUntil: 0 },
      now,
    ),
    false,
  );
  assert.equal(visitorShouldHustle('ada', { phase: 'offline', endsAt: now }, now), false);
});

test('a cash-poor idle visitor works a public labour shift instead of sitting', () => {
  const { w, p, state } = fixture();
  p.cash = 0;
  p.bank = 0;
  const office = w.buildings.find((b) => b.kind === 'workhouse')!;
  const plan = hustleRoutine(w, p, state);
  assert.ok(
    plan.some((s) => s.kind === 'act' && s.action.type === 'task' && s.action.task === 'labour'),
    'public labour is the bootstrap when no other earning route is ready',
  );
  assert.ok(
    plan.some((s) => s.kind === 'travel' && s.destination === office.id),
    'they go to the Odd Jobs Office',
  );
  assert.ok(!plan.every((s) => s.kind === 'wait'), 'hustle is not a sit-and-wait plan');
});

test('a visitor with a shovel chooses a complete earning route instead of resting at home', () => {
  const { w, p, state } = fixture();
  p.inventory.shovel = 1;
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  p.home = home.id;
  const plan = hustleRoutine(w, p, state);
  assert.ok(
    plan.some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'sell',
    ),
    'either gathering or arbitrage must end in a sale to a funded buyer',
  );
  assert.ok(!plan.some((s) => s.kind === 'act' && s.action.type === 'home'));
});

test('a visitor still inside their cottage leaves before earning', () => {
  const { w, p, state } = fixture();
  p.atHome = true;
  const plan = hustleRoutine(w, p, state);
  assert.deepEqual(plan[0], { kind: 'act', action: { type: 'outside' } });
  assert.ok(
    plan.some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'sell',
    ),
    'leave for a concrete earning errand, not a bare outside step',
  );
});

test('a busy visit ranks labour above leisure rest and idle factory waiting', () => {
  const { w, p } = fixture();
  p.cash = 0;
  p.bank = 0;
  const office = w.buildings.find((b) => b.kind === 'workhouse')!;
  const choices: FarmerChoice[] = [
    {
      id: 'rest',
      description: `Rest in my home Cottage; its stored food supports ordinary home life.`,
      plan: [
        { kind: 'act', action: { type: 'home', building: 'h' } },
        { kind: 'wait', seconds: 300 },
      ],
    },
    {
      id: 'wait-job',
      description: 'Keep my active job at the mill; wait 600s for the next production check.',
      plan: [{ kind: 'wait', seconds: 600 }],
    },
    {
      id: 'explore',
      description: 'Explore the mill to refresh last-known prices.',
      plan: [{ kind: 'travel', destination: 'b1' }],
    },
    {
      id: 'labour',
      description: `Earn 4500 cash with a 15-second public labour shift at ${office.name}; useful for tuition and supplies.`,
      plan: [
        { kind: 'travel', destination: office.id },
        { kind: 'act', action: { type: 'task', building: office.id, task: 'labour' } },
      ],
    },
  ];
  const menu = economicMenu(w, p, choices, 'generalist', true);
  const rank = (id: string) => menu.findIndex((c) => c.id === id);
  assert.ok(rank('labour') >= 0);
  for (const id of ['rest', 'wait-job', 'explore'])
    assert.ok(rank(id) < 0 || rank('labour') < rank(id));
});
