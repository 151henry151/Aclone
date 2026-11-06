// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { prepareWaterSources } from '../src/shared/springs';
import { inventChainPlans } from '../src/server/npc/chains';
import { operationAction } from '../src/server/npc/player-operations';
import { inspectionChoices } from '../src/server/npc/perception';
import { searchGuide } from '../src/server/npc/knowledge';
import type { ResidentState } from '../src/server/npc/memory';
test('fresh-water founding plans build through ordinary placement and thirsty residents inspect pumps', () => {
  const w = createWorld('fresh-founder', 'Fresh founder', 'owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  Object.assign(w.settings, { mapSize: 500, seaLevel: -2, tidalRange: 0 });
  w.terrainMapSize = 500;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(30),
  };
  w.springs = [{ id: 'spring-founder', x: 100, z: 100, flow: 1 }];
  prepareWaterSources(w);
  const p = addPlayer(w, 'owner', 'Founder');
  Object.assign(p, {
    x: 100,
    z: 108,
    cash: 10000000,
    inventory: { wood: 6, blocks: 6, steel: 1, gravel: 4 },
  });
  const state = { plan: [], index: 0 } as unknown as ResidentState;
  const plans = inventChainPlans(w, p, state),
    idea = plans.find((c) => c.description.includes('Pump-house'));
  assert.ok(idea);
  assert.ok(!plans.some((c) => c.description.includes('Desalination plant')));
  for (const step of idea.plan) {
    if (step.kind === 'move') {
      p.x = step.x;
      p.z = step.z;
    }
    if (step.kind === 'operation' && step.operation === 'construct')
      act(w, p.id, operationAction(step));
  }
  assert.equal(w.buildings[0].kind, 'pumpHouse');
  assert.equal(w.buildings[0].waterSource?.spring, 'spring-founder');
  const q = addPlayer(w, 'thirsty', 'Thirsty');
  q.thirst = 30000;
  delete w.buildings[0].construction;
  w.buildings.push(makeBuilding('quarry', 'quarry', 0, 10));
  const inspect = inspectionChoices(w, q, state);
  assert.match(inspect[0].description, /Pump-house/);
});
test('the NPC knowledge base describes both water producers and unbottled spring drinks', () => {
  assert.match(
    searchGuide('building:pumpHouse')
      .map((e) => e.text)
      .join(' '),
    /Pump-house/,
  );
  assert.match(
    searchGuide('building:waterworks')
      .map((e) => e.text)
      .join(' '),
    /Desalination plant/,
  );
  assert.match(
    searchGuide('Springs and pump-houses')
      .map((e) => e.text)
      .join(' '),
    /20-second cooldown/,
  );
});
