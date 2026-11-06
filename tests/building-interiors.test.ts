// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildingModel } from '../src/client/buildings';
import { makeBuilding } from '../src/shared/simulation';
import { batchStaticScenery, freezeScenery } from '../src/client/static-scene';
import { buildingArchitectures } from '../src/shared/building-architecture';
import { industrialKinds } from '../src/shared/building-facade';

test('workshop has real bay apertures, moving door leaves and a bounded furnished shell', () => {
  const b = makeBuilding('workshop', 'workshop', 0, 0);
  const model = buildingModel(b, (m) => m);
  const doors: T.Group[] = [],
    interiors: T.Group[] = [];
  model.traverse((o) => {
    if (o.userData.bayDoor) doors.push(o as T.Group);
    if (o.userData.interior) interiors.push(o as T.Group);
  });
  assert.ok(doors.length > 0, 'replace the static painted bay with moving leaves');
  assert.ok(interiors.length > 0, 'add a furnished interior behind the aperture');
  assert.ok(interiors.every((g) => g.children.length > 0));
});

test('each trade supplies its principal equipment and full-detail furnishings', () => {
  for (const [kind, required] of Object.entries({
    workshop: ['workbench', 'table-saw', 'clamp-rail', 'finished-furniture'],
    sawmill: ['log-carriage', 'saw', 'lumber', 'dust-duct'],
    brewery: ['copper-kettles', 'fermenters', 'keg-washer', 'grain-hopper'],
    warehouse: ['pallet-racks', 'forklift', 'packing-bench', 'roller-conveyor'],
    factory: ['machine-line', 'gantry', 'control-cabinet'],
    forge: ['hearth', 'anvil', 'bellows', 'quench-tub'],
    refinery: ['pump-hall', 'pipework', 'control-desk'],
    feedmill: ['grain-hopper', 'bagging-chute'],
    quarry: ['crusher', 'rock-pile', 'drill-steels'],
  })) {
    const b = makeBuilding('fixture-' + kind, kind, 0, 0);
    b.architecture = 'model-1';
    const model = buildingModel(b, (m) => m),
      names: string[] = [];
    model.traverse((o) => {
      if (o.userData.interiorProp) names.push(o.userData.interiorProp);
    });
    for (const name of required) assert.ok(names.includes(name), kind + ': missing ' + name);
  }
});

test('doors ease over five seconds, hide closed interiors, and gate distance, detail and sound', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('motion', 'Motion', 'owner'),
    b = makeBuilding('garage', 'garage', 0, 0),
    root = buildingModel(b, (m) => m);
  const r = (root.userData.interiors as any[])[0],
    sounds: string[] = [];
  const sound = (motion: string) => sounds.push(motion);
  Object.assign(w.settings, { buildingDoorMode: 'closed' });
  animateBuildingDoors(root, w, b, 0, 0, false, sound);
  assert.equal(r.group.visible, false);
  assert.equal(r.doors[0].panels.length, 6);
  w.settings.buildingDoorMode = 'open';
  animateBuildingDoors(root, w, b, 2.5, 0, false, sound);
  assert.equal(r.doors[0].openness, 0.5);
  assert.equal(r.group.visible, true);
  assert.equal(sounds.length, r.doors.length);
  animateBuildingDoors(root, w, b, 2.5, 0);
  assert.equal(r.doors[0].openness, 1);
  animateBuildingDoors(root, w, b, 0, 0, true);
  assert.equal(r.detail.visible, false);
  w.settings.buildingInteriorDetail = 'none';
  animateBuildingDoors(root, w, b, 0, 0);
  assert.equal(r.group.visible, false);
  w.settings.buildingDoorMode = 'closed';
  animateBuildingDoors(root, w, b, 0, 121, false, sound);
  assert.equal(r.doors[0].openness, 0);
  assert.equal(sounds.length, r.doors.length);
});

test('fresh previews close each aperture, while open leaves reveal a real furnished volume', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('aperture', 'Aperture', 'owner');
  w.settings.buildingDoorMode = 'open';
  for (const kind of ['garage', 'workshop', 'sawmill']) {
    const b = makeBuilding('door-' + kind, kind, 0, 0),
      root = buildingModel(b, (m) => m),
      rig = root.userData.interiors[0],
      d = rig.doors[0];
    root.updateMatrixWorld(true);
    const ray = new T.Raycaster(
      new T.Vector3(d.bay.x + 0.1, 1, d.bay.z + 2),
      new T.Vector3(0, 0, -1),
    );
    assert.ok(
      ray.intersectObject(d.group, true).length > 0,
      kind + ' default closed leaf must cover the opening',
    );
    animateBuildingDoors(root, w, b, 0, 0);
    root.updateMatrixWorld(true);
    assert.equal(
      ray.intersectObject(d.group, true).length,
      0,
      kind + ' open leaf must clear the doorway',
    );
  }
});

test('production scenery keeps animated leaves and hidden interiors in their original hierarchy', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('batched', 'Batched', 'owner');
  w.settings.buildingDoorMode = 'closed';
  const b = makeBuilding('batched-workshop', 'workshop', 0, 0),
    root = buildingModel(b, (m) => m),
    land = new T.Group();
  land.add(root);
  const rig = root.userData.interiors[0],
    door = rig.doors[0],
    panel = door.panels[0];
  const floor = rig.group.getObjectByName('interior-floor');
  animateBuildingDoors(root, w, b, 0, 0);
  batchStaticScenery(land);
  freezeScenery(land, []);
  assert.ok(panel.parent === door.group, 'batching must retain the actual door geometry');
  assert.ok(floor.parent === rig.group, 'interior visibility must still hide its actual geometry');
  const closed = panel.matrixWorld.clone();
  w.settings.buildingDoorMode = 'open';
  animateBuildingDoors(root, w, b, 5, 0);
  land.updateMatrixWorld();
  assert.notDeepEqual(
    panel.matrixWorld.elements,
    closed.elements,
    'the renderer must receive the moved matrix after freezing',
  );
  const ray = new T.Raycaster(
    new T.Vector3(door.bay.x + 0.1, 1, door.bay.z + 2),
    new T.Vector3(0, 0, -1),
  );
  assert.equal(ray.intersectObject(door.group, true).length, 0);
  w.settings.buildingDoorMode = 'closed';
  animateBuildingDoors(root, w, b, 5, 0);
  land.updateMatrixWorld();
  assert.equal(rig.group.visible, false);
  assert.ok(ray.intersectObject(door.group, true).length > 0);
});

test('working effects survive batching, stop behind shut doors, and respect reduced detail', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('effects', 'Effects', 'owner');
  w.settings.buildingDoorMode = 'open';
  for (const [kind, name] of [
    ['brewery', 'kettle-steam'],
    ['forge', 'hearth-coals'],
  ]) {
    const b = makeBuilding('effect-' + kind, kind, 0, 0),
      root = buildingModel(b, (m) => m),
      land = new T.Group();
    land.add(root);
    const effect = root.getObjectByName(name);
    assert.ok(effect, kind + ' needs an actual animated effect');
    batchStaticScenery(land);
    freezeScenery(land, []);
    animateBuildingDoors(root, w, b, 0, 0);
    const sample = () =>
      name === 'kettle-steam'
        ? effect.children[0].position.y
        : (effect as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>).material.emissiveIntensity;
    const before = sample();
    animateBuildingDoors(root, w, b, 0.2, 0);
    assert.notEqual(sample(), before);
    w.settings.buildingDoorMode = 'closed';
    animateBuildingDoors(root, w, b, 5, 0);
    const shut = sample();
    animateBuildingDoors(root, w, b, 0.2, 0);
    assert.equal(sample(), shut);
    w.settings.buildingDoorMode = 'open';
    animateBuildingDoors(root, w, b, 5, 0, true);
    if (name === 'kettle-steam')
      assert.equal(effect.visible, false, 'reduced interiors omit steam detail');
    const low = sample();
    animateBuildingDoors(root, w, b, 0.2, 0, true);
    assert.equal(sample(), low);
  }
});

test('variant-specific equipment is modelled, including sand floors and band saws', () => {
  for (const [kind, architecture, name] of [
    ['forge', 'model-3', 'sand-floor'],
    ['sawmill', 'model-4', 'band-saw'],
  ]) {
    const b = makeBuilding('variant-' + kind, kind, 0, 0);
    b.architecture = architecture;
    const model = buildingModel(b, (m) => m),
      prop = model.getObjectByName(name);
    assert.ok(prop, name + ' is present');
    assert.ok(!new T.Box3().setFromObject(prop).isEmpty(), name + ' has visible geometry');
  }
});

test('no legacy wall or painted door blocks any open industrial aperture', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('clear-bays', 'Clear bays', 'owner');
  w.settings.buildingDoorMode = 'open';
  const failures: string[] = [];
  for (const kind of [...industrialKinds, 'starport'])
    for (const architecture of [undefined, ...buildingArchitectures(kind).map((m) => m.id)]) {
      const b = makeBuilding('clear-' + kind, kind, 0, 0);
      b.architecture = architecture;
      const root = buildingModel(b, (m) => m);
      animateBuildingDoors(root, w, b, 0, 0);
      root.updateMatrixWorld(true);
      for (const rig of root.userData.interiors ?? [])
        for (const door of rig.doors)
          for (const x of [-door.bay.width * 0.3, 0.1, door.bay.width * 0.3]) {
            const origin = door.group.localToWorld(new T.Vector3(x, 1, 1));
            const direction = new T.Vector3(0, 0, -1).transformDirection(door.group.matrixWorld);
            const hits = new T.Raycaster(origin, direction, 0, 1.1).intersectObject(root, true);
            if (hits.length)
              failures.push(
                kind + '/' + (architecture ?? 'legacy') + ' at ' + door.bay.x + ',' + door.bay.z,
              );
          }
    }
  assert.deepEqual(failures, []);
});

test('boathouse water-side hall has working doors and keeps its open water channel', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('water-hall', 'Water hall', 'owner'),
    b = makeBuilding('yard', 'boathouse', 0, 0),
    root = buildingModel(b, (m) => m);
  const hall = (root.userData.interiors ?? []).find(
    (r: any) => r.group.name === 'lifting-hall-interior',
  );
  assert.ok(hall, 'the existing lifting hall participates in the same door policy');
  w.settings.buildingDoorMode = 'open';
  animateBuildingDoors(root, w, b, 0, 0);
  root.updateMatrixWorld(true);
  assert.equal(
    new T.Raycaster(new T.Vector3(0, 1, -30), new T.Vector3(0, -1, 0), 0, 2).intersectObject(
      root,
      true,
    ).length,
    0,
    'do not lay a solid floor across navigable water',
  );
  const lamps: T.Object3D[] = [];
  hall.group.traverse((o: T.Object3D) => {
    if (o.userData.interiorLight) lamps.push(o);
  });
  assert.equal(lamps.length, 2, 'the water-side hall has its own keyed lamps');
  assert.ok(lamps.every((o) => o.userData.lightSource === b.id));
  assert.ok(hall.doors.every((d: any) => d.openness === 1));
  w.settings.buildingDoorMode = 'closed';
  animateBuildingDoors(root, w, b, 5, 0);
  assert.equal(hall.group.visible, false);
});

test('interior lamps retain their hidden parent and light only open rooms at night', async () => {
  const { TownLighting } = await import('../src/client/lighting');
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('lamps', 'Lamps', 'owner');
  const b = makeBuilding('lamps-garage', 'garage', 0, 0);
  w.buildings = [b];
  w.settings.time = 0;
  w.settings.buildingDoorMode = 'open';
  const root = buildingModel(b, (m) => m),
    rig = root.userData.interiors[0];
  const lamps: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
  rig.group.traverse((o: T.Object3D) => {
    if (o.userData.interiorLight) lamps.push(o as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>);
  });
  assert.equal(lamps.length, 2);
  const lighting = new TownLighting();
  lighting.reset(root);
  assert.ok(
    lamps.every((l) => l.parent === rig.group),
    'lamps must stay inside the visibility gate',
  );
  const update = () => {
    animateBuildingDoors(root, w, b, 5, 0);
    w.time++;
    lighting.update(w, new T.Vector3());
  };
  update();
  assert.ok(lamps.every((l) => l.material.emissiveIntensity > 0));
  w.settings.buildingDoorMode = 'closed';
  update();
  assert.ok(lamps.every((l) => l.material.emissiveIntensity === 0));
  w.settings.buildingDoorMode = 'open';
  w.settings.time = 12 * 3600;
  update();
  assert.ok(lamps.every((l) => l.material.emissiveIntensity === 0));
  w.settings.time = 0;
  w.settings.buildingInteriorDetail = 'none';
  update();
  assert.ok(lamps.every((l) => l.material.emissiveIntensity === 0));
});

test('hay stacks reach the eaves at full stock and empty without rebuilding', async () => {
  const { updateInteriorStock } = await import('../src/client/interior-props');
  for (const architecture of [undefined, ...buildingArchitectures('haybarn').map((a) => a.id)]) {
    const b = makeBuilding('hay', 'haybarn', 0, 0);
    b.architecture = architecture;
    b.stock = { hay: b.capacity };
    const root = buildingModel(b, (m) => m),
      rig = root.userData.interiors[0];
    updateInteriorStock(rig, b);
    const bales = rig.principal.children.find(
      (o: T.Object3D) => o.userData.interiorProp === 'bales',
    );
    const bounds = new T.Box3().setFromObject(bales);
    assert.ok(bounds.max.y > rig.volume.eaves - 0.8, 'full bale stack reaches the eaves');
    const count = bales.children.filter((o: T.Object3D) => o.visible).length;
    b.stock.hay = b.capacity / 2;
    updateInteriorStock(rig, b);
    assert.ok(bales.children.filter((o: T.Object3D) => o.visible).length < count);
    b.stock.hay = 0;
    updateInteriorStock(rig, b);
    assert.equal(bales.children.filter((o: T.Object3D) => o.visible).length, 0);
  }
});

test('refinery includes a modelled compressor', () => {
  assert.ok(
    buildingModel(makeBuilding('refinery', 'refinery', 0, 0), (m) => m).getObjectByName(
      'compressor',
    ),
  );
});

test('every garage bay has a wheeled tool chest', () => {
  for (const architecture of [undefined, ...buildingArchitectures('garage').map((a) => a.id)]) {
    const b = makeBuilding('tools', 'garage', 0, 0);
    b.architecture = architecture;
    const root = buildingModel(b, (m) => m),
      rig = root.userData.interiors[0];
    const tools: T.Object3D[] = [];
    rig.group.traverse((o: T.Object3D) => {
      if (o.userData.interiorProp === 'tool-chest') tools.push(o);
    });
    assert.equal(tools.length, rig.doors.length, 'a wheeled tool chest per bay');
  }
});

test('freight hangars use a full-sized container', () => {
  const root = buildingModel(makeBuilding('freight', 'starport', 0, 0), (m) => m);
  const carrier = root.getObjectByName('container-transporter');
  assert.ok(carrier);
  const size = new T.Box3().setFromObject(carrier).getSize(new T.Vector3());
  assert.ok(
    size.z >= 6 && size.x >= 2.4 && size.y >= 3,
    'human-scale container on its transporter',
  );
});

test('boathouse workshops open toward their water-side slipway', () => {
  for (const architecture of [undefined, ...buildingArchitectures('boathouse').map((a) => a.id)]) {
    const b = makeBuilding('water-side', 'boathouse', 0, 0);
    b.architecture = architecture;
    const root = buildingModel(b, (m) => m),
      rig = root.userData.interiors[0];
    assert.ok(
      rig.doors.some((d: any) => d.bay.rear),
      'replace the painted rear water door with a real opening',
    );
  }
});

test('trade furnishings have usable arrangements and the details named in the backlog', () => {
  const get = (kind: string, architecture = 'model-1') => {
    const b = makeBuilding('trade-' + kind, kind, 0, 0);
    b.architecture = architecture;
    return buildingModel(b, (m) => m);
  };
  const brewery = get('brewery');
  const manways = brewery.getObjectByName('kettle-manways');
  assert.ok(manways && manways.children.length === 2, 'both kettles have access manways');
  const sacks = brewery.getObjectByName('malt-sacks')!;
  assert.ok(sacks.getObjectByName('sack-pallet'), 'malt sacks stand on a pallet');
  const furniture = get('carpenter').getObjectByName('finished-furniture')!;
  assert.ok(
    furniture.getObjectByName('finished-cabinet'),
    'finished cabinets accompany the chairs',
  );
  const sawmill = get('sawmill'),
    carriage = sawmill.getObjectByName('log-carriage')!,
    saw = sawmill.getObjectByName('saw')!;
  assert.equal(carriage.position.x, saw.position.x, 'log rails feed into the saw');
  const board = get('garage').getObjectByName('pegboard')!;
  assert.ok(new T.Box3().setFromObject(board).min.y > 1, 'hand tools hang above the floor');
  const pen = get('dairy').getObjectByName('pens')!;
  assert.equal(pen.position.x, 0, 'livestock stand within their pen');
  const port = get('starport'),
    container = port.getObjectByName('container-transporter')!,
    gantry = port.getObjectByName('maintenance-gantry')!;
  const containerBounds = new T.Box3().setFromObject(container),
    gantryBounds = new T.Box3().setFromObject(gantry);
  assert.ok(
    gantryBounds.max.y > containerBounds.max.y,
    'maintenance gantry clears a freight container',
  );
});

test('fixed furnishings batch by material without escaping interior or detail visibility', async () => {
  const { batchInteriorProps } = await import('../src/client/interior-batching');
  const b = makeBuilding('batch-furniture', 'garage', 0, 0),
    root = buildingModel(b, (m) => m),
    rig = root.userData.interiors[0];
  const count = () => {
    let n = 0,
      t = 0;
    rig.group.traverse((o: T.Object3D) => {
      if (o instanceof T.Mesh) {
        n++;
        t += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      }
    });
    return { n, t };
  };
  const before = count(),
    bounds = new T.Box3().setFromObject(rig.group);
  batchInteriorProps(rig);
  const after = count(),
    batchedBounds = new T.Box3().setFromObject(rig.group);
  assert.equal(after.t, before.t, 'batching preserves every triangle');
  assert.ok(after.n < before.n / 2, 'merge repeated fixture materials across the room');
  assert.ok(
    bounds.min.distanceTo(batchedBounds.min) < 0.0001 &&
      bounds.max.distanceTo(batchedBounds.max) < 0.0001,
  );
  const once = count();
  batchInteriorProps(rig);
  assert.deepEqual(count(), once, 'do not rebatch snapshot updates');
  rig.group.visible = false;
  let visibleMeshes = 0;
  root.traverseVisible((o) => {
    if (o instanceof T.Mesh && o.name === 'Batched interior furnishings') visibleMeshes++;
  });
  assert.equal(visibleMeshes, 0, 'closed interiors draw no furnishing batches');
});

test('hay stock leaves the bay sightline clear and factory tools have distinct machinery', async () => {
  const { animateBuildingDoors } = await import('../src/client/building-interiors');
  const { createWorld } = await import('../src/shared/simulation');
  const w = createWorld('sightlines', 'Sightlines', 'owner');
  w.settings.buildingDoorMode = 'open';
  for (const a of buildingArchitectures('haybarn')) {
    const b = makeBuilding('stock-door', 'haybarn', 0, 0);
    b.architecture = a.id;
    b.stock.hay = b.capacity;
    const root = buildingModel(b, (m) => m);
    animateBuildingDoors(root, w, b, 0, 0);
    root.updateMatrixWorld(true);
    const door = root.userData.interiors[0].doors[0],
      bay = door.bay;
    const hit = new T.Raycaster(
      new T.Vector3(bay.x, 1.7, bay.z + 3),
      new T.Vector3(0, 0, -1),
      0,
      3.1,
    ).intersectObject(root, true);
    assert.equal(hit.length, 0, a.name + ': outside bales must not block the open doorway');
  }
});

test('factory tools have distinct working geometry', () => {
  const root = buildingModel(makeBuilding('tools', 'factory', 0, 0), (m) => m),
    line = root.getObjectByName('machine-line')!;
  const signatures = new Set<string>();
  for (const name of ['lathe', 'mill', 'press']) {
    const tool = line.getObjectByName(name);
    assert.ok(tool, 'factory needs a ' + name);
    let count = 0;
    tool.traverse((o) => {
      if (o instanceof T.Mesh) count += o.geometry.attributes.position.count;
    });
    signatures.add(String(count));
  }
  assert.equal(signatures.size, 3, 'lathe, mill and press have different working geometry');
});

test('the repair aircraft engine is displayed on a stand, with a modelled radial block', async () => {
  const b = makeBuilding('aircraft', 'garage', 0, 0);
  b.aircraftHangar = true;
  const { furnishInterior } = await import('../src/client/interior-props');
  const { buildingPlan } = await import('../src/shared/building-shapes');
  const root = new T.Group(),
    principal = new T.Group(),
    detail = new T.Group();
  root.add(principal, detail);
  furnishInterior(
    { group: root, principal, detail, volume: buildingPlan(b).volumes[0], doors: [] },
    b,
  );
  const engine = root.getObjectByName('radial-engine');
  assert.ok(engine, 'move the seven-cylinder engine to its repair stand');
  assert.equal(engine.children.length, 8, 'seven cylinder heads around a crankcase');
  const bounds = new T.Box3().setFromObject(engine, true);
  assert.ok(bounds.getSize(new T.Vector3()).y > 0.7);
});

test('trade floor surfaces use the appropriate planks or flagstone finish', () => {
  for (const [kind, finish] of [
    ['sawmill', 'boards'],
    ['forge', 'limestone'],
  ]) {
    const root = buildingModel(makeBuilding('floor-' + kind, kind, 0, 0), (m) => m);
    const floor = root.getObjectByName('interior-floor') as T.Mesh<
      T.BufferGeometry,
      T.MeshStandardMaterial
    >;
    assert.equal(floor.material.map?.userData.buildingFinish, finish);
  }
});

test('garage grinder and parts washer share the long rear workbench', () => {
  const root = buildingModel(makeBuilding('bench', 'garage', 0, 0), (m) => m);
  const bench = root.getObjectByName('workbench')!,
    grinder = root.getObjectByName('bench-grinder')!,
    washer = root.getObjectByName('parts-washer')!;
  assert.equal(grinder.position.z, bench.position.z);
  assert.equal(washer.position.z, bench.position.z);
  assert.equal(grinder.position.x, bench.position.x - 1.5);
  assert.equal(washer.position.x, bench.position.x + 1.5);
});
