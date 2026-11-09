// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createTrailer } from '../src/client/trailer-model';
import { createWorld } from '../src/shared/simulation';
import { automotiveConfig } from '../src/shared/automotive-config';
import { vehicleDef } from '../src/shared/vehicle-config';

function budget(model: T.Group, maxTriangles: number, maxMeshes: number) {
  let triangles = 0,
    meshes = 0;
  model.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    }
  });
  assert.ok(triangles <= maxTriangles, `${triangles} triangles`);
  assert.ok(meshes <= maxMeshes, `${meshes} meshes`);
}
test('full-size semitrailers have distinct bodies, a kingpin, rear bogie, landing legs and restrained timber', () => {
  for (const kind of ['semiBox', 'semiRefrigerated', 'semiStake'] as const) {
    const g = createTrailer(kind, kind === 'semiStake' ? { logs: 500 } : {});
    const bounds = new T.Box3().setFromObject(g);
    assert.ok(bounds.max.y >= 3.95 && bounds.max.y <= 4.1, `${kind} height ${bounds.max.y}`);
    assert.ok(bounds.max.z - bounds.min.z >= 13.5 && bounds.max.z - bounds.min.z < 14);
    assert.equal(g.userData.wheels.length, 6);
    assert.ok(g.getObjectByName('kingpin'));
    assert.ok(g.getObjectByName('landing-legs'));
    if (kind === 'semiRefrigerated') assert.ok(g.getObjectByName('refrigeration-unit'));
    if (kind === 'semiStake') {
      assert.ok(g.getObjectByName('timber-load'));
      assert.ok(g.getObjectByName('load-restraints'));
    }
    budget(g, 6000, 32);
  }
});
test('highway cab and chassis use truck dimensions, real wheelbase and lightweight detailed assemblies', async () => {
  const { createHighwayTractor } = await import('../src/client/highway-model');
  const w = createWorld('truck-model', 'Truck', 'owner');
  const g = createHighwayTractor(w),
    bounds = new T.Box3().setFromObject(g);
  assert.ok(bounds.max.z - bounds.min.z >= 6.3 && bounds.max.z - bounds.min.z <= 6.6);
  assert.ok(bounds.max.y > 3.4 && bounds.max.y < 4);
  assert.equal(g.userData.wheels.length, 6);
  assert.ok(g.getObjectByName('fifth-wheel'));
  assert.ok(g.getObjectByName('cab-interior'));
  assert.ok(g.getObjectByName('mirrors'));
  assert.ok(g.userData.eye.z > 1 && g.userData.eye.y > 2.5);
  assert.equal(g.userData.contacts[1].z - g.userData.contacts[0].z, vehicleDef(w, 37).wheelbase);
  budget(g, 12000, 48);
});
test('semitrailer rendering follows customized world geometry', () => {
  const w = createWorld('truck-custom-model', 'Truck', 'owner');
  w.automotive = structuredClone(automotiveConfig(w));
  w.automotive.semitrailers.box = {
    ...w.automotive.semitrailers.box,
    length: 16,
    width: 3.2,
    height: 4.5,
  };
  const g = createTrailer('semiBox', {}, w),
    b = new T.Box3().setFromObject(g);
  assert.ok(Math.abs(b.max.z - b.min.z - 16) < 0.1);
  assert.ok(Math.abs(b.max.y - 4.5) < 0.05);
  assert.ok(Math.abs(b.max.x - b.min.x - 3.2) < 0.1);
});

test('financial rule changes do not rebuild existing semitrailer geometry', async () => {
  const { TrailerScene } = await import('../src/client/trailer-scene');
  const w = createWorld('truck-cache', 'Truck', 'owner');
  w.trailers = {
    t: { id: 't', owner: 'owner', kind: 'semiBox', x: 0, z: 0, heading: 0, cargo: {} },
  };
  const scene = new TrailerScene();
  scene.update(w, new Map(), () => 0, 0.05);
  const model = scene.group.children[0];
  w.automotive = structuredClone(automotiveConfig(w));
  w.automotive.products.box.price += 100;
  scene.update(w, new Map(), () => 0, 0.05);
  assert.ok(scene.group.children[0] === model, 'Prices must preserve the existing model');
  w.automotive.semitrailers.box.length = 15;
  scene.update(w, new Map(), () => 0, 0.05);
  assert.ok(scene.group.children[0] !== model, 'Changed dimensions must rebuild the model');
});

test('the default forward cab view shows all three instruments above the lower chat panel', async () => {
  const { createHighwayTractor } = await import('../src/client/highway-model');
  const w = createWorld('cab-view', 'Cab', 'p'),
    g = createHighwayTractor(w),
    eye = g.userData.eye as T.Vector3;
  const needles = g.children.filter((c) =>
    c.children.some(
      (o) =>
        o instanceof T.Mesh &&
        o.geometry instanceof T.BoxGeometry &&
        o.geometry.parameters.width === 0.008,
    ),
  );
  assert.equal(needles.length, 3);
  for (const n of needles) {
    const belowHorizon =
      (eye.y - n.position.y) / ((n.position.z - eye.z) * Math.tan((53 * Math.PI) / 360));
    assert.ok(
      belowHorizon > 0 && belowHorizon < 0.45,
      `Instrument falls below clear cab view: ${belowHorizon}`,
    );
  }
});

test('the dashboard does not bury the lower halves of its instrument faces', async () => {
  const { createHighwayTractor } = await import('../src/client/highway-model');
  const g = createHighwayTractor(createWorld('cab-gauges', 'Cab', 'p')),
    eye = g.userData.eye as T.Vector3;
  g.updateMatrixWorld(true);
  const needles = g.children.filter((c) =>
    c.children.some(
      (o) =>
        o instanceof T.Mesh &&
        o.geometry instanceof T.BoxGeometry &&
        o.geometry.parameters.width === 0.008,
    ),
  );
  for (const n of needles) {
    const target = n.position.clone().add(new T.Vector3(0, -0.065, 0)),
      ray = new T.Raycaster(eye, target.clone().sub(eye).normalize());
    const hits = ray.intersectObject(g.getObjectByName('cab-interior')!, true);
    assert.ok(
      !hits.some((hit) => hit.distance < eye.distanceTo(target) - 0.01),
      'Dashboard obscures the lower gauge face',
    );
  }
});

test('truck cab roof follows the same height used by collision without scaling the seated driver', async () => {
  const { createHighwayTractor } = await import('../src/client/highway-model');
  const w = createWorld('truck-height', 'Truck', 'owner');
  for (const height of [3.2, 3.75, 4.5]) {
    w.vehicleTuning = { 37: { height } };
    const g = createHighwayTractor(w);
    const bounds = new T.Box3().setFromObject(g);
    assert.ok(
      Math.abs(bounds.max.y - vehicleDef(w, 37).height!) < 0.01,
      `Roof ${bounds.max.y} does not match height ${height}`,
    );
    assert.equal(g.userData.driver.scale.y, 1);
  }
});

test('fifth-wheel world edits refresh parked trucks without rebuilding on a price edit', async () => {
  const { ParkedVehicleScene } = await import('../src/client/parked-vehicle-scene');
  const { createHighwayTractor } = await import('../src/client/highway-model');
  const w = createWorld('truck-fifth-cache', 'Truck', 'owner');
  w.parkedVehicles = {
    'owner:37': {
      owner: 'owner',
      slot: 37,
      x: 0,
      y: 20,
      z: 0,
      heading: 0,
      fuel: 0,
      condition: 100,
      parkedAt: 0,
    },
  } as any;
  const scene = new ParkedVehicleScene(() => createHighwayTractor(w));
  scene.update(w, 0, 0, 100);
  const first = scene.group.children[0];
  w.automotive = structuredClone(automotiveConfig(w));
  w.automotive.products.tractor.price++;
  scene.update(w, 0, 0, 100);
  assert.equal(scene.group.children[0], first);
  w.automotive.coupling.fifthWheelZ = -2;
  scene.update(w, 0, 0, 100);
  assert.notEqual(
    scene.group.children[0],
    first,
    'The parked fifth wheel must move with its physics rule',
  );
});

test('semitrailer support legs retract on coupling and wheel roll uses the actual tyre radius', async () => {
  const { TrailerScene } = await import('../src/client/trailer-scene');
  const w = createWorld('landing-legs', 'Legs', 'p');
  const t = {
    id: 'semi',
    owner: 'p',
    kind: 'semiBox' as const,
    x: 0,
    z: 0,
    heading: 0,
    cargo: {},
    attached: undefined as string | undefined,
  };
  w.trailers = { semi: t };
  const scene = new TrailerScene();
  scene.update(w, new Map(), () => 0, 0.05);
  const model = scene.group.children[0],
    legs = model.getObjectByName('landing-legs')!;
  const parkedBottom = new T.Box3().setFromObject(legs).min.y;
  t.attached = 'p';
  scene.update(w, new Map(), () => 0, 0.05);
  const coupledBottom = new T.Box3().setFromObject(legs).min.y;
  assert.ok(coupledBottom > parkedBottom + 0.4, 'Legs must clear the road when coupled');
  const wheel = model.userData.wheels[0] as T.Group,
    rotation = wheel.rotation.x,
    z = model.position.z;
  t.z = 1;
  scene.update(w, new Map(), () => 0, 0.05);
  assert.ok(
    Math.abs(wheel.rotation.x - rotation - (model.position.z - z) / wheel.userData.radius) < 1e-8,
  );
  delete t.attached;
  scene.update(w, new Map(), () => 0, 0.05);
  assert.ok(Math.abs(new T.Box3().setFromObject(legs).min.y - parkedBottom) < 1e-8);
});
