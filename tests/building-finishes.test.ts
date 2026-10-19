// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildingModel } from '../src/client/buildings.ts';
import { buildingFinish, buildingTexture } from '../src/client/building-finishes.ts';
import { buildingPlan } from '../src/shared/building-shapes.ts';
import { makeBuilding } from '../src/shared/simulation.ts';
import { buildings } from '../src/shared/catalog.ts';
import { buildingStyle } from '../src/shared/building-designs.ts';
import { appearance } from '../src/shared/appearance.ts';
import { detailTexture } from '../src/client/detail-textures.ts';
import { TownLighting } from '../src/client/lighting.ts';

function model(kind: string, id = 'preview-' + kind) {
  return buildingModel(makeBuilding(id, kind, 0, 0), (m) => m);
}
function triangles(root: T.Object3D) {
  let count = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh)
      count += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  return count;
}
test('surface details keep representative buildings within their geometry budgets', () => {
  // Original material-pass budgets, plus 72 triangles for the new cottage mailbox.
  for (const [kind, budget] of Object.entries({
    bakery: 610,
    bank: 250,
    garage: 366,
    farm: 574,
    mill: 1076,
    waterworks: 1132,
    home: 320,
    starport: 28986,
  }))
    assert.ok(triangles(model(kind)) <= budget, kind);
  assert.ok(triangles(model('garage')) < 100);
  assert.ok(triangles(model('farm')) < 100);
});
test('a populated catalogue reuses a bounded material library across world rebuilds', () => {
  const textures = new Set<T.Texture>();
  function gather(root: T.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const map = (m as T.MeshStandardMaterial).map;
        if (map?.userData.buildingFinish) textures.add(map);
      }
    });
  }
  for (const kind of Object.keys(buildings)) gather(model(kind));
  const before = textures.size;
  for (const kind of Object.keys(buildings)) gather(model(kind, 'another-' + kind));
  assert.equal(textures.size, before, 'new IDs must not create unique textures');
  assert.ok(before >= 12 && before <= 18);
  let bytes = 0;
  for (const map of textures) {
    const t = map as T.DataTexture;
    assert.ok(t.userData.shared && t.generateMipmaps);
    assert.ok(t.image.width <= 512 && t.image.height <= 512);
    bytes += t.image.data.byteLength;
  }
  assert.ok(bytes <= 11 * 1024 * 1024, 'base RGBA library stays below 11 MiB');
  assert.notEqual(buildingTexture('brick'), buildingTexture('limestone'));
});
test('shop and civic window details retain dark frames and survive light batching', () => {
  const mask = detailTexture('window-light');
  const original = detailTexture('window').image.data as Uint8Array;
  for (const kind of ['bakery', 'market', 'bank', 'garage']) {
    const root = model(kind);
    let panes = 0;
    root.traverse((o) => {
      if (!(o instanceof T.Mesh) || !o.userData.lightSource) return;
      panes++;
      assert.equal(o.geometry.index?.count, 6);
      const m = o.material as T.MeshStandardMaterial;
      assert.equal(m.emissiveMap, mask);
      const pixels = (m.map as T.DataTexture).image.data as Uint8Array;
      // Check every unlit frame/mullion pixel is still the original frame.
      for (let i = 0; i < pixels.length; i += 4)
        if (!mask.image.data[i])
          assert.deepEqual(pixels.subarray(i, i + 3), original.subarray(i, i + 3));
    });
    assert.ok(panes > 0);
    const lighting = new TownLighting();
    lighting.reset(root);
    let batches = 0;
    root.traverse((o) => {
      if (o instanceof T.Mesh && (o.material as T.MeshStandardMaterial).emissiveMap) {
        batches++;
        assert.equal((o.material as T.MeshStandardMaterial).emissiveMap, mask);
      }
    });
    assert.equal(batches, 1, 'all panes of one building still merge');
  }
});
test('cottage customization keeps the chosen siding, colour and trim', () => {
  for (const style of appearance.cottages) {
    const b = makeBuilding('styled-' + style.id, 'home', 0, 0);
    b.style = style.id;
    const plan = buildingPlan(b),
      finish = buildingFinish('home', plan);
    assert.equal(finish.tint, style.wall);
    assert.equal(finish.accent, style.trim);
    assert.equal(finish.wall, buildingStyle('home', style.id)!.finish);
    assert.equal(plan.volumes[0].roof, style.roof);
  }
});
