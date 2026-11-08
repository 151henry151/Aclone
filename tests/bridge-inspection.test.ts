// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedBridgeSite } from './fixtures/bridge-site';
import { inspectBridgeSteps, advanceBridgeInspections } from '../src/shared/bridge-inspection';
import { finishRoadWork } from '../src/shared/road-work';
import { bridgeRoads } from '../src/shared/bridge-network';
import { bridgeDeckHeight, bridgeGroundBlocked } from '../src/shared/bridge-geometry';
import { addPlayer, makeBuilding } from '../src/shared/simulation';
import { surveyBridgeSteps } from '../src/shared/bridge-survey';

test('saved decks close after unsafe terrain, water or obstacle edits and reopen after repair of the site', () => {
  for (const edit of ['terrain', 'water', 'obstacle'] as const) {
    const { w, bridge, point } = completedBridgeSite();
    assert.doesNotThrow(() => finishRoadWork(inspectBridgeSteps(w, bridge)));
    const saved = structuredClone(w),
      q = point(-60);
    if (edit === 'terrain') w.terrain.push({ ...q, radius: 20, height: 20 });
    if (edit === 'water') w.settings.seaLevel = bridge.deckY;
    if (edit === 'obstacle') w.buildings.push(makeBuilding('obstruction', 'home', q.x, q.z));
    assert.throws(
      () => finishRoadWork(inspectBridgeSteps(w, bridge)),
      /ground|water|obstruct|approach/i,
      edit,
    );
    advanceBridgeInspections(w);
    assert.equal(bridgeRoads(w).length, 0, 'no routing into an unverified or failed crossing');
    for (let i = 0; i < 1000 && bridge.closure === 'Checking bridge safety'; i++)
      advanceBridgeInspections(w);
    assert.match(bridge.closure ?? '', /ground|water|obstruct|approach/i);
    assert.equal(
      bridgeDeckHeight(w, point(0).x, point(0).z),
      bridge.deckY,
      'retain physical support',
    );
    const p = addPlayer(w, 'traveller', 'Traveller');
    Object.assign(p, point(-1), {
      vehicle: 0,
      heading: Math.atan2(bridge.b.x - bridge.a.x, bridge.b.z - bridge.a.z),
    });
    assert.equal(bridgeGroundBlocked(w, p, point(-2)), false, 'occupants can retreat');
    Object.assign(w, {
      terrain: saved.terrain,
      settings: saved.settings,
      buildings: saved.buildings,
    });
    for (let i = 0; i < 1000; i++) {
      advanceBridgeInspections(w);
      if (!bridge.closure) break;
    }
    assert.equal(bridge.closure, undefined);
    assert.equal(bridgeRoads(w).length, 3);
  }
});

test('reserve bank ramps without obstructing a pre-existing ford road or narrow protected sliver', () => {
  for (const obstruction of ['ford', 'zone'] as const) {
    const { w, a, b, point } = completedBridgeSite();
    w.bridges = [];
    if (obstruction === 'ford') w.roads!.push({ a: point(-60, -20), b: point(-60, 20), width: 5 });
    else w.zones.push({ id: 'sliver', kind: 'noBuild', ...point(-60.5, 4.15), radius: 0.1 });
    assert.throws(
      () => finishRoadWork(surveyBridgeSteps(w, 'owner', a, b, 'wide')),
      /road|zone|prohibited/i,
    );
  }
});

test('dry excavation under a bank foundation closes the saved crossing', () => {
  const { w, bridge, point } = completedBridgeSite();
  const q = point(-22);
  w.terrain.push({ ...q, radius: 2, height: -2 });
  assert.throws(() => finishRoadWork(inspectBridgeSteps(w, bridge)), /foundation/i);
  assert.equal(bridgeDeckHeight(w, point(0).x, point(0).z), bridge.deckY);
  w.terrain.pop();
  assert.doesNotThrow(() => finishRoadWork(inspectBridgeSteps(w, bridge)));
});
