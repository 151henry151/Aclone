// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildingPlan,
  buildingBounds,
  blocksBuilding,
  buildingBlocksMovement,
  spaceportApron,
  spaceportHardware,
} from '../src/shared/building-shapes.ts';
import { buildings } from '../src/shared/catalog.ts';

test('building catalogue uses human-sized entrances and varied bounded silhouettes', () => {
  const shapes = new Set<string>();
  for (const kind of Object.keys(buildings)) {
    const plan = buildingPlan({ kind, id: 'b1' });
    const bounds = buildingBounds(plan);
    assert.ok(bounds.width > 0 && bounds.width <= (kind === 'starport' ? 34 : 15));
    assert.ok(bounds.depth > 0 && bounds.depth <= (kind === 'starport' ? 24 : 15));
    assert.ok(bounds.height > 0 && bounds.height <= (kind === 'starport' ? 33 : 12));
    shapes.add(JSON.stringify(plan.volumes));
    assert.equal(plan.doorHeight, 2.1);
  }
  assert.ok(shapes.size >= 12);
  assert.ok(buildingBounds(buildingPlan({ kind: 'home', id: 'b1' })).height < 5.5);
  assert.ok(buildingBounds(buildingPlan({ kind: 'pub', id: 'b1' })).height > 6);
  assert.deepEqual(
    buildingPlan({ kind: 'home', id: 'same' }),
    buildingPlan({ kind: 'home', id: 'same' }),
  );
});
test('spaceport rocket is solid, its apron is walkable, and the terminal entrance stays clear', () => {
  const b = { id: 'port', kind: 'starport', x: 0, z: 0, rotation: 0 };
  assert.equal(blocksBuilding(b, spaceportApron.x, spaceportApron.z, 0, 0.25), true);
  assert.equal(blocksBuilding(b, spaceportApron.x - 7, spaceportApron.z, 0, 0.25), false);
  assert.equal(blocksBuilding(b, 0, 5, 0, 0.25), false);
  assert.equal(blocksBuilding(b, spaceportApron.x, spaceportApron.z, 33, 0.25), false);
  const { tower, tank } = spaceportHardware;
  assert.equal(blocksBuilding(b, tower.x, tower.z, 20, 0.25), true);
  assert.equal(blocksBuilding(b, tower.x, tower.z, 28, 0.25), false);
  assert.equal(blocksBuilding(b, tank.x, tank.z, 2, 0.25), true);
  assert.equal(blocksBuilding(b, tank.x, tank.z, 6, 0.25), false);
  assert.equal(buildingBlocksMovement(b, { x: -14, z: -5 }, { x: -13.8, z: -5 }, 0, 1), false);
  assert.equal(buildingBlocksMovement(b, { x: -14, z: -5 }, { x: -14.2, z: -5 }, 0, 1), true);
  b.rotation = Math.PI / 2;
  assert.equal(blocksBuilding(b, spaceportApron.z, -spaceportApron.x, 0, 0.25), true);
  const bounds = buildingBounds(buildingPlan(b));
  assert.ok(bounds.minX <= spaceportApron.x - spaceportApron.radius);
});
test('collision follows rotated walls, wings and building height rather than a fixed circle', () => {
  const b = { id: 'b1', kind: 'garage', x: 10, z: 20, rotation: Math.PI / 2 };
  assert.equal(blocksBuilding(b, 10, 25, 0, 0.25), true);
  assert.equal(blocksBuilding(b, 15, 20, 0, 0.25), false);
  assert.equal(blocksBuilding(b, 10, 20, 20, 0.25), false);
  const cottage = { ...b, kind: 'home', rotation: 0 };
  assert.equal(blocksBuilding(cottage, 14.9, 20, 0, 0.25), false);
});

test('every rendered building has finite geometry and fits its planned footprint', async () => {
  const T = await import('three');
  const { buildingModel } = await import('../src/client/buildings.ts');
  const { makeBuilding } = await import('../src/shared/simulation.ts');
  for (const kind of Object.keys(buildings).filter((k) => k !== 'town')) {
    for (const construction of [false, true]) {
      const b = makeBuilding('b1', kind, 0, 0);
      if (construction) b.construction = { wood: 10 };
      const model = buildingModel(b, (mesh) => mesh);
      const bounds = new T.Box3().setFromObject(model);
      const plan = buildingBounds(buildingPlan(b));
      assert.ok(bounds.min.y >= -0.05, `${kind}: below ground`);
      assert.ok(bounds.max.y < (kind === 'starport' ? 33 : 12), `${kind}: height`);
      assert.ok(bounds.max.x - bounds.min.x <= plan.width + 2, `${kind}: width`);
      assert.ok(bounds.max.z - bounds.min.z <= plan.depth + 4, `${kind}: depth`);
      model.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        for (const attr of Object.values((o.geometry as import('three').BufferGeometry).attributes))
          assert.ok(Array.from(attr.array).every(Number.isFinite), `${kind}: non-finite geometry`);
      });
    }
  }
});

test('a saved pilot inside an enlarged footprint can leave but cannot drive deeper into it', () => {
  const b = { id: 'b1', kind: 'garage', x: 0, z: 0, rotation: 0 };
  assert.equal(buildingBlocksMovement(b, { x: 6, z: 0 }, { x: 6.1, z: 0 }, 0, 1), false);
  assert.equal(buildingBlocksMovement(b, { x: 6, z: 0 }, { x: 5.9, z: 0 }, 0, 1), true);
  assert.equal(buildingBlocksMovement(b, { x: 7, z: 0 }, { x: 6.6, z: 0 }, 0, 1), true);
});

test('compact tractor keeps an adult driver at full size with headroom under the roof', async () => {
  const T = await import('three');
  const { tractor } = await import('../src/client/tractor.ts');
  const { createHuman } = await import('../src/client/human.ts');
  const group = new T.Group();
  tractor(group, '#ab3028', () => new T.Mesh(new T.PlaneGeometry(0, 0), new T.MeshBasicMaterial()));
  const bounds = new T.Box3().setFromObject(group);
  const driver = group.userData.driver as import('three').Group;
  const driverBounds = new T.Box3().setFromObject(driver);
  const humanBounds = new T.Box3().setFromObject(createHuman('seated').group);
  assert.ok(bounds.max.y < 2.9 && bounds.max.y > 2.7);
  assert.ok(bounds.max.x - bounds.min.x < 2.7);
  assert.ok(
    Math.abs(driverBounds.getSize(new T.Vector3()).y - humanBounds.getSize(new T.Vector3()).y) <
      0.0001,
  );
  assert.ok(driverBounds.max.y < 2.72, 'head below the cab ceiling');
  assert.ok(driverBounds.min.y > 0.8, 'boots above the chassis');
});

test('industrial spacecraft dwarfs a tractor while keeping human-sized access and bounded detail', async () => {
  const T = await import('three');
  const { spaceportModel } = await import('../src/client/spaceport.ts');
  const model = spaceportModel();
  const rocket = model.getObjectByName('Cargo rocket')!;
  assert.ok(rocket, 'separate full-scale spacecraft');
  const bounds = new T.Box3().setFromObject(rocket);
  assert.ok(bounds.max.y >= 31 && bounds.max.y <= 33, 'about eleven tractor heights');
  assert.ok(bounds.getSize(new T.Vector3()).x >= 8, 'wide landing supports');
  const hatch = rocket.getObjectByName('Crew access hatch')!;
  assert.ok(hatch);
  const door = new T.Box3().setFromObject(hatch).getSize(new T.Vector3());
  assert.ok(door.y >= 1.8 && door.y <= 2.2, 'access equipment stays human scale');
  let triangles = 0;
  const materials = new Set<import('three').Material>();
  model.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const geometry = o.geometry as import('three').BufferGeometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    const material = o.material as import('three').Material;
    assert.equal(material.transparent, false, 'all surfaces can join scenery batches');
    materials.add(material);
  });
  assert.ok(triangles < 45000, `static triangle budget: ${triangles}`);
  assert.ok(materials.size <= 12, 'small shared material palette');
});
