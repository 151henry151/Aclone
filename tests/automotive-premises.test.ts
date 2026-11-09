// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { worldBuildings } from '../src/shared/world-catalogue';
import { buildingArchitectures } from '../src/shared/building-architecture';
import { buildingDesignQuote, buildingStyles } from '../src/shared/building-designs';
import { buildingPlan, buildingBounds } from '../src/shared/building-shapes';

test('automotive models have assembly-sized halls and finishes cannot remove their equipment investment', () => {
  const w = createWorld('assembly-model', 'Assembly', 'owner'),
    def = worldBuildings(w).automotiveFactory;
  const models = buildingArchitectures('automotiveFactory');
  assert.equal(models.length, 5);
  for (const model of models) {
    const plan = buildingPlan({ id: 'factory', kind: 'automotiveFactory', architecture: model.id }),
      bounds = buildingBounds(plan);
    assert.ok(bounds.width >= 30 && bounds.depth >= 24, `${model.id}: a real assembly hall`);
    for (const style of buildingStyles('automotiveFactory', model.id)) {
      const quote = buildingDesignQuote(
        'automotiveFactory',
        def,
        style.id,
        'standard',
        model.id,
        w.settings,
      );
      for (const [item, n] of Object.entries(def.materials))
        assert.ok(quote.materials[item] >= n, `${style.id} preserves ${item}`);
      assert.ok(quote.price >= def.price);
    }
  }
});

test('founding charges configured cash only once and deliveries complete the real factory bill without creating vehicles', () => {
  const w = createWorld('assembly-construction', 'Assembly', 'owner'),
    p = addPlayer(w, 'owner', 'Builder');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.tier = 10;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(p, { x: 65, z: 0, cash: 100, inventory: {} });
  const action = { type: 'construct', kind: 'automotiveFactory' };
  assert.throws(() => act(w, p.id, action), /cash/i);
  assert.equal(w.buildings.length, 0);
  p.cash = 20_000_000;
  act(w, p.id, action);
  const b = w.buildings[0];
  assert.equal(p.cash, 4_000_000);
  assert.deepEqual(b.construction, worldBuildings(w).automotiveFactory.materials);
  assert.deepEqual(b.stock, {});
  assert.equal(b.manufacturing, undefined);
  assert.throws(
    () => act(w, p.id, { type: 'manufacturing', building: b.id, op: 'queue', product: 'tractor' }),
    /construction/i,
  );
  p.inventory = { steel: 400 };
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.construction!.steel, 0);
  assert.ok(b.construction);
  p.inventory = { ...b.construction };
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.construction, undefined);
  assert.equal(b.manufacturing, undefined);
  assert.deepEqual(b.stock, {});
});

test('the standard automotive hall uses industrial cladding instead of a cottage finish', () => {
  const plan = buildingPlan({ id: 'assembly', kind: 'automotiveFactory' });
  assert.equal(plan.finish, 'metal');
});

test('assembly halls use industrial loading bays with aligned facade exclusions', async () => {
  const { buildingBays } = await import('../src/shared/building-bays');
  const { industrialKinds, loadingBayXs } = await import('../src/shared/building-facade');
  assert.ok(industrialKinds.has('automotiveFactory'));
  for (const model of buildingArchitectures('automotiveFactory')) {
    const b = { ...makeBuilding('assembly', 'automotiveFactory', 0, 0), architecture: model.id };
    const plan = buildingPlan(b),
      main = plan.volumes[0];
    assert.ok(
      plan.volumes.filter((v) => v.eaves >= 8).flatMap((v) => loadingBayXs(b.kind, v)).length >= 2,
    );
    assert.ok(buildingBays(b, plan).length >= 2);
  }
});
