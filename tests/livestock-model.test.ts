// SPDX-License-Identifier: GPL-3.0-or-later
import { defaultCreator } from '../src/shared/creator.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { animalModel } from '../src/client/animal-model.ts';
import {
  LivestockScene,
  livestockSites,
  MAX_VISIBLE_LIVESTOCK,
} from '../src/client/livestock-scene.ts';
import { createWorld, makeBuilding, addPlayer } from '../src/shared/simulation.ts';
import { livestock } from '../src/shared/livestock.ts';
test('animal rigs have natural metre scales, finite geometry and a bounded draw/triangle budget', () => {
  for (const kind of ['cows', 'sheep', 'pigs', 'chickens'] as const) {
    const parts = animalModel(kind),
      box = new T.Box3();
    let triangles = 0;
    for (const p of parts) {
      p.geometry.computeBoundingBox();
      box.union(p.geometry.boundingBox!.clone().translate(p.pivot));
      triangles += p.geometry.attributes.position.count / 3;
      assert.ok(Array.from(p.geometry.attributes.position.array).every(Number.isFinite));
      assert.ok(p.geometry.attributes.color);
      p.geometry.dispose();
    }
    const size = box.getSize(new T.Vector3());
    assert.ok(size.y < (kind === 'cows' ? 1.85 : kind === 'chickens' ? 0.85 : 1.3));
    assert.ok(size.y > (kind === 'cows' ? 1.5 : kind === 'chickens' ? 0.6 : 0.8));
    assert.ok(triangles < 8500, `${kind}: ${triangles}`);
    assert.ok(parts.length <= 7);
  }
});
test('visible herds follow stock, removal and world changes without rebuilding geometry', () => {
  const w = createWorld('animals', 'Animals', 'owner'),
    p = addPlayer(w, 'owner', 'Keeper');
  w.creator = defaultCreator();
  w.creator.roads = false;
  w.buildings = Object.entries(livestock).map(([kind, spec], i) => {
    const b = makeBuilding(kind, kind, i * 22 - 33, -30);
    b.stock = { [spec.animal]: spec.minimum };
    return b;
  });
  p.x = 0;
  p.z = -25;
  const view = new LivestockScene(),
    before = view.group.children.map((c) => (c as T.Mesh).geometry);
  view.update(w, p);
  view.animate(1);
  const sites = livestockSites(w, p);
  assert.equal(sites.length, 10);
  assert.deepEqual(sites, livestockSites(w, p));
  assert.ok(sites.length <= MAX_VISIBLE_LIVESTOCK);
  w.buildings[0].stock.cows = 0;
  view.update(w, p);
  view.animate(2);
  assert.equal(livestockSites(w, p).filter((s) => s.kind === 'cows').length, 0);
  assert.deepEqual(
    view.group.children.map((c) => (c as T.Mesh).geometry),
    before,
  );
  view.reset();
  assert.ok(view.group.children.every((c) => (c as T.InstancedMesh).count === 0));
});

test('cow legs taper continuously from broad upper limbs to narrow ankles', () => {
  for (const leg of animalModel('cows').filter((p) => p.motion === 'leg')) {
    const positions = leg.geometry.attributes.position;
    const span = (height: number) => {
      const xs: number[] = [];
      for (let i = 0; i < positions.count; i++)
        if (Math.abs(positions.getY(i) + leg.pivot.y - height) < 0.001) xs.push(positions.getX(i));
      assert.ok(xs.length > 0);
      return Math.max(...xs) - Math.min(...xs);
    };
    assert.ok(span(1.06) > span(0.25) * 3);
    assert.ok(span(0.61) > span(0.25) * 1.8);
    leg.geometry.dispose();
  }
});
