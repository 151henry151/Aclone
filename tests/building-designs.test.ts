// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  buildingStyles,
  buildingDesignQuote,
  sizesForBuilding,
} from '../src/shared/building-designs.ts';
import { buildingPlan, buildingBounds, blocksBuilding } from '../src/shared/building-shapes.ts';
import { buildings, items } from '../src/shared/catalog.ts';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation.ts';
import { constructionSiteReason } from '../src/shared/construction-site.ts';
import { constructionRefund } from '../src/shared/construction.ts';
import { buildingModel } from '../src/client/buildings.ts';
import { roomCount } from '../src/shared/lodging.ts';
import { Store } from '../src/server/store.ts';
import { waterworksSite } from '../src/shared/shoreline.ts';
function setup() {
  const w = createWorld('design', 'Design', 'builder');
  w.buildings = [];
  w.zones = [];
  w.tier = 10;
  const p = addPlayer(w, 'builder', 'Builder');
  p.cash = 100000000;
  w.towns[0].tax = 0.1;
  return { w, p };
}
test('every catalogue building offers six complete designs with valid material lists and a model', () => {
  for (const [kind, def] of Object.entries(buildings)) {
    const styles = buildingStyles(kind);
    assert.equal(styles.length, 6, kind);
    assert.equal(new Set(styles.map((s) => s.id)).size, 6);
    for (const style of styles)
      for (const size of sizesForBuilding(kind)) {
        const q = buildingDesignQuote(kind, def, style.id, size.id);
        assert.ok(q.materials.gravel > 0, kind);
        assert.ok(q.capacity >= def.capacity && q.price >= def.price);
        for (const [item, n] of Object.entries(q.materials)) {
          assert.ok(items[item], item);
          assert.ok(Number.isSafeInteger(n) && n > 0);
        }
        const b = makeBuilding('construction', kind, 0, 0);
        b.style = style.id;
        b.size = size.id;
        const model = buildingModel(b, (m) => m);
        let triangles = 0;
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
            assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite), kind);
          }
        });
        assert.ok(
          triangles < (kind === 'starport' ? 30000 : 2200),
          `${kind} ${style.id}: ${triangles}`,
        );
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
          }
        });
      }
  }
});
test('materials match the shell and size without removing specialist equipment', () => {
  const stone = buildingDesignQuote('workshop', buildings.workshop, 'stone-gable');
  const wood = buildingDesignQuote('workshop', buildings.workshop, 'red-timber');
  const metal = buildingDesignQuote('workshop', buildings.workshop, 'metal-panel');
  assert.ok(stone.materials.blocks > wood.materials.blocks);
  assert.ok(wood.materials.wood > stone.materials.wood);
  assert.ok(metal.materials.steel > 0 && metal.materials.concrete > 0);
  for (const [item, n] of Object.entries(buildings.workshop.materials))
    if (!['blocks', 'wood', 'bricks'].includes(item)) assert.ok(stone.materials[item] >= n);
  const large = buildingDesignQuote('workshop', buildings.workshop, 'red-timber', 'large');
  assert.equal(large.capacity, wood.capacity * 2);
  assert.ok(large.price > wood.price * 2);
  for (const item of Object.keys(wood.materials))
    assert.ok(large.materials[item] > wood.materials[item]);
  assert.deepEqual(buildingDesignQuote('home', buildings.home).materials, buildings.home.materials);
});
test('placement charges selected cash and tax, persists size/rotation, supplies and refunds exact design', () => {
  const { w, p } = setup(),
    before = p.cash;
  const q = buildingDesignQuote('hotel', buildings.hotel, 'brick-workshop', 'large');
  act(w, p.id, {
    type: 'construct',
    kind: 'hotel',
    style: 'brick-workshop',
    size: 'large',
    rotation: Math.PI / 2,
  });
  const b = w.buildings[0];
  assert.equal(p.cash, before - q.price - Math.round(q.price * 0.1));
  assert.equal(b.capacity, q.capacity);
  assert.deepEqual(b.construction, q.materials);
  assert.equal(roomCount(b), 16);
  assert.equal(constructionRefund(w, b), Math.floor(q.price * 0.75));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world.buildings[0];
    assert.equal(saved.size, 'large');
    assert.equal(saved.rotation, Math.PI / 2);
  } finally {
    store.close();
  }
  p.inventory = { ...q.materials };
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.construction, undefined);
  assert.equal(b.size, 'large');
  assert.equal(b.capacity, q.capacity);
});
test('invalid designs, size and rotation cannot charge cash or place a foundation', () => {
  for (const options of [
    { style: 'made-up' },
    { style: 'red-timber', size: 'enormous' },
    { rotation: Infinity },
    { rotation: '90' },
    { size: 'large' },
    { style: 'metal-panel', size: 'large', kind: 'waterworks' },
  ]) {
    const { w, p } = setup(),
      before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home', ...options }));
    assert.equal(JSON.stringify(w), before);
  }
});
test('preview footprint is independent of generated IDs and collision uses selected size/rotation', () => {
  const a = buildingPlan({ id: 'construction', kind: 'home', style: 'stone-hip', size: 'large' });
  const b = buildingPlan({ id: 'b-new-id', kind: 'home', style: 'stone-hip', size: 'large' });
  assert.deepEqual(a, b);
  const small = buildingBounds(
    buildingPlan({ id: 'construction', kind: 'warehouse', style: 'red-timber' }),
  );
  const large = buildingBounds(
    buildingPlan({ id: 'construction', kind: 'warehouse', style: 'red-timber', size: 'large' }),
  );
  assert.ok(large.width > small.width);
  const building = {
    ...makeBuilding('test', 'warehouse', 0, 0),
    style: 'red-timber',
    size: 'large' as const,
    rotation: Math.PI / 2,
  };
  assert.ok(blocksBuilding(building, 0, large.width / 2 - 0.1, 0, 0));
  assert.ok(!blocksBuilding(building, large.width / 2 + 0.1, 0, 0, 0));
});
test('rotated long buildings cannot overlap despite distant centers; clear rotated sites pass', () => {
  const { w } = setup();
  const other = makeBuilding('other', 'warehouse', 0, 0);
  other.style = 'red-timber';
  other.size = 'large';
  w.buildings = [other];
  const candidate = {
    ...makeBuilding('construction', 'warehouse', 0, 0),
    style: 'red-timber',
    size: 'large' as const,
    x: 16,
    rotation: Math.PI / 2,
  };
  assert.match(constructionSiteReason(w, candidate) ?? '', /footprint/);
  candidate.x = 45;
  assert.equal(constructionSiteReason(w, candidate), undefined);
});
test('chosen waterworks rotation is honored and an inland-facing intake is rejected', () => {
  const { w, p } = setup();
  p.x = 0;
  p.z = 144;
  const shore = waterworksSite(w, p)!;
  assert.ok(shore);
  const before = p.cash;
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'construct',
        kind: 'waterworks',
        style: 'metal-panel',
        rotation: (shore.rotation + Math.PI) % (Math.PI * 2),
      }),
    /shoreline/,
  );
  assert.equal(p.cash, before);
  act(w, p.id, {
    type: 'construct',
    kind: 'waterworks',
    style: 'metal-panel',
    rotation: shore.rotation,
  });
  assert.equal(w.buildings[0].rotation, shore.rotation);
});

test('lodging entrances remain outside the enlarged lobby instead of behind its wall', () => {
  for (const size of sizesForBuilding('hotel')) {
    const b = { ...makeBuilding('preview', 'hotel', 0, 0), style: 'red-timber', size: size.id };
    const porch = buildingPlan(b).volumes[1];
    const root = buildingModel(b, (m) => m);
    assert.ok(
      root.children.some(
        (o) =>
          o instanceof T.Mesh &&
          o.geometry instanceof T.PlaneGeometry &&
          Math.abs(o.geometry.parameters.height - 2.23) < 0.001 &&
          o.position.z > porch.z + porch.depth / 2,
      ),
      size.id,
    );
  }
});
