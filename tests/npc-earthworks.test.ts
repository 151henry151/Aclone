// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { worldBuildings } from '../src/shared/world-catalogue';
import { earthworkBusinessPlan } from '../src/server/npc/earthworks';
import { operationAction } from '../src/server/npc/player-operations';
import { terrainHeight } from '../src/shared/terrain';
import { pickBuildSite } from '../src/server/npc/chains';

function setup() {
  const w = createWorld('npc-earthworks', 'Hillside businesses', 'owner');
  Object.assign(w, { buildings: [], towns: [], zones: [], roads: [], terrain: [] });
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -100,
    spawnClearance: 0,
    townCentreClearance: 0,
    arrivalAnimation: 'off',
  });
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => 10 + 0.2 * (((i % 33) / 32) * 1000 - 500)),
  };
  const p = addPlayer(w, 'resident', 'Builder');
  Object.assign(p, {
    x: 80,
    z: 80,
    npc: true,
    cash: 10000000,
    vehicle: 5,
    inventory: { ...worldBuildings(w).mill.materials },
  });
  return { w, p, site: { x: 100, z: 100 } };
}
test('a resident can commission a real legal slope remedy without automating machine work', () => {
  const { w, p, site } = setup(),
    before = structuredClone(w);
  const plan = earthworkBusinessPlan(w, p, 'mill', site);
  assert.ok(plan?.length);
  assert.deepEqual(w, before, 'planning is read only');
  for (const step of plan!) {
    if (step.kind === 'move')
      Object.assign(p, { x: step.x, z: step.z, y: terrainHeight(w, step.x, step.z) });
    else if (step.kind === 'operation') act(w, p.id, operationAction(step));
    else assert.fail('No work automation or fabricated resources in this plan');
  }
  const pad = w.earthworks![0];
  assert.equal(pad.work!.contract!.state, 'offered');
  assert.equal(pad.progress, 0);
  assert.ok(pad.work!.cut >= pad.work!.fill, 'cut supplies all fill without an unseen delivery');
  assert.equal(
    p.cash,
    before.players[p.id].cash,
    'no money is fabricated or held before acceptance',
  );
  assert.equal(
    earthworkBusinessPlan(w, p, 'mill', { x: 180, z: 180 }),
    undefined,
    'no duplicate outstanding request',
  );
  w.earthworks = [{ ...pad, progress: 1, work: { ...pad.work!, active: false } }];
  assert.deepEqual(
    pickBuildSite(w, p, 'mill'),
    { x: pad.x, z: pad.z },
    'use the paid completed pad',
  );
});
test('resident requests honor affordability, switches, rate and genuine slope-only need', () => {
  for (const change of ['poor', 'flat', 'disabled', 'limit', 'buildings', 'protected'] as const) {
    const { w, p, site } = setup();
    if (change === 'poor') p.cash = 1;
    if (change === 'buildings') w.settings.maxBuildings = 0;
    if (change === 'flat') w.landscape!.heightmap = Array(1089).fill(10);
    if (change === 'disabled') w.settings.earthworksNpcContracts = false;
    if (change === 'limit') w.settings.earthworksNpcMaximumContracts = 0;
    if (change === 'protected')
      w.zones.push({ id: 'no', kind: 'noBuild', ...site, radius: 100 } as any);
    assert.equal(earthworkBusinessPlan(w, p, 'mill', site), undefined, change);
  }
  const { w, p, site } = setup();
  w.settings.earthworksNpcFeePerVolume = 23;
  const plan = earthworkBusinessPlan(w, p, 'mill', site)!;
  const action = operationAction(plan.find((s) => s.kind === 'operation') as any);
  assert.ok(Number(action.fee) > 0);
  Object.assign(p, site);
  act(w, p.id, action);
  assert.equal(w.earthworks![0].work!.contract!.fee, Math.ceil(w.earthworks![0].work!.volume * 23));
});

test('the resident business planner offers commissioning when a needed mill has no legal ungraded site', async () => {
  const { inventChainPlans } = await import('../src/server/npc/chains');
  const { makeBuilding } = await import('../src/shared/simulation');
  const { w, p } = setup();
  w.buildings.push(
    makeBuilding('farm-supply', 'farm', -250, -100),
    makeBuilding('flour-customer', 'kitchen', -250, 100),
  );
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    experiences: [],
  } as any;
  const choices = inventChainPlans(w, p, state);
  const choice = choices.find((c) =>
    c.plan.some((s) => s.kind === 'operation' && s.operation === 'earthwork'),
  );
  assert.ok(choice, 'the ordinary business planner must expose the paid slope remedy');
  assert.match(choice.description, /Commission earthworks/);
  assert.ok(
    choice.plan
      .filter((s) => s.kind === 'operation')
      .every(
        (s) =>
          (s.kind === 'operation' && s.operation !== 'earthwork') ||
          (s.kind === 'operation' &&
            s.parameters.some((p) => p.name === 'operation' && p.value === 'confirm')),
      ),
  );
});
