// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ParkedVehicleScene } from '../src/client/parked-vehicle-scene';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
function world() {
  const w = createWorld('parked-batching', 'Parked', 'owner');
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'off' });
  const p = addPlayer(w, 'owner', 'Owner');
  Object.assign(p, { x: 0, z: 0, y: 0, speed: 0 });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  return { w, p };
}
function triangles(root: T.Object3D) {
  root.updateWorldMatrix(true, true);
  const out: number[][] = [];
  root.traverseVisible((o) => {
    if (!(o instanceof T.Mesh)) return;
    const pos = o.geometry.getAttribute('position'),
      normal = o.geometry.getAttribute('normal'),
      index = o.geometry.index;
    const matrix = new T.Matrix3().getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < (index?.count ?? pos.count); i++) {
      const n = index ? index.getX(i) : i;
      const v = new T.Vector3().fromBufferAttribute(pos, n).applyMatrix4(o.matrixWorld);
      const axis = new T.Vector3().fromBufferAttribute(normal, n).applyNormalMatrix(matrix);
      out.push([...v.toArray(), ...axis.toArray()]);
    }
  });
  return out.sort((a, b) => {
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-4) return a[i] - b[i];
    return 0;
  });
}
function meshes(root: T.Object3D) {
  const out: T.Mesh[] = [];
  root.traverseVisible((o) => {
    if (o instanceof T.Mesh) out.push(o);
  });
  return out;
}
test('parked opaque parts batch across subgroups without changing geometry, normals, driver or glass', () => {
  const { w } = world();
  const body = new T.MeshStandardMaterial({
    color: '#125678',
    roughness: 0.7,
    emissiveIntensity: 0,
  });
  const glass = new T.MeshStandardMaterial({
    transparent: true,
    opacity: 0.4,
    emissiveIntensity: 0,
  });
  let before: number[][] = [],
    model!: T.Group,
    driver!: T.Mesh,
    pane!: T.Mesh;
  const scene = new ParkedVehicleScene(() => {
    model = new T.Group();
    for (let i = 0; i < 12; i++) {
      const assembly = new T.Group();
      assembly.position.set((i % 3) - 1, (i % 2) * 0.4, Math.floor(i / 3) - 2);
      assembly.rotation.y = i * 0.17;
      const mesh = new T.Mesh(new T.BoxGeometry(0.7, 0.5, 0.3), body);
      mesh.rotation.x = 0.3;
      mesh.scale.set(1, 1.2, 0.8);
      mesh.castShadow = mesh.receiveShadow = true;
      assembly.add(mesh);
      model.add(assembly);
    }
    driver = new T.Mesh(new T.BoxGeometry(0.3, 1, 0.2), body);
    driver.position.y = 2;
    driver.visible = false;
    model.userData.driver = driver;
    model.add(driver);
    pane = new T.Mesh(new T.BoxGeometry(2, 1, 0.05), glass);
    pane.position.set(0, 2, 1);
    model.add(pane);
    const parked = Object.values(w.parkedVehicles!)[0];
    model.position.set(parked.x, parked.y, parked.z);
    model.rotation.y = parked.heading;
    before = triangles(model);
    return model;
  });
  scene.update(w, 0, 0, 500);
  assert.equal(meshes(model).length, 2, 'one compatible opaque batch plus the unchanged glass');
  assert.equal(driver.parent, model, 'retain the driver anchor and hierarchy for dismounting');
  assert.equal(driver.visible, false);
  assert.equal(pane.material, glass);
  assert.equal(pane.parent, model);
  const after = triangles(model);
  assert.equal(after.length, before.length);
  for (let i = 0; i < after.length; i++)
    for (let j = 0; j < 6; j++)
      assert.ok(Math.abs(after[i][j] - before[i][j]) < 1e-4, `vertex/normal ${i}:${j}`);
  const batch = meshes(model).find((m) => m !== pane)!;
  assert.equal(batch.material, body);
  assert.equal(batch.castShadow, true);
  assert.equal(batch.receiveShadow, true);
  const geometry = batch.geometry;
  scene.update({ ...w, time: w.time + 1 }, 0, 0, 500);
  assert.equal(meshes(model).find((m) => m !== pane)!.geometry, geometry);
});
test('parked batching preserves separate render state and keeps shared geometry alive through boarding', () => {
  const { w, p } = world();
  const shared = new T.BoxGeometry(1, 1, 1);
  shared.userData.shared = true;
  const material = new T.MeshStandardMaterial({ emissiveIntensity: 0 });
  material.userData.shared = true;
  let sharedDisposals = 0;
  shared.addEventListener('dispose', () => sharedDisposals++);
  let ownedDisposals = 0;
  const owned = new T.BoxGeometry(0.2, 0.3, 0.4);
  owned.addEventListener('dispose', () => ownedDisposals++);
  let special!: T.Mesh;
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(i < 4 ? shared : owned, material);
      m.position.x = i;
      m.castShadow = i < 4;
      m.receiveShadow = true;
      g.add(m);
    }
    special = new T.Mesh(shared, material);
    special.position.z = 2;
    special.onBeforeRender = () => {};
    g.add(special);
    return g;
  });
  scene.update(w, 0, 0, 500);
  const model = scene.group.children[0];
  assert.equal(
    meshes(model).length,
    3,
    'two shadow policies and a custom draw callback stay separate',
  );
  assert.equal(special.parent, model);
  assert.equal(sharedDisposals, 0);
  assert.equal(ownedDisposals, 1, 'retire replaced private geometry exactly once');
  const combined = meshes(model)
    .filter((m) => m !== special)
    .map((m) => m.geometry);
  let disposed = 0;
  combined.forEach((g) => g.addEventListener('dispose', () => disposed++));
  act(w, p.id, { type: 'vehicle', slot: 0 });
  scene.update(w, 0, 0, 500);
  assert.equal(scene.group.children.length, 0);
  assert.equal(disposed, 2);
  assert.equal(sharedDisposals, 0);
  assert.equal(ownedDisposals, 1);
});
test('equivalent plain materials share a parked draw without merging distinct colors or shaders', () => {
  const { w } = world();
  let retired = 0;
  let special!: T.Mesh;
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    for (let i = 0; i < 4; i++) {
      const m = new T.MeshStandardMaterial({ color: '#456789', emissiveIntensity: 0 });
      m.name = 'part-' + i;
      m.addEventListener('dispose', () => retired++);
      const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), m);
      mesh.position.x = i;
      g.add(mesh);
    }
    const different = new T.MeshStandardMaterial({ color: '#456789', emissiveIntensity: 0 });
    different.color.r += 1e-8;
    g.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), different));
    const shader = new T.MeshStandardMaterial({ color: '#456789', emissiveIntensity: 0 });
    shader.onBeforeCompile = () => {};
    special = new T.Mesh(new T.BoxGeometry(1, 1, 1), shader);
    g.add(special);
    return g;
  });
  scene.update(w, 0, 0, 500);
  assert.equal(
    meshes(scene.group).length,
    3,
    'merge equal untextured materials, retain exact color and shader differences',
  );
  assert.equal(retired, 3, 'dispose only the three unused private materials');
  assert.equal(special.parent, scene.group.children[0]);
});
test('creator components attached to a stock parked vehicle retain their authored hierarchy', async () => {
  const { creatorSchema } = await import('../src/shared/creator');
  const { w } = world();
  w.creator = creatorSchema.parse({
    models: [
      {
        id: 'custom-part',
        name: 'Custom part',
        parts: [0, 1].map((x) => ({
          shape: 'box',
          x,
          y: 1,
          z: 0,
          sx: 1,
          sy: 1,
          sz: 1,
          yaw: 0,
          color: '#123456',
        })),
      },
    ],
  });
  w.vehicleTuning = {
    0: {
      components: [0, 3].map((x) => ({
        model: 'custom-part',
        role: 'body',
        x,
        y: 0,
        z: 0,
        scale: 1,
        yaw: 0,
      })),
    },
  };
  const scene = new ParkedVehicleScene(() => new T.Group());
  scene.update(w, 0, 0, 500);
  const { creatorModel } = await import('../src/client/creator-model');
  const expected = meshes(creatorModel(w.creator.models[0], w)).length;
  const custom: T.Object3D[] = [];
  scene.group.traverse((o) => {
    if (o.userData.creatorModel) custom.push(o);
  });
  assert.equal(custom.length, 2);
  for (const model of custom)
    assert.equal(
      meshes(model).length,
      expected,
      'custom components keep their own rendered hierarchy',
    );
});
test('paint and tuning edits rebuild parked batches and retire the previous buffers', () => {
  const { w } = world();
  let builds = 0;
  const scene = new ParkedVehicleScene(() => {
    builds++;
    const g = new T.Group(),
      m = new T.MeshStandardMaterial({ emissiveIntensity: 0 });
    for (let i = 0; i < 3; i++) {
      const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), m);
      mesh.position.x = i;
      g.add(mesh);
    }
    return g;
  });
  scene.update(w, 0, 0, 500);
  let geometry = meshes(scene.group)[0].geometry,
    disposals = 0;
  geometry.addEventListener('dispose', () => disposals++);
  Object.values(w.parkedVehicles!)[0].paint = '#123456';
  scene.update(w, 0, 0, 500);
  assert.equal(builds, 2);
  assert.equal(disposals, 1);
  assert.notEqual(meshes(scene.group)[0].geometry, geometry);
  geometry = meshes(scene.group)[0].geometry;
  geometry.addEventListener('dispose', () => disposals++);
  w.vehicleTuning = { 0: { width: 3 } };
  scene.update(w, 0, 0, 500);
  assert.equal(builds, 3);
  assert.equal(disposals, 2);
  assert.notEqual(meshes(scene.group)[0].geometry, geometry);
});
test('custom vertex shaders keep the original object space even when two parts share a material', () => {
  const { w } = world();
  for (const material of [
    new T.MeshStandardMaterial({ emissiveIntensity: 0 }),
    new T.ShaderMaterial(),
  ]) {
    if (material instanceof T.MeshStandardMaterial) material.onBeforeCompile = () => {};
    const original: T.Mesh[] = [];
    const scene = new ParkedVehicleScene(() => {
      const g = new T.Group();
      for (let i = 0; i < 2; i++) {
        const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), material);
        mesh.position.x = i * 2;
        original.push(mesh);
        g.add(mesh);
      }
      return g;
    });
    scene.update(w, 0, 0, 500);
    assert.equal(
      meshes(scene.group).length,
      2,
      'shader-local positions cannot be baked into another object space',
    );
    for (const mesh of original) assert.equal(mesh.parent, scene.group.children[0]);
  }
});
test('equivalent textured materials batch only when they share the exact texture object', () => {
  const { w } = world(),
    texture = new T.Texture(),
    other = new T.Texture();
  const scene = new ParkedVehicleScene(() => {
    const g = new T.Group();
    for (const map of [texture, texture, other])
      g.add(
        new T.Mesh(
          new T.BoxGeometry(1, 1, 1),
          new T.MeshStandardMaterial({ map, emissiveIntensity: 0 }),
        ),
      );
    return g;
  });
  scene.update(w, 0, 0, 500);
  assert.equal(
    meshes(scene.group).length,
    2,
    'reuse equal material state with the same texture; retain independent textures',
  );
});
test('parked body finalization applies ocean shading after lamp darkening and batching', async () => {
  const { Ocean } = await import('../src/client/ocean');
  const ocean = new Ocean(),
    { w } = world();
  let finalized = 0;
  const scene = new ParkedVehicleScene(
    () => {
      const root = new T.Group();
      const material = new T.MeshStandardMaterial({ emissive: 'white', emissiveIntensity: 0.5 });
      for (let i = 0; i < 3; i++) {
        const mesh = new T.Mesh(new T.BoxGeometry(), material);
        mesh.position.x = i;
        root.add(mesh);
      }
      return root;
    },
    (root: T.Group) => {
      finalized++;
      assert.equal(meshes(root).length, 1);
      ocean.absorb(root);
    },
  );
  scene.update(w, 0, 0, 500);
  assert.equal(finalized, 1, 'finalize the completed parked body exactly once');
  const material = meshes(scene.group)[0].material as T.MeshStandardMaterial;
  assert.equal(material.emissiveIntensity, 0);
  const shader = {
    uniforms: {},
    vertexShader: '#include <project_vertex>',
    fragmentShader: '#include <opaque_fragment>',
  };
  material.onBeforeCompile(shader as any, {} as T.WebGLRenderer);
  assert.match(shader.vertexShader, /modelMatrix \* oceanWorld/);
  assert.equal((shader.uniforms as any).oceanLevel, ocean.level);
  scene.update(w, 0, 0, 500);
  assert.equal(finalized, 1);
});
test('a body mesh that carries hidden driver children keeps its hierarchy', () => {
  const { w } = world();
  let anchor!: T.Mesh, driver!: T.Group;
  const scene = new ParkedVehicleScene(() => {
    const root = new T.Group(),
      material = new T.MeshStandardMaterial({ emissiveIntensity: 0 });
    anchor = new T.Mesh(new T.BoxGeometry(), material);
    driver = new T.Group();
    driver.visible = false;
    anchor.add(driver);
    root.userData.driver = driver;
    root.add(anchor, new T.Mesh(new T.BoxGeometry(), material));
    return root;
  });
  scene.update(w, 0, 0, 500);
  assert.equal(
    anchor.parent,
    scene.group.children[0],
    'batching must not detach hidden child anchors',
  );
  assert.equal(driver.parent, anchor);
});
