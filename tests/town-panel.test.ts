// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { publicTowns, townBallots } from '../src/shared/civics.ts';
import {
  townPanel,
  townFormAction,
  charterForm,
  charterFormAction,
  townLocation,
  constructionQuote,
  foundTownForm,
} from '../src/client/town-panel.ts';
import type { World } from '../src/shared/types.ts';

function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const town = w.towns[0],
    plinth = w.buildings.find((b) => b.id === town.plinth)!;
  const player = (id: string) => {
    const p = addPlayer(w, id, id.toUpperCase());
    p.cash = 1_000_000;
    Object.assign(p, { x: plinth.x, z: plinth.z + 5 });
    return p;
  };
  /** What the browser receives: public towns plus the viewer's own ballots. */
  const view = (id: string) => {
    const v = structuredClone(w) as World;
    v.towns = publicTowns(w) as World['towns'];
    v.players[id].ballots = townBallots(w, w.players[id]);
    return { v, me: v.players[id], b: v.buildings.find((b) => b.id === plinth.id)! };
  };
  const join = (id: string) => act(w, id, { type: 'town', building: plinth.id, operation: 'join' });
  return { w, town, plinth, player, view, join };
}
const has = (html: string, ...patterns: RegExp[]) => {
  for (const p of patterns) assert.match(html, p);
};

test('plinth panel shows the town, its rules and residency actions', () => {
  const { town, player, view, join } = fixture();
  player('a');
  town.salesTax = 0.1;
  town.treasury = 12345;
  let { v, me, b } = view('a');
  let html = townPanel(v, me, b);
  has(
    html,
    /Town of Puddlewick/,
    /Construction tax 2%/,
    /Sales tax 10%/,
    /Treasury 1s 23\.45d/,
    /Elected mayor/,
    /data-id="join"|value="join"/,
  );
  assert.doesNotMatch(html, /value="leave"/);
  join('a');
  ({ v, me, b } = view('a'));
  html = townPanel(v, me, b);
  has(html, /value="leave"/, /Residents: 1/);
});

test('election panel offers registration, then secret ballots with public tallies', () => {
  const { w, town, player, view, join } = fixture();
  for (const id of ['a', 'b', 'c']) {
    player(id);
    join(id);
  }
  advance(w, 1);
  let html = townPanel(...(Object.values(view('a')) as [World, never, never]));
  has(html, /Candidate registration/, /name="bribe"/, /name="budget"/, /value="stand"/);
  for (const id of ['a', 'b'])
    act(w, id, {
      type: 'town',
      building: town.plinth,
      operation: 'stand',
      bribe: id === 'a' ? 200 : 0,
      budget: 2000,
    });
  advance(w, 30 * 600);
  act(w, 'c', { type: 'town', building: town.plinth, operation: 'vote', candidate: 'a' });
  const { v, me, b } = view('c');
  html = townPanel(v, me, b);
  has(html, /Voting closes/, /A · 1 vote · offers 2d per vote/, /B · 0 votes/, /Your vote: A/);
  assert.doesNotMatch(JSON.stringify(v.towns), /"c":"a"/);
});

test('direct democracy panel lists proposals and a proposal form for delegated rules', () => {
  const { w, town, player, view, join } = fixture();
  town.governance = 'direct';
  delete town.mayor;
  player('a');
  join('a');
  w.townCharter = { controls: ['salesTax', 'zoning'] };
  act(w, 'a', {
    type: 'town',
    building: town.plinth,
    operation: 'propose',
    rule: 'salesTax',
    value: 0.2,
  });
  act(w, 'a', {
    type: 'town',
    building: town.plinth,
    operation: 'ballot',
    proposal: 1,
    support: true,
  });
  const { v, me, b } = view('a');
  const html = townPanel(v, me, b);
  has(
    html,
    /Proposal 1: sales tax to 20%/,
    /1 for · 0 against/,
    /You voted for/,
    /value="propose"/,
  );
  assert.doesNotMatch(html, /construction tax<\/option>/i);
});

test('mayor panel shows only delegated rule forms; proprietors can sell and others buy', () => {
  const { w, town, player, view, join } = fixture();
  town.governance = 'proprietor';
  player('a');
  player('b');
  join('a');
  town.mayor = 'a';
  w.townCharter = { controls: ['constructionTax', 'sale', 'permissions'] };
  let { v, me, b } = view('a');
  let html = townPanel(v, me, b);
  has(html, /value="constructionTax"/, /value="sale"/, /name="guests\.build"/, /value="resign"/);
  assert.doesNotMatch(html, /value="salesTax"/);
  town.forSale = 70000;
  ({ v, me, b } = view('b'));
  html = townPanel(v, me, b);
  has(html, /For sale: 7s 0d/, /value="buyTown"/);
  assert.doesNotMatch(html, /value="constructionTax"/);
});

test('town forms convert to engine actions', () => {
  const e = (pairs: [string, string][]) => townFormAction(pairs);
  assert.deepEqual(
    e([
      ['building', 'p'],
      ['operation', 'rule'],
      ['rule', 'salesTax'],
      ['percent', '12.5'],
    ]),
    { type: 'town', building: 'p', operation: 'rule', rule: 'salesTax', value: 0.125 },
  );
  assert.deepEqual(
    e([
      ['building', 'p'],
      ['operation', 'propose'],
      ['rule', 'zoning'],
      ['north', 'residential'],
      ['north', 'civic'],
    ]).value,
    { north: ['residential', 'civic'], south: [] },
  );
  assert.deepEqual(
    e([
      ['building', 'p'],
      ['operation', 'rule'],
      ['rule', 'permissions'],
      ['residents.build', 'on'],
      ['guests.roads', 'on'],
    ]).value,
    {
      residents: { build: true, roads: false, environment: false },
      guests: { build: false, roads: true, environment: false },
    },
  );
  assert.deepEqual(
    e([
      ['building', 'p'],
      ['operation', 'rule'],
      ['rule', 'treasury'],
      ['to', 'a'],
      ['denarii', '5'],
    ]).value,
    { to: 'a', amount: 500 },
  );
  assert.deepEqual(
    e([
      ['building', 'p'],
      ['operation', 'stand'],
      ['bribe', '1.5'],
      ['budget', '20'],
    ]),
    { type: 'town', building: 'p', operation: 'stand', bribe: 150, budget: 2000 },
  );
  assert.deepEqual(
    e([
      ['building', 'p'],
      ['operation', 'ballot'],
      ['proposal', '3'],
      ['support', 'false'],
    ]),
    { type: 'town', building: 'p', operation: 'ballot', proposal: 3, support: false },
  );
});

test('owner charter form round-trips every charter setting', () => {
  const { w, player } = fixture();
  player('owner').authority = 20;
  w.townCharter = { outside: 'nearest', governance: ['direct'], maxTax: 0.3 };
  const html = charterForm(w);
  has(html, /name="foundingCost"/, /value="nearest" selected/, /name="quorum"/);
  const pairs: [string, string][] = [
    ['founding', 'on'],
    ['foundingCost', '750'],
    ['foundingSkill', 'Build Town'],
    ['maxTowns', '3'],
    ['minSpacing', '800'],
    ['initialRadius', '120'],
    ['maxRadius', '400'],
    ['growthPerBuilding', '5'],
    ['outskirts', '30'],
    ['outside', 'forbid'],
    ['governance', 'election'],
    ['governance', 'direct'],
    ['controls', 'salesTax'],
    ['maxTax', '25'],
    ['taxNoticeDays', '30'],
    ['termDays', '365'],
    ['registrationDays', '20'],
    ['votingDays', '40'],
    ['minCandidates', '2'],
    ['candidateDeposit', '40'],
    ['candidateSkill', ''],
    ['voterResidencyDays', '10'],
    ['quorum', '30'],
    ['proposalDays', '7'],
    ['defaultZoning', 'residential'],
  ];
  const a = charterFormAction(pairs);
  assert.equal(a.type, 'townCharter');
  act(w, 'owner', a);
  assert.deepEqual(w.townCharter, {
    founding: true,
    foundingCost: 75000,
    foundingSkill: 'Build Town',
    maxTowns: 3,
    minSpacing: 800,
    initialRadius: 120,
    maxRadius: 400,
    growth: false,
    growthPerBuilding: 5,
    outskirts: 30,
    outside: 'forbid',
    governance: ['election', 'direct'],
    controls: ['salesTax'],
    maxTax: 0.25,
    taxNoticeDays: 30,
    termDays: 365,
    registrationDays: 20,
    votingDays: 40,
    minCandidates: 2,
    candidateDeposit: 4000,
    bribes: false,
    candidateSkill: '',
    voterResidencyDays: 10,
    quorum: 0.3,
    proposalDays: 7,
    defaultZoning: ['residential'],
  });
});

test('HUD location names the town you are in or the closest one', () => {
  const { w, town } = fixture();
  assert.equal(townLocation(w, { x: town.x, z: town.z }), 'In the town of Puddlewick');
  assert.equal(
    townLocation(w, { x: town.x + town.radius + 50, z: town.z }),
    'Closest town is Puddlewick',
  );
  w.towns = [];
  assert.equal(townLocation(w, { x: 0, z: 0 }), 'Out in the sticks');
});

test('build quote uses the local town tax and explains refusals', () => {
  const { w, town, player } = fixture();
  const p = player('a');
  town.tax = 0.1;
  Object.assign(p, { x: town.x + 20, z: town.z + 20 });
  const quote = constructionQuote(w, p, 'home');
  assert.equal(quote.tax, Math.round(quote.price * 0.1));
  assert.match(quote.note, /Puddlewick construction tax 10%/);
  town.permissions.guests.build = false;
  assert.match(constructionQuote(w, p, 'home').refusal!, /Only residents may build property/);
  Object.assign(p, { x: town.x + town.radius + 300, z: town.z });
  assert.equal(constructionQuote(w, p, 'home').tax, 0);
});

test('found-town form states the charter cost or why founding is closed', () => {
  const { w, player } = fixture();
  const p = player('a');
  has(foundTownForm(w, p), /Found a new town/, /5s 0d/, /name="name"/, /data-action="foundTown"/);
  w.townCharter = { founding: false };
  has(foundTownForm(w, p), /Founding new towns is disabled on this world/);
  assert.doesNotMatch(foundTownForm(w, p), /<form/);
});
