// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedBridgeSite } from './fixtures/bridge-site';
import { addPlayer } from '../src/shared/simulation';
import { bridgeRuleFields } from '../src/shared/bridge-rules';
import { observe } from '../src/server/npc/observation';
import { searchGuide } from '../src/server/npc/knowledge';
import { rulesSummary } from '../src/shared/rulesets';
import { privatePlayer, prepareFrame } from '../src/server/snapshots';

test('residents see live bridge policy and access facts without somebody else’s private passage or quote', () => {
  const { w, bridge } = completedBridgeSite(),
    p = addPlayer(w, 'resident', 'Resident'),
    owner = addPlayer(w, 'owner', 'Builder');
  Object.assign(p, bridge.approachA);
  p.npc = true;
  w.settings.bridgeToll = 987;
  w.settings.bridgePublicAccess = false;
  owner.bridgePasses = { [bridge.id]: { entered: true } };
  owner.bridgeSurvey = { id: 'private-quote', status: 'pending' };
  const state: any = {
    world: w.id,
    playerId: p.id,
    name: p.name,
    personality: 'Helpful',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    cursor: 0,
    nextAt: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: 'Ready',
    errors: 0,
  };
  const observation: any = observe(
    w,
    p,
    state,
    { recent: () => [], conversation: () => [] } as any,
    'resident',
  );
  for (const key of Object.keys(bridgeRuleFields))
    assert.equal(observation.worldRules[key], w.settings[key as keyof typeof w.settings], key);
  assert.match(observation.bridges[0].access, /private/i);
  assert.equal(observation.bridges[0].id, bridge.id);
  const publicOwner = JSON.parse(prepareFrame(w).players.owner);
  assert.equal(publicOwner.bridgePasses, undefined);
  assert.equal(publicOwner.bridgeSurvey, undefined);
  assert.deepEqual(privatePlayer(w, owner).bridgePasses, owner.bridgePasses);
  assert.match(rulesSummary(w), /Bridge.*987/i);
});

test('player guidance explains bridge funding, toll purchase, maintenance and world-builder controls', () => {
  const text = searchGuide('player built bridges contributions toll maintenance')
    .map((e) => e.text)
    .join('\n');
  for (const term of [/River bridges/, /final/, /Buy passage/, /repair/i, /world/i])
    assert.match(text, term);
});
