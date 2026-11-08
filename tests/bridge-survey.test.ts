// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlandLevel } from '../src/shared/inland-water';
import { terrainHeight } from '../src/shared/terrain';
import { highWater } from '../src/shared/ocean';
import { finishRoadWork } from '../src/shared/road-work';
import { bridgeRules } from '../src/shared/bridge-rules';
import { bridgeBill, surveyBridgeSteps } from '../src/shared/bridge-survey';
import { makeBuilding } from '../src/shared/simulation';

import { bridgeSite } from './fixtures/bridge-site';

test('survey the real river, full bank seats and dry ramps with a bounded, yielding workload', () => {
  const { w, a, b, level } = bridgeSite(),
    rules = bridgeRules(w.settings);
  const steps = surveyBridgeSteps(w, 'owner', a, b, 'wide');
  let result = steps.next(),
    yields = 0;
  while (!result.done) {
    yields++;
    result = steps.next();
  }
  assert.ok(yields > 50, 'terrain survey yields throughout the full footprint');
  const plan = result.value;
  assert.equal(plan.width, rules.bridgeWidth);
  assert.ok(plan.deckY - plan.thickness >= level + rules.bridgeClearance - 1e-8);
  for (const [bank, toe] of [
    [plan.a, plan.approachA],
    [plan.b, plan.approachB],
  ]) {
    const length = Math.hypot(bank.x - toe.x, bank.z - toe.z);
    assert.ok(length > 50 && length <= rules.bridgeApproachLength);
    assert.ok(terrainHeight(w, toe.x, toe.z) > inlandLevel(w, toe.x, toe.z, highWater(w)));
    assert.ok(
      (plan.deckY - terrainHeight(w, toe.x, toe.z)) / length <= rules.bridgeMaximumGrade + 1e-6,
    );
  }
  assert.deepEqual(plan.bill, bridgeBill(w.settings, plan));
});

test('the reference span costs 800s plus substantial materials; every cost is a world rule', () => {
  const { w, a, b } = bridgeSite();
  const reference = { a, b, approachA: a, approachB: b, width: 8 };
  assert.deepEqual(bridgeBill(w.settings, reference), {
    cash: 8_000_000,
    materials: { steel: 600, wood: 200, gravel: 1000, stone: 400 },
  });
  const narrow = bridgeBill(w.settings, { ...reference, width: 4 });
  assert.equal(narrow.cash, 4_000_000);
  assert.equal(narrow.materials.steel, 300);
  const changed = {
    ...w.settings,
    bridgeCashPerSquareMetre: 10,
    bridgeSteelPerSquareMetre: 0,
    bridgeWoodPerSquareMetre: 0,
    bridgeStonePerSquareMetre: 0,
    bridgeGravelPerSquareMetre: 0,
    bridgeApproachCashPerMetre: 0,
    bridgeApproachStonePerMetre: 0,
    bridgeApproachGravelPerMetre: 0,
  };
  assert.deepEqual(bridgeBill(changed, reference), {
    cash: 3200,
    materials: { steel: 0, wood: 0, gravel: 0, stone: 0 },
  });
});

test('refuse wet banks, no river, excessive span, steep or wet ramps and disabled construction', () => {
  const { w, a, b, point } = bridgeSite();
  const survey = (x = a, y = b) => finishRoadWork(surveyBridgeSteps(w, 'owner', x, y, 'wide'));
  assert.throws(() => survey(point(0), b), /bank.*dry|dry.*bank/i);
  assert.throws(() => survey(point(-80), point(-40)), /river/i);
  assert.throws(() => survey(point(-100), point(100)), /span/i);
  w.settings.bridgeApproachLength = 10;
  assert.throws(() => survey(), /approach|grade/i);
  w.settings.bridgeBuilding = false;
  assert.throws(() => survey(), /disabled/i);
});

test('reserve the whole width and approaches against buildings, protected land and permissions', () => {
  for (const obstruction of ['building', 'zone', 'permission'] as const) {
    const { w, a, b, point } = bridgeSite();
    const q = point(-50, 3);
    if (obstruction === 'building') w.buildings.push(makeBuilding('blocked', 'home', q.x, q.z));
    if (obstruction === 'zone') w.zones.push({ ...q, kind: 'noBuild', radius: 2 } as any);
    if (obstruction === 'permission') {
      w.towns[0] = {
        ...w.towns[0],
        ...q,
        radius: 8,
        residents: [],
        permissions: {
          residents: { build: true, roads: true, environment: true },
          guests: { build: false, roads: false, environment: false },
        },
      };
    }
    assert.throws(
      () => finishRoadWork(surveyBridgeSteps(w, 'owner', a, b, 'wide')),
      /obstruct|prohibited|residents|permission/i,
      obstruction,
    );
  }
});

test('a protected town border between terrain samples still blocks the whole bridge width', () => {
  const { w, a, b, point } = bridgeSite();
  w.towns[0] = {
    ...w.towns[0],
    ...point(-60.5, 20.15),
    radius: 15.975,
    residents: [],
    permissions: {
      residents: { build: true, roads: true, environment: true },
      guests: { build: false, roads: false, environment: false },
    },
  };
  assert.throws(
    () => finishRoadWork(surveyBridgeSteps(w, 'owner', a, b, 'wide')),
    /resident|permission/i,
  );
});

test('a parked trailer reserves its full footprint before a bridge survey', () => {
  const { w, a, b, point } = bridgeSite();
  w.trailers = {
    blocked: {
      id: 'blocked',
      owner: 'other',
      kind: 'dump',
      ...point(-60),
      heading: 0,
      cargo: { stone: 100 },
    },
  };
  assert.throws(
    () => finishRoadWork(surveyBridgeSteps(w, 'owner', a, b, 'wide')),
    /trailer|vehicle|footprint/i,
  );
});
