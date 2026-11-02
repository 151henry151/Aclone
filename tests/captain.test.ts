// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move } from '../src/shared/simulation';
import { MOTORBOAT, FISHING_BOAT, CHARTER_BOAT, TUGBOAT } from '../src/shared/boats';
import { needsCaptain } from '../src/shared/captain';
import { prepareCaptainRules } from '../src/server/captain-rules';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import { lifeBriefing } from '../src/server/npc/strategy';
import { vehicles } from '../src/shared/catalog';

const CANAL = 3;
const LIFEBOAT = 29;

test('a new world requires captain for boats longer than the motorboat', () => {
  const w = createWorld('fresh', 'Fresh', 'server');
  assert.equal(w.settings.requireCaptainSkill, true);
  assert.equal(needsCaptain(w, MOTORBOAT), false);
  assert.equal(needsCaptain(w, LIFEBOAT), false);
  for (const slot of [CANAL, FISHING_BOAT, CHARTER_BOAT, TUGBOAT])
    assert.equal(needsCaptain(w, slot), true, vehicles[slot].name);
  w.vehicleTuning = {
    9: { mode: 3, length: 9 },
    10: { mode: 3, length: 4 },
    11: { mode: 3, length: 20, requiresCaptain: false },
  };
  assert.equal(needsCaptain(w, 9), true);
  assert.equal(needsCaptain(w, 10), false);
  assert.equal(needsCaptain(w, 11), false);
  w.settings.requireCaptainSkill = false;
  assert.equal(needsCaptain(w, CANAL), false);
});

test('buying or helming a larger boat names the school, and a small boat does not', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  w.settings.vehicleLicences = false;
  const p = addPlayer(w, 'p', 'Skipper');
  p.cash = 5_000_000;
  p.online = true;
  p.skills = [];
  const d = boatLandings(w).find((landing) => landing.building)!;
  Object.assign(p, d.land, {
    y: travelHeight(w, d.land.x, d.land.z),
    vehicle: 5,
    speed: 0,
    engine: false,
  });
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: CANAL, building: d.id }),
    /Learn captain at the school/,
  );
  assert.equal(p.vehicle, 5);
  act(w, p.id, { type: 'vehicle', slot: MOTORBOAT, building: d.id });
  assert.equal(p.vehicle, MOTORBOAT);
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  p.skills.push('captain');
  Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z), speed: 0, engine: false });
  act(w, p.id, { type: 'vehicle', slot: CANAL, building: d.id });
  assert.equal(p.vehicle, CANAL);
  p.skills = [];
  p.speed = 4;
  p.engine = true;
  p.fuel = 20;
  move(w, p, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.equal(p.speed, 0);
  p.skills = ['captain'];
  move(w, p, { throttle: 1, steer: 0, boost: false }, 0.2);
  assert.ok(p.speed > 0);
  const passenger = addPlayer(w, 'q', 'Hand');
  passenger.online = true;
  passenger.hitch = p.id;
  passenger.vehicle = CANAL;
  passenger.speed = 2;
  passenger.skills = [];
  move(w, passenger, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.equal(passenger.speed, 2);
});

test('Puddlewick grants captain once to current owners and folds boatmaster', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  delete w.settings.requireCaptainSkill;
  delete w.captainRulesVersion;
  const owner = addPlayer(w, 'owner', 'Owner');
  owner.fleet = [0, 5, CANAL];
  owner.skills = ['boatmaster', 'farmer'];
  const learner = addPlayer(w, 'learner', 'Learner');
  learner.learning = { skill: 'boatmaster', end: w.time + 60 };
  const walker = addPlayer(w, 'walker', 'Walker');
  walker.fleet = [0, 5, MOTORBOAT];
  walker.skills = [];
  assert.equal(prepareCaptainRules(w), true);
  assert.equal(w.settings.requireCaptainSkill, true);
  assert.deepEqual(owner.skills, ['captain', 'farmer']);
  assert.equal(learner.learning?.skill, 'captain');
  assert.deepEqual(walker.skills, []);
  owner.skills = ['farmer'];
  w.settings.requireCaptainSkill = false;
  assert.equal(prepareCaptainRules(w), false);
  assert.equal(w.settings.requireCaptainSkill, false);
  assert.deepEqual(owner.skills, ['farmer']);

  const other = createWorld('other', 'Other', 'server');
  delete other.settings.requireCaptainSkill;
  delete other.captainRulesVersion;
  const held = addPlayer(other, 'held', 'Held');
  held.fleet = [0, 5, FISHING_BOAT];
  held.skills = ['boatmaster'];
  const plain = addPlayer(other, 'plain', 'Plain');
  plain.fleet = [0, 5, CHARTER_BOAT];
  plain.skills = [];
  prepareCaptainRules(other);
  assert.equal(other.settings.requireCaptainSkill, false);
  assert.deepEqual(held.skills, ['captain']);
  assert.deepEqual(plain.skills, []);
});

test('the resident briefing tells a prospective buyer to learn captain first', () => {
  const w = createWorld('fresh', 'Fresh', 'server');
  const p = addPlayer(w, 'p', 'Ada');
  const briefing = lifeBriefing(w, p).economy as { boats?: string };
  assert.match(briefing.boats ?? '', /captain/);
  assert.match(briefing.boats ?? '', /8000/);
  assert.match(briefing.boats ?? '', /motorboat/);
});
