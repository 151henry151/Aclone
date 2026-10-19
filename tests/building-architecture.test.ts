// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildings, items } from '../src/shared/catalog.ts';
import { buildingArchitectures } from '../src/shared/building-architecture.ts';
import {
  buildingStyles,
  buildingDesignQuote,
  sizesForBuilding,
} from '../src/shared/building-designs.ts';
import { buildingPlan, buildingBounds, blocksBuilding } from '../src/shared/building-shapes.ts';
import { buildingModel } from '../src/client/buildings.ts';
import { buildingPreviewRadius } from '../src/client/build-preview-scale.ts';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation.ts';
import { exportDesign, applyDesign } from '../src/server/world-design.ts';
import { Store } from '../src/server/store.ts';
import { constructionSiteReason } from '../src/shared/construction-site.ts';

function setup() {
  const w = createWorld('architecture', 'Architecture', 'owner');
  w.buildings = [];
  w.zones = [];
  w.tier = 10;
  const p = addPlayer(w, 'owner', 'Owner');
  p.cash = 10000000;
  return { w, p };
}
const release = (root: T.Object3D) =>
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
test('all 48 types have five distinct structural models; finishes do not change their geometry', () => {
  assert.equal(Object.keys(buildings).length, 48);
  for (const [kind, def] of Object.entries(buildings)) {
    const models = buildingArchitectures(kind);
    assert.equal(models.length, 5, kind);
    const signatures = new Set<string>();
    for (const a of models) {
      const finishes = buildingStyles(kind, a.id);
      assert.equal(finishes.length, 6);
      const base = {
        ...makeBuilding('preview', kind, 0, 0),
        architecture: a.id,
        style: finishes[0].id,
      };
      signatures.add(JSON.stringify(buildingPlan(base).volumes));
      for (const size of sizesForBuilding(kind)) {
        const b = { ...base, size: size.id },
          plan = buildingPlan(b);
        for (const finish of finishes) {
          assert.deepEqual(
            buildingPlan({ ...b, style: finish.id }).volumes,
            plan.volumes,
            `${kind} ${a.id} finish changed shape`,
          );
          const q = buildingDesignQuote(kind, def, finish.id, size.id, a.id);
          assert.ok(q.materials.gravel > 0);
          for (const [item, n] of Object.entries(q.materials))
            assert.ok(items[item] && Number.isSafeInteger(n) && n > 0);
        }
        const root = buildingModel(b, (m) => m);
        let triangles = 0;
        root.traverse((o) => {
          if (o instanceof T.Mesh) {
            assert.ok(
              [...o.geometry.attributes.position.array].every(Number.isFinite),
              `${kind} ${a.id}`,
            );
            triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
          }
        });
        assert.ok(
          triangles < (kind === 'starport' ? 30000 : 3500),
          `${kind} ${a.id} ${size.id}: ${triangles} triangles`,
        );
        release(root);
      }
    }
    assert.equal(signatures.size, 5, kind + ' repeated layouts');
  }
});
test('size extensions add wings or floors, not scaled-up doors or copies of the same footprint', () => {
  for (const kind of Object.keys(buildings))
    if (sizesForBuilding(kind).length > 1)
      for (const a of buildingArchitectures(kind)) {
        const base = { id: 'preview', kind, architecture: a.id };
        const small = buildingPlan(base),
          expanded = buildingPlan({ ...base, size: 'expanded' }),
          large = buildingPlan({ ...base, size: 'large' });
        assert.ok(expanded.volumes.length > small.volumes.length);
        assert.equal(expanded.volumes[0].width, small.volumes[0].width);
        assert.equal(expanded.doorHeight, small.doorHeight);
        assert.ok(
          large.volumes.length > expanded.volumes.length ||
            large.volumes[0].eaves > expanded.volumes[0].eaves,
        );
        const bounds = buildingBounds(large);
        assert.ok(
          buildingPreviewRadius(kind) >= Math.hypot(bounds.width, bounds.height, bounds.depth) / 2,
        );
      }
});
test('container finishes are paint colours with identical steel bills and standard container dimensions', () => {
  const colors = buildingStyles('pickup', 'model-1');
  assert.equal(new Set(colors.map((c) => c.wall)).size, 6);
  let previous: unknown;
  for (const c of colors) {
    assert.equal(c.finish, 'metal');
    assert.equal(c.structure, 'steel');
    const q = buildingDesignQuote('pickup', buildings.pickup, c.id, 'standard', 'model-1');
    if (previous) assert.deepEqual(q.materials, previous);
    previous = q.materials;
    assert.ok(q.materials.steel > 0);
  }
  const a = buildingPlan({ id: 'a', kind: 'pickup', architecture: 'model-1' }).volumes[0];
  const b = buildingPlan({ id: 'b', kind: 'pickup', architecture: 'model-2' }).volumes[0];
  assert.equal(a.width, 2.44);
  assert.equal(a.depth, 6.06);
  assert.equal(b.depth, 12.19);
  const legacy = buildingModel(makeBuilding('legacy', 'pickup', 0, 0), (m) => m);
  let plates = 0;
  legacy.traverse((o) => {
    if (o.userData.containerPlate) plates++;
  });
  assert.equal(plates, 1);
  release(legacy);
});
test('construction validates, charges and persists the chosen model, finish, size and material bill', () => {
  const { w, p } = setup();
  const q = buildingDesignQuote(
    'warehouse',
    buildings.warehouse,
    'brick-workshop',
    'large',
    'model-2',
  );
  act(w, p.id, {
    type: 'construct',
    kind: 'warehouse',
    architecture: 'model-2',
    style: 'brick-workshop',
    size: 'large',
    rotation: Math.PI / 2,
  });
  const b = w.buildings[0];
  assert.equal(b.architecture, 'model-2');
  assert.deepEqual(b.construction, q.materials);
  assert.equal(b.price, q.price);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.buildings[0], b);
  } finally {
    store.close();
  }
  const copy = createWorld('copy', 'Copy', 'owner');
  applyDesign(copy, exportDesign(w));
  assert.equal(copy.buildings[0].architecture, b.architecture);
  assert.equal(copy.buildings[0].size, 'large');
  assert.equal(copy.buildings[0].capacity, q.capacity);
  assert.deepEqual(buildingPlan(copy.buildings[0]), buildingPlan(b));
});
test('invalid model/finish combinations do not mutate the world or charge cash', () => {
  for (const options of [
    { architecture: 'model-6', style: 'stone-gable' },
    { architecture: 'model-1' },
    { kind: 'pickup', architecture: 'model-1', style: 'stone-gable' },
  ]) {
    const { w, p } = setup(),
      before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home', ...options }));
    assert.equal(JSON.stringify(w), before);
  }
});
test('collision and construction reject overlap with an architectural wing after rotation', () => {
  const { w } = setup();
  const b = {
    ...makeBuilding('wing', 'warehouse', 0, 0),
    architecture: 'model-2',
    size: 'large' as const,
    rotation: Math.PI / 2,
  };
  const wing = buildingPlan(b).volumes[1],
    x = wing.z,
    z = -wing.x;
  assert.ok(blocksBuilding(b, x, z, 0, 0));
  w.buildings = [b];
  const candidate = { ...makeBuilding('other', 'home', x, z), architecture: 'model-1' };
  assert.match(constructionSiteReason(w, candidate) ?? '', /footprint/);
});
test('shoreline models remain within the validated dry pump house footprint', () => {
  for (const a of buildingArchitectures('waterworks')) {
    const bounds = buildingBounds(
      buildingPlan({ id: 'p', kind: 'waterworks', architecture: a.id }),
    );
    assert.ok(bounds.minX >= -4 && bounds.maxX <= 4 && bounds.minZ >= -3 && bounds.maxZ <= 3);
  }
});

test('industrial equipment and civic features fit their shared collision volumes', () => {
  for (const kind of [
    'refinery',
    'brewery',
    'mine',
    'rareMine',
    'town',
    'shipyard',
    'sawmill',
    'farm',
    'forge',
    'brickworks',
  ]) {
    for (const architecture of buildingArchitectures(kind)) {
      const b = {
        ...makeBuilding('identity', kind, 0, 0),
        architecture: architecture.id,
        style: 'metal-panel',
      };
      const plan = buildingPlan(b),
        root = buildingModel(b, (m) => m);
      assert.ok(plan.features?.length, kind);
      root.updateMatrixWorld(true);
      const groups: T.Object3D[] = [];
      root.traverse((o) => {
        if (o.userData.feature) groups.push(o);
      });
      assert.equal(groups.length, plan.features!.length);
      for (const [index, g] of groups.entries()) {
        const feature = plan.features![index],
          bounds = new T.Box3().setFromObject(g, true);
        assert.ok(
          bounds.min.x >= feature.x - feature.width / 2 - 0.1 &&
            bounds.max.x <= feature.x + feature.width / 2 + 0.1,
          kind + ' width',
        );
        assert.ok(
          bounds.min.z >= feature.z - feature.depth / 2 - 0.1 &&
            bounds.max.z <= feature.z + feature.depth / 2 + 0.1,
          kind + ' depth',
        );
        assert.ok(bounds.max.y <= feature.y + feature.height + 0.1, kind + ' height');
        assert.ok(blocksBuilding(b, feature.x, feature.z, feature.y + 0.2, 0));
      }
      release(root);
    }
  }
});

test('every completed cottage has one mailbox outside its frontmost wing, including legacy cottages', () => {
  for (const architecture of [undefined, ...buildingArchitectures('home').map((a) => a.id)]) {
    for (const style of buildingStyles('home', architecture)) {
      const b = { ...makeBuilding('home', 'home', 0, 0), style: style.id, architecture };
      const model = buildingModel(b, (m) => m),
        mailboxes: T.Object3D[] = [];
      model.traverse((o) => {
        if (o.userData.mailbox) mailboxes.push(o);
      });
      assert.equal(mailboxes.length, 1);
      assert.ok(
        mailboxes[0].position.z >
          Math.max(...buildingPlan(b).volumes.map((v) => v.z + v.depth / 2)),
      );
      assert.ok(!blocksBuilding(b, mailboxes[0].position.x, mailboxes[0].position.z, 0, 0));
      release(model);
    }
  }
});

test('shop signs clear the actual canopy and windows across models, sizes and finishes', () => {
  for (const kind of ['bakery', 'teaHouse', 'dairyKitchen', 'town', 'bank', 'school', 'garage'])
    for (const a of buildingArchitectures(kind))
      for (const size of sizesForBuilding(kind))
        for (const style of buildingStyles(kind, a.id)) {
          const b = {
            ...makeBuilding('qc', kind, 0, 0),
            architecture: a.id,
            size: size.id,
            style: style.id,
          };
          const root = buildingModel(b, (m) => m);
          root.updateMatrixWorld(true);
          const signs: T.Object3D[] = [],
            awnings: T.Object3D[] = [],
            windows: T.Object3D[] = [];
          root.traverse((o) => {
            if (o.userData.tradeSign) signs.push(o);
            if (o.userData.awning) awnings.push(o);
            if (o.userData.facadeWindow) windows.push(o);
          });
          assert.equal(signs.length, 1, `${kind} ${a.id}`);
          const sign = new T.Box3().setFromObject(signs[0], true);
          for (const canopy of awnings)
            assert.ok(
              !sign.intersectsBox(new T.Box3().setFromObject(canopy, true)),
              `${kind} ${a.id}: canopy clips sign`,
            );
          for (const pane of windows) {
            if (
              Math.abs(pane.rotation.y) > 0.01 ||
              Math.abs(pane.position.z - signs[0].position.z) > 0.2
            )
              continue;
            const bounds = new T.Box3().setFromObject(pane, true);
            assert.ok(
              sign.max.x <= bounds.min.x ||
                sign.min.x >= bounds.max.x ||
                sign.max.y <= bounds.min.y ||
                sign.min.y >= bounds.max.y,
              `${kind} ${a.id}: sign covers a window`,
            );
          }
          release(root);
        }
});

test('council clock shafts penetrate the roof and two-storey cottages have upstairs windows', () => {
  for (const a of buildingArchitectures('town')) {
    const b = {
      ...makeBuilding('clock', 'town', 0, 0),
      architecture: a.id,
      style: 'brick-workshop',
    };
    const plan = buildingPlan(b),
      root = buildingModel(b, (m) => m);
    let tower: T.Object3D | undefined;
    root.traverse((o) => {
      if (o.userData.feature === 'clocktower') tower = o;
    });
    const bounds = new T.Box3().setFromObject(tower!, true),
      v = plan.volumes[0];
    assert.ok(bounds.min.y <= v.eaves + 0.01);
    assert.ok(bounds.max.y > v.eaves + v.rise + 3);
    release(root);
  }
  const root = buildingModel(
    {
      ...makeBuilding('upstairs', 'home', 0, 0),
      architecture: 'model-4',
      style: 'white-clapboard',
    },
    (m) => m,
  );
  let upstairs = 0;
  root.traverse((o) => {
    if (o.userData.facadeWindow && o.position.y > 3) upstairs++;
  });
  assert.ok(upstairs >= 4, 'upper floor must not be windowless');
  release(root);
});

test('livestock shelters stay low and industries no longer share a universal five-plan template', () => {
  for (const kind of ['piggery', 'henhouse', 'sheepfold'])
    for (const a of buildingArchitectures(kind)) {
      const plan = buildingPlan({ kind, id: 'low', architecture: a.id });
      assert.ok(
        plan.volumes.every((v) => v.eaves <= 3.3),
        kind + ' should not put animals upstairs',
      );
    }
  const signatures = new Set<string>();
  for (const kind of [
    'bakery',
    'brewery',
    'bank',
    'town',
    'refinery',
    'quarry',
    'farm',
    'school',
    'henhouse',
    'warehouse',
  ]) {
    const shapes = buildingArchitectures(kind).map((a) => {
      const vs = buildingPlan({ kind, id: 'diversity', architecture: a.id }).volumes;
      const main = vs[0];
      return vs.map((v) => [
        v.roof,
        +(v.width / main.width).toFixed(3),
        +(v.depth / main.width).toFixed(3),
        +(v.eaves / main.width).toFixed(3),
        v.x / main.width,
        v.z / main.width,
      ]);
    });
    signatures.add(JSON.stringify(shapes));
  }
  assert.equal(signatures.size, 10);
});

test('crosswise containers keep the locking doors on their short ends', () => {
  const b = {
    ...makeBuilding('depot', 'pickup', 0, 0),
    architecture: 'model-5',
    style: 'ocean-blue',
  };
  const root = buildingModel(b, (m) => m);
  let backPlate: T.Object3D | undefined;
  root.traverse((o) => {
    if (o.userData.containerPlate && o.parent!.position.z < -4) backPlate = o;
  });
  assert.ok(backPlate);
  const direction = backPlate!.getWorldDirection(new T.Vector3());
  assert.ok(direction.x > 0.99 && Math.abs(direction.z) < 0.01);
  release(root);
});

test('spaceport hangars have freight-sized doors instead of shop doors', () => {
  for (const a of buildingArchitectures('starport')) {
    const root = buildingModel(
      { ...makeBuilding('hangars', 'starport', 0, 0), architecture: a.id },
      (m) => m,
    );
    let freightDoors = 0;
    root.traverse((o) => {
      if (!o.userData.loadingDoor) return;
      const size = new T.Box3().setFromObject(o, true).getSize(new T.Vector3());
      if (size.x >= 12 && size.y >= 7) freightDoors++;
    });
    assert.ok(freightDoors >= 1, a.name + ' needs access for cargo');
    release(root);
  }
});
