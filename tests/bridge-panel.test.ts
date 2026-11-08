// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bridgeSite, completedBridgeSite } from './fixtures/bridge-site';
import { addPlayer } from '../src/shared/simulation';
import { bridgePanel } from '../src/client/bridge-panel';
import { settingsFields } from '../src/client/creator-editor';
import { bridgeRuleFields } from '../src/shared/bridge-rules';
import { surveyBridgeSteps } from '../src/shared/bridge-survey';
import { finishRoadWork } from '../src/shared/road-work';

test('bridge building has empty, surveying, refused and quoted states with explicit final donations', () => {
  const { w, a, b } = bridgeSite(),
    p = addPlayer(w, 'owner', 'Builder');
  Object.assign(p, a);
  const draft = { world: w.id, a, b, design: 'wide' as const };
  assert.match(bridgePanel(w, p, draft), /No bridge projects/);
  assert.match(bridgePanel(w, p, draft), /data-bridge-map/);
  p.bridgeSurvey = { id: 'q', status: 'pending' };
  assert.match(bridgePanel(w, p, draft), /Surveying/);
  p.bridgeSurvey = { id: 'q', status: 'failed', reason: 'Both banks must be dry' };
  assert.match(bridgePanel(w, p, draft), /Both banks must be dry/);
  p.bridgeSurvey = {
    id: 'q',
    status: 'ready',
    plan: finishRoadWork(surveyBridgeSteps(w, p.id, a, b, 'wide')),
  };
  p.cash = 0;
  const html = bridgePanel(w, p, draft);
  assert.match(html, /not refundable|final/i);
  assert.match(html, /Not enough cash/);
  assert.match(html, /Steel/);
  assert.match(html, /data-bridge-op="found"[^>]*disabled/);
  w.settings.bridgeBuilding = false;
  assert.match(bridgePanel(w, p, draft), /disabled in this world/);
});

test('the completed crossing exposes access, repair and removal without hiding its financial history', () => {
  const { w, bridge } = completedBridgeSite(),
    p = addPlayer(w, 'owner', 'Builder');
  Object.assign(p, bridge.approachA);
  const html = bridgePanel(w, p, { world: w.id, a: bridge.a, b: bridge.b, design: 'wide' });
  assert.match(html, /Bridge complete/);
  assert.match(html, /data-bridge-op="repair"/);
  assert.match(html, /data-bridge-op="remove"/);
  assert.match(html, /Contributions/);
});

test('world-builder bridge controls appear exactly once with metadata labels and constraints', () => {
  const { w } = bridgeSite(),
    html = settingsFields(w.settings);
  assert.match(html, /<legend>Player-built bridges<\/legend>/);
  for (const key of Object.keys(bridgeRuleFields))
    assert.equal(html.split(`name="${key}"`).length - 1, 1, key);
});

test('changing the selected bank or design hides an earlier quote until a fresh survey', () => {
  const { w, a, b } = bridgeSite(),
    p = addPlayer(w, 'owner', 'Builder');
  p.bridgeSurvey = {
    id: 'old',
    status: 'ready',
    plan: finishRoadWork(surveyBridgeSteps(w, p.id, a, b, 'wide')),
  };
  for (const draft of [
    { world: w.id, a, b: { x: b.x + 1, z: b.z }, design: 'wide' as const },
    { world: w.id, a, b, design: 'narrow' as const },
  ]) {
    assert.doesNotMatch(bridgePanel(w, p, draft), /data-bridge-op="found"/);
    assert.match(bridgePanel(w, p, draft), /survey.*again|fresh survey/i);
  }
});
