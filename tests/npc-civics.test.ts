// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import type { Step } from '../src/server/npc/decision.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'npc', 'Neighbour');
  p.npc = true;
  p.cash = 1_000_000;
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Civic minded',
    notebook: '',
    intent: 'Take part in parish life',
    cursor: 0,
    nextAt: 0,
    plan: [],
    index: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: '',
    errors: 0,
  } as ResidentState;
  const town = w.towns[0],
    plinth = w.buildings.find((b) => b.id === town.plinth)!;
  const find = (pattern: RegExp) =>
    adaptiveChoices(w, p, state).find((c) => pattern.test(c.description));
  const run = (plan: Step[]) => {
    for (const s of plan)
      if (s.kind === 'travel') Object.assign(p, { x: plinth.x, z: plinth.z + 5 });
      else if (s.kind === 'act') act(w, p.id, s.action);
      else if (s.kind === 'operation') act(w, p.id, operationAction(s));
  };
  const resident = (id: string) => {
    const r = addPlayer(w, id, id.toUpperCase());
    r.cash = 1_000_000;
    Object.assign(r, { x: plinth.x, z: plinth.z + 5 });
    act(w, id, { type: 'town', building: plinth.id, operation: 'join' });
    return r;
  };
  return { w, p, town, plinth, find, run, resident };
}

test('NPCs join a home town, stand for mayor and vote like players', () => {
  const { w, p, town, find, run, resident } = fixture();
  run(find(/Become a resident of Puddlewick/)!.plan);
  assert.equal(p.town, 'puddlewick');
  assert.equal(find(/Become a resident/), undefined);
  advance(w, 1);
  assert.equal(town.election?.phase, 'registration');
  run(find(/Stand for mayor of Puddlewick/)!.plan);
  assert.ok(town.election!.candidates.some((c) => c.id === p.id));
  const rival = resident('rival');
  act(w, rival.id, {
    type: 'town',
    building: town.plinth,
    operation: 'stand',
    bribe: 100,
    budget: 1000,
  });
  advance(w, 30 * 600);
  assert.equal(town.election?.phase, 'voting');
  const choice = find(/Vote for RIVAL as mayor of Puddlewick.*1d per vote/)!;
  run(choice.plan);
  assert.equal(town.election!.votes[p.id], rival.id);
  assert.equal(find(/Vote for RIVAL/), undefined, 'one vote per election');
});

test('NPC mayors set delegated taxes; NPC residents vote on proposals', () => {
  const { w, p, town, find, run, resident } = fixture();
  town.governance = 'appointed';
  run(find(/Become a resident/)!.plan);
  town.mayor = p.id;
  run(find(/As mayor set Puddlewick construction tax to 5%/)!.plan);
  assert.equal(town.tax, 0.05);
  w.townCharter = { controls: ['salesTax'] };
  assert.equal(find(/construction tax/), undefined);
  town.governance = 'direct';
  delete town.mayor;
  const r = resident('r');
  act(w, r.id, {
    type: 'town',
    building: town.plinth,
    operation: 'propose',
    rule: 'salesTax',
    value: 0.2,
  });
  run(find(/Oppose proposal 1 in Puddlewick: sales tax to 20%/)!.plan);
  assert.equal(town.proposals[0].votes[p.id], false);
});
