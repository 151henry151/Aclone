// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { townCharter, publicTowns } from '../src/shared/civics.ts';
import { prepareFrame, privatePlayer } from '../src/server/snapshots.ts';
import { exportDesign, applyDesign } from '../src/server/world-design.ts';

test('the world owner edits the town charter; others and invalid values are refused', () => {
  const w = createWorld('charter', 'Charter', 'owner');
  addPlayer(w, 'owner', 'Owner');
  addPlayer(w, 'p', 'Player');
  const patch = {
    founding: false,
    maxTowns: 3,
    outside: 'nearest',
    governance: ['direct', 'election'],
    controls: ['salesTax'],
    defaultZoning: ['residential'],
    quorum: 0.5,
  };
  assert.throws(() => act(w, 'p', { type: 'townCharter', patch }), /Owner/);
  act(w, 'owner', { type: 'townCharter', patch });
  const charter = townCharter(w);
  assert.equal(charter.founding, false);
  assert.equal(charter.outside, 'nearest');
  assert.deepEqual(charter.governance, ['direct', 'election']);
  assert.equal(charter.initialRadius, 150, 'untouched fields keep their defaults');
  for (const bad of [
    { nonsense: 1 },
    { governance: [] },
    { governance: ['tyranny'] },
    { controls: ['weather'] },
    { foundingCost: -1 },
    { outside: 'sometimes' },
    { quorum: 2 },
    { maxRadius: 10, initialRadius: 50 },
  ])
    assert.throws(() => act(w, 'owner', { type: 'townCharter', patch: bad }), JSON.stringify(bad));
  assert.deepEqual(townCharter(w), charter);
});

test('world designs carry the town charter and towns follow their imported plinth', () => {
  const source = createWorld('source', 'Source', 'owner');
  addPlayer(source, 'owner', 'Owner');
  act(source, 'owner', { type: 'townCharter', patch: { outside: 'forbid', maxTowns: 2 } });
  source.buildings.find((b) => b.kind === 'town')!.x = 40;
  const design = JSON.parse(JSON.stringify(exportDesign(source)));
  assert.deepEqual(design.townCharter, { outside: 'forbid', maxTowns: 2 });
  const target = createWorld('target', 'Target', 'owner');
  applyDesign(target, design);
  assert.equal(townCharter(target).outside, 'forbid');
  const plinth = target.buildings.find((b) => b.kind === 'town')!;
  assert.equal(target.towns[0].plinth, plinth.id);
  assert.equal(target.towns[0].x, 40);
  assert.throws(() =>
    applyDesign(createWorld('t2', 'T2', 'owner'), {
      ...design,
      townCharter: { governance: [] },
    }),
  );
});

test('town chat commands list residents and let sysops set a home town', () => {
  const w = createWorld('cmd', 'Cmd', 'owner');
  addPlayer(w, 'owner', 'Owner');
  const ada = addPlayer(w, 'ada', 'Ada'),
    bo = addPlayer(w, 'bo', 'Bo');
  assert.match(act(w, 'ada', { type: 'command', text: '*town' }), /no home town/);
  assert.throws(() => act(w, 'ada', { type: 'command', text: '*sethometown Bo Puddlewick' }));
  act(w, 'owner', { type: 'command', text: '*sethometown Ada Puddlewick' });
  act(w, 'owner', { type: 'command', text: '*sethometown Bo puddlewick' });
  assert.equal(ada.town, 'puddlewick');
  assert.deepEqual(w.towns[0].residents, ['ada', 'bo']);
  assert.match(act(w, 'ada', { type: 'command', text: '*town' }), /Puddlewick: Ada, Bo/);
  assert.match(act(w, 'bo', { type: 'command', text: '*showresidents Puddlewick' }), /Ada, Bo/);
  assert.throws(() => act(w, 'owner', { type: 'command', text: '*sethometown Ada Atlantis' }));
});

test('snapshots publish vote tallies, never who voted for whom', () => {
  const w = createWorld('ballot', 'Ballot', 'owner');
  const town = w.towns[0];
  town.residents.push('a', 'b', 'v');
  town.election = {
    kind: 'election',
    phase: 'voting',
    opened: 0,
    until: 1000,
    deferrals: 0,
    votes: { v: 'a', b: 'a', a: 'b' },
    candidates: [
      { id: 'a', name: 'A', bribe: 5, budget: 100, bid: 0, registered: 0 },
      { id: 'b', name: 'B', bribe: 0, budget: 0, bid: 0, registered: 1 },
    ],
  };
  town.proposals = [
    { id: 1, rule: 'salesTax', value: 0.1, by: 'a', closes: 50, votes: { a: true, v: false } },
  ];
  const [shown] = publicTowns(w);
  assert.deepEqual(shown.election!.votes, {});
  assert.deepEqual(shown.election!.tally, { a: 2, b: 1 });
  assert.deepEqual(shown.proposals[0].votes, {});
  assert.deepEqual(shown.proposals[0].tally, { yes: 1, no: 1 });
  const frame = prepareFrame(w);
  assert.doesNotMatch(frame.fields.towns, /"v":"a"/);
  const v = addPlayer(w, 'v', 'Voter');
  const mine = privatePlayer(w, v).ballots;
  assert.deepEqual(mine, { puddlewick: { candidate: 'a', proposals: { 1: false } } });
});
