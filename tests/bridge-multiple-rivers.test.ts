// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riverCities } from './fixtures/city-river';
import { riverBanks } from '../src/shared/inland-water';
import { surveyBridgeSteps } from '../src/shared/bridge-survey';
import { finishRoadWork } from '../src/shared/road-work';
import { bridgeRoads } from '../src/shared/bridge-network';
import { roadSite, roadRoute } from '../src/shared/road-routing';
import { growPavedTrunkSteps } from '../src/shared/city-trunks';
import type { Bridge, BridgePlan } from '../src/shared/bridge-types';

test('distinct rivers retain independent bridge anchors through closure and removal', () => {
  const { w } = riverCities();
  const bridges: Bridge[] = [];
  for (const river of w.northernIsland!.rivers.slice(0, 2)) {
    let plan: BridgePlan | undefined;
    for (const index of [220, 200, 240, 180, 260]) {
      const p = river.points[index],
        bank = riverBanks(river.points)[index],
        dx = (bank.right.x - bank.left.x) / p.width,
        dz = (bank.right.z - bank.left.z) / p.width;
      const a = { x: p.x - dx * 20, z: p.z - dz * 20 },
        b = { x: p.x + dx * 20, z: p.z + dz * 20 };
      try {
        plan = finishRoadWork(surveyBridgeSteps(w, 'owner', a, b, 'wide'));
        break;
      } catch {
        /* Choose a valid natural bank, not flattened test terrain. */
      }
    }
    assert.ok(plan, `stable natural banks on ${river.id}`);
    bridges.push({
      ...plan,
      id: `bridge:${bridges.length + 1}`,
      owner: 'owner',
      foundedAt: w.time,
      completedAt: w.time,
      condition: 100,
      wearAt: w.time,
      revision: 1,
      paid: structuredClone(plan.bill),
      contributors: { owner: structuredClone(plan.bill) },
    });
  }
  w.bridges = bridges;
  assert.notEqual(bridges[0].river, bridges[1].river);
  assert.equal(bridgeRoads(w).length, 6);
  for (const b of bridges) assert.ok(roadSite(w).segment(b.approachA, b.approachB));
  bridges[0].condition = 0;
  assert.equal(bridgeRoads(w).length, 3);
  assert.ok(bridgeRoads(w).every((r) => r.bridge === bridges[1].id));
  w.bridges = bridges.slice(0, 1);
  assert.equal(bridgeRoads(w).length, 0);
});

test('a paid bridge attracts paved approaches while the genuine old ford route remains traversable', () => {
  const { w, a, b } = riverCities(),
    oldPath = roadRoute(w, a, b);
  assert.ok(oldPath, 'the real terrain has a usable ford');
  const old = oldPath.slice(1).map((b, i) => ({ a: oldPath[i], b, width: 5 }));
  w.roads!.push(...old);
  const river = w.northernIsland!.rivers[0];
  let plan: Bridge | undefined;
  for (const index of [220, 210, 230, 200, 240, 190, 250]) {
    const p = river.points[index],
      bank = riverBanks(river.points)[index],
      dx = (bank.right.x - bank.left.x) / p.width,
      dz = (bank.right.z - bank.left.z) / p.width;
    try {
      const q = finishRoadWork(
        surveyBridgeSteps(
          w,
          'owner',
          { x: p.x - dx * 20, z: p.z - dz * 20 },
          { x: p.x + dx * 20, z: p.z + dz * 20 },
          'wide',
        ),
      );
      plan = {
        ...q,
        id: 'bridge:1',
        owner: 'owner',
        foundedAt: w.time,
        completedAt: w.time,
        condition: 100,
        wearAt: w.time,
        revision: 1,
        paid: structuredClone(q.bill),
        contributors: { owner: structuredClone(q.bill) },
      };
      break;
    } catch {
      /* Existing roads and unsafe banks remain protected. */
    }
  }
  assert.ok(plan, 'find a valid bridge site that preserves the old route');
  w.bridges = [plan];
  const spent = finishRoadWork(growPavedTrunkSteps(w, w.towns[0], [w.pavedRoads![0]], 10000));
  assert.ok(spent > 0);
  assert.ok(!w.pavingProjects?.[w.towns[0].id]?.waitingForBridge);
  for (const r of old) {
    assert.ok(w.roads!.includes(r));
    assert.ok(roadSite(w).segment(r.a, r.b), 'the original ford remains physically usable');
  }
  assert.ok(w.pavedRoads!.some((r) => r.kind === 'trunk'));
});
