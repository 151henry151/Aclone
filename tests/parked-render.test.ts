// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { TrailerScene } from '../src/client/trailer-scene';
import { buildingModel } from '../src/client/buildings';
function setup() {
  const w = createWorld('render', 'Render', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'off' });
  Object.assign(p, { x: 0, z: 0, y: 0, speed: 0, fuel: 31, fuelVehicle: 0 });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  return { w, p };
}
test('parked rendering uses existing models without drivers, lamps or engines and retires boarded records', async () => {
  const module = await import('../src/client/parked-vehicle-scene');
  const { w, p } = setup();
  let builds = 0;
  const scene = new (module as any).ParkedVehicleScene((slot: number, name: string) => {
    builds++;
    const g = new T.Group(),
      driver = new T.Group(),
      lamp = new T.PointLight();
    g.add(driver, lamp);
    g.userData.driver = driver;
    g.userData.engineRunning = true;
    g.userData.name = name;
    return g;
  });
  scene.update(w, 0, 0, 500);
  assert.equal(scene.group.children.length, 1);
  const model = scene.group.children[0];
  assert.equal(model.userData.driver.visible, false);
  assert.equal(model.userData.engineRunning, false);
  model.traverse((o: any) => {
    if (o.isLight) assert.equal(o.visible, false);
  });
  assert.match(model.userData.name, /Owner.*tractor/i);
  scene.update(w, 0, 0, 500);
  assert.equal(builds, 1);
  scene.update(w, 1000, 1000, 500);
  assert.equal(model.visible, false);
  act(w, p.id, { type: 'vehicle', slot: 0 });
  scene.update(w, 0, 0, 500);
  assert.equal(scene.group.children.length, 0);
});
test('parked trailer render stays at its hitch instead of tracking the walking player mesh', () => {
  const { w, p } = setup();
  w.trailers = {
    box: {
      id: 'box',
      owner: p.id,
      kind: 'box',
      x: 0,
      z: -7,
      heading: 0,
      cargo: {},
      attached: p.id,
      parkedWith: 'owner:0',
    },
  };
  const player = new T.Group();
  player.position.set(50, 0, 50);
  const scene = new TrailerScene();
  scene.update(w, new Map([[p.id, player]]), () => 0, 1);
  const model = scene.group.children[0];
  assert.equal(model.position.x, 0);
  assert.equal(model.position.z, -7);
});
test('pedestrian doors provide real hinge pivots for arrival animation', () => {
  const b = makeBuilding('home', 'home', 0, 0);
  const g = buildingModel(b, (m) => m);
  const doors: T.Object3D[] = [];
  g.traverse((o) => {
    if (o.userData.doorPivot) doors.push(o);
  });
  assert.ok(doors.length > 0, 'house door must swing around an actual hinge');
  for (const door of doors) assert.ok(door.children.length > 0);
});

test('darkening parked lamps never changes materials used by a driven vehicle', async () => {
  const { ParkedVehicleScene } = await import('../src/client/parked-vehicle-scene');
  const { w } = setup();
  const lamp = new T.MeshStandardMaterial({ emissive: 'white', emissiveIntensity: 0.6 });
  lamp.userData.shared = true;
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    g.add(new T.Mesh(new T.BoxGeometry(), lamp));
    return g;
  });
  scene.update(w, 0, 0, 500);
  assert.equal(lamp.emissiveIntensity, 0.6);
  const parked = (scene.group.children[0].children[0] as T.Mesh).material as T.MeshStandardMaterial;
  assert.notEqual(parked, lamp);
  assert.equal(parked.emissiveIntensity, 0);
});

test('pedestrian door pivots survive scenery batching and rotate to the configured arrival angle', async () => {
  const { batchStaticScenery, freezeScenery } = await import('../src/client/static-scene');
  const arrival = await import('../src/client/arrival-animation');
  const { w, p } = setup(),
    b = makeBuilding('home', 'home', 0, 0),
    g = buildingModel(b, (m) => m);
  batchStaticScenery(g);
  freezeScenery(g, []);
  const doors = g.userData.pedestrianDoors as T.Group[];
  assert.ok(doors.every((d) => d.children.length > 0 && d.matrixAutoUpdate));
  Object.assign(w.settings, { arrivalDoorDegrees: 110 });
  p.task = {
    kind: 'entering',
    building: b.id,
    end: 2,
    arrival: {
      building: b.id,
      start: 0,
      end: 2,
      from: { x: 0, y: 0, z: 5 },
      to: { x: 0, y: 0, z: 3 },
    },
  };
  (arrival as any).animateArrivalDoors(g, w, b, 1);
  assert.ok(doors.some((d) => Math.abs(Math.abs(d.rotation.y) - (110 * Math.PI) / 180) < 0.001));
  delete p.task;
  (arrival as any).animateArrivalDoors(g, w, b, 3);
  assert.ok(doors.every((d) => d.rotation.y === 0));
});

test('parked nameplates keep a fixed screen size when the camera approaches', async () => {
  const { ParkedVehicleScene } = await import('../src/client/parked-vehicle-scene');
  const { w } = setup();
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    const tag = new T.Sprite(new T.SpriteMaterial());
    tag.scale.set(6, 2, 1);
    g.add(tag);
    return g;
  });
  scene.update(w, 0, 0, 500);
  const tag = scene.group.children[0].children[0] as T.Sprite;
  assert.equal(tag.material.sizeAttenuation, false);
  assert.ok(tag.scale.x <= 0.3);
});

test('mount animation walks from the door to the actual model seat, fades the driver, and restores materials', async () => {
  const { VehicleMountScene } = await import('../src/client/vehicle-mount-animation');
  const { w, p } = setup();
  p.vehicle = 0;
  delete w.parkedVehicles!['owner:0'];
  p.task = {
    kind: 'mounting',
    end: 1.6,
    mount: {
      slot: 0,
      mounting: true,
      start: 0,
      end: 1.6,
      vehicle: { x: 0, y: 0, z: 0, heading: 0 },
      door: { x: -1.4, y: 0, z: 0 },
    },
  };
  const model = new T.Group(),
    driver = new T.Group(),
    material = new T.MeshStandardMaterial();
  driver.position.set(0, 1.7, -0.8);
  driver.add(new T.Mesh(new T.BoxGeometry(), material));
  model.add(driver);
  model.userData.driver = driver;
  const scene = new VehicleMountScene();
  const meshes = new Map([[p.id, model]]);
  scene.update(w, 0, meshes, new T.Group(), 0.016);
  assert.equal(scene.group.children.length, 1);
  assert.ok(Math.abs(scene.group.children[0].position.x + 1.4) < 0.01);
  assert.equal(driver.visible, false);
  scene.update(w, 1.4, meshes, new T.Group(), 0.016);
  assert.ok(scene.group.children[0].position.y > 1);
  assert.equal(driver.visible, true);
  const climber = scene.group.children[0];
  climber.updateWorldMatrix(true, true);
  const hips = climber.getObjectByName('hips')!;
  assert.ok(
    hips.position.y < 0.1,
    'finish sitting at the seat anchor, without standing through the roof',
  );
  assert.ok(
    climber.getObjectByName('thigh-1')!.rotation.x < -1,
    'both legs settle into the seated pose',
  );
  assert.equal(material.opacity, 1);
  delete p.task;
  scene.update(w, 2, meshes, new T.Group(), 0.016);
  assert.equal(scene.group.children.length, 0);
  assert.equal((driver.children[0] as T.Mesh).material, material);
});

test('garage interior displays the owner’s actual stored model and updates when it is retrieved', async (t) => {
  const previous = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: () => ({
      width: 512,
      height: 128,
      getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {}, width: 20 }) }),
    }),
  };
  t.after(() => {
    (globalThis as any).document = previous;
  });
  const { populateInteriorModels, refreshInteriorDisplay } =
    await import('../src/client/interior-props');
  const { w, p } = setup();
  const b = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [b];
  const v = w.parkedVehicles!['owner:0'];
  v.inside = b.id;
  v.slot = 24;
  v.paint = 'plum';
  delete w.parkedVehicles!['owner:0'];
  w.parkedVehicles!['owner:24'] = v;
  const root = buildingModel(b, (m) => m),
    rig = root.userData.interiors[0];
  populateInteriorModels(rig, b, w, p);
  refreshInteriorDisplay(rig, b, w, p);
  assert.equal(rig.principal.getObjectByName('tractor')?.userData.vehicleSlot, 24);
  assert.equal(rig.principal.getObjectByName('tractor')?.userData.parkedVehicle, 'owner:24');
  delete w.parkedVehicles!['owner:24'];
  refreshInteriorDisplay(rig, b, w, p);
  assert.equal(rig.principal.getObjectByName('tractor')?.userData.parkedVehicle, undefined);
});

test('industrial approaches target a real bay or pedestrian door and light occupied rooms after hours', async () => {
  const { buildingEntry } = await import('../src/shared/parking-site');
  const { animateArrivalDoors } = await import('../src/client/arrival-animation');
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { buildingDoorActivity } = await import('../src/shared/building-doors');
  const { TownLighting } = await import('../src/client/lighting');
  const { w, p } = setup();
  w.settings.buildingDoorMode = 'closed';
  w.settings.time = 0;
  const b = makeBuilding('garage', 'garage', 10, 10);
  w.buildings = [b];
  const root = buildingModel(b, (m) => m),
    entry = buildingEntry(b);
  const openings = [
    ...(root.userData.pedestrianDoors ?? []).map((d: T.Group) => d.userData.doorPivot),
    ...root.userData.interiors.flatMap((r: any) => r.doors.map((d: any) => d.bay)),
  ];
  assert.ok(
    openings.some((q: any) => Math.hypot(entry.x - b.x - q.x, entry.z - b.z - q.z) < 0.2),
    'arrival must target an aperture, not the solid wall between bays',
  );
  p.task = {
    kind: 'entering',
    end: 4,
    arrival: {
      building: b.id,
      start: 0,
      end: 4,
      from: { x: 0, y: 0, z: 10 },
      to: { ...entry, y: 0 },
    },
  };
  animateArrivalDoors(root, w, b, 1);
  animateBuildingDoors(root, w, b, 1, 0);
  assert.ok(root.userData.interiors.some((r: any) => r.doors.some((d: any) => d.openness > 0.9)));
  delete p.task;
  p.inside = b.id;
  assert.equal(buildingDoorActivity(w, b).inside, true);
  animateArrivalDoors(root, w, b, 5);
  animateBuildingDoors(root, w, b, 10, 0);
  assert.ok(root.userData.interiors.some((r: any) => r.group.visible));
  const lighting = new TownLighting(2);
  lighting.reset(root);
  lighting.update(w, new T.Vector3());
  const lamps: T.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh && o.userData.interiorLight) lamps.push(o);
  });
  assert.ok(lamps.some((l) => (l.material as T.MeshStandardMaterial).emissiveIntensity > 0));
});

test('a trailer stored with its tractor is hidden outside until the rig drives out', () => {
  const { w, p } = setup();
  const v = w.parkedVehicles!['owner:0'];
  v.inside = 'garage';
  w.trailers = {
    box: {
      id: 'box',
      kind: 'box',
      owner: p.id,
      x: 0,
      z: -7,
      heading: 0,
      cargo: { wood: 2 },
      attached: p.id,
      parkedWith: 'owner:0',
    },
  };
  const scene = new TrailerScene();
  scene.update(w, new Map(), () => 0, 1);
  assert.equal(scene.group.children.length, 0);
  delete v.inside;
  scene.update(w, new Map(), () => 0, 1);
  assert.equal(scene.group.children.length, 1);
});

test('an open pedestrian door reveals a recessed opening instead of the solid facade', () => {
  const b = makeBuilding('home', 'home', 0, 0);
  const model = buildingModel(b, (m) => m);
  const hinge = model.userData.pedestrianDoors[0] as T.Group;
  hinge.rotation.y = -Math.PI / 2;
  model.updateMatrixWorld(true);
  const { x, z } = hinge.userData.doorPivot;
  const ray = new T.Raycaster(new T.Vector3(x, 1, z + 0.2), new T.Vector3(0, 0, -1));
  const hits = ray.intersectObject(model, true);
  assert.ok(
    hits.length && hits[0].distance > 0.4,
    'the entry must be recessed behind the wall face',
  );
  ray.set(new T.Vector3(x + 1, 1, z + 0.2), new T.Vector3(0, 0, -1));
  assert.ok(
    ray.intersectObject(model, true)[0].distance < 0.3,
    'retain solid wall beside the doorway',
  );
});

test('parked machines retain creator-assigned vehicle models', async () => {
  const { ParkedVehicleScene } = await import('../src/client/parked-vehicle-scene');
  const { creatorSchema } = await import('../src/shared/creator');
  const { w } = setup();
  w.creator = creatorSchema.parse({
    models: [
      {
        id: 'custom-tractor',
        name: 'Custom tractor',
        parts: [{ shape: 'box', x: 0, y: 2, z: 0, sx: 3, sy: 4, sz: 5, yaw: 0, color: '#123456' }],
      },
    ],
    vehicleModels: { '0': 'custom-tractor' },
  });
  let fallback = 0;
  const scene = new ParkedVehicleScene(() => {
    fallback++;
    return new T.Group();
  });
  scene.update(w, 0, 0, 500);
  assert.equal(
    fallback,
    0,
    'parking must not replace a world-builder model with the stock tractor',
  );
  assert.equal(scene.group.children[0].userData.creatorModel, true);
  const bounds = new T.Box3().setFromObject(scene.group.children[0]);
  assert.equal(bounds.getSize(new T.Vector3()).y, 4);
});

test('a parked wheeled vehicle rests on the same sloping ground as its driven model', async () => {
  const { ParkedVehicleScene } = await import('../src/client/parked-vehicle-scene');
  const { w } = setup();
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    g.userData.contacts = [-1, 1].flatMap((x) => [-2, 2].map((z) => new T.Vector3(x, 0, z)));
    return g;
  });
  const ground = (x: number, z: number) => x * 0.1 + z * 0.2;
  (scene.update as any)(w, 0, 0, 500, ground);
  const model = scene.group.children[0];
  model.updateMatrixWorld(true);
  assert.ok(Math.abs(model.rotation.x) > 0.1, 'retain wheelbase pitch after parking');
  assert.ok(Math.abs(model.rotation.z) > 0.05, 'retain cross-slope roll after parking');
  for (const c of model.userData.contacts as T.Vector3[]) {
    const p = c.clone().applyMatrix4(model.matrixWorld);
    assert.ok(Math.abs(p.y - ground(p.x, p.z)) < 0.03, 'all tyre contacts remain on the plane');
  }
});

test('nearby building labels cannot fill the held arrival camera view', async () => {
  const { capWorldLabel } = (await import('../src/client/labels')) as any;
  const tag = new T.Sprite(new T.SpriteMaterial());
  tag.scale.set(9.75, 1.82, 1);
  const camera = new T.PerspectiveCamera(55, 1.6, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.updateMatrixWorld();
  capWorldLabel(tag, camera);
  assert.equal(tag.scale.y, 1.82, 'retain ordinary distant signage');
  const { freezeScenery } = await import('../src/client/static-scene');
  const root = new T.Group();
  root.add(tag);
  freezeScenery(root, []);
  camera.position.z = 2;
  camera.updateMatrixWorld();
  capWorldLabel(tag, camera);
  assert.ok(
    tag.getWorldScale(new T.Vector3()).y / (4 * Math.tan((55 * Math.PI) / 360)) <= 0.036,
    'cap the near label height in the viewport',
  );
  camera.position.z = 100;
  camera.updateMatrixWorld();
  capWorldLabel(tag, camera);
  assert.equal(tag.scale.y, 1.82, 'restore normal scale when moving away');
});

test('walking chase camera clears a parked hull without losing view of the pedestrian', async () => {
  const { ParkedVehicleScene } = await import('../src/client/parked-vehicle-scene');
  const { w } = setup();
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(3, 3, 5), new T.MeshStandardMaterial());
    body.position.y = 1.5;
    g.add(body);
    return g;
  });
  scene.update(w, 0, -4, 500);
  const camera = new T.PerspectiveCamera(55, 1.6, 0.1, 1000);
  const target = new T.Vector3(0, 1.25, -4);
  camera.position.set(0, 2.5, 4);
  (scene as any).clearCamera(target, camera);
  const sight = new T.Ray(target, camera.position.clone().sub(target).normalize());
  const hit = sight.intersectBox(
    new T.Box3(new T.Vector3(-1.5, 0, -2.5), new T.Vector3(1.5, 3, 2.5)),
    new T.Vector3(),
  );
  assert.ok(
    !hit || hit.distanceTo(target) > camera.position.distanceTo(target),
    'keep the entire sightline clear of the parked hull',
  );
  assert.ok(
    camera.position.distanceTo(target) >= 8,
    'retain chase distance so the pedestrian and mounting remain visible',
  );
  target.z = -2.51;
  camera.position.set(0, 2.5, 4);
  (scene as any).clearCamera(target, camera);
  assert.ok(camera.position.y < 8, 'near-zero door clearance must not launch the camera overhead');
  assert.ok(camera.position.distanceTo(target) >= 6, 'retain a useful chase view at the hull edge');
  target.z = -4;
  camera.position.set(0, 2.5, -8);
  const clear = camera.position.clone();
  (scene as any).clearCamera(target, camera);
  assert.deepEqual(camera.position, clear, 'do not disturb an unobstructed chase view');
  scene.update(w, 1000, 1000, 1);
  camera.position.set(0, 2.5, 4);
  (scene as any).clearCamera(target, camera);
  assert.equal(camera.position.z, 4, 'hidden models cannot obstruct the camera');
});
