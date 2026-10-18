import { detailTexture, detailMaterial, sidingMaterial } from './detail-textures';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { buildingPlan, type BuildingVolume } from '../shared/building-shapes';
import type { Building } from '../shared/types';
import { surface } from './materials';
import { spaceportModel } from './spaceport';
import { buildingFinish, finishMaterial, finishSurface } from './building-finishes';

/** Original metre-scale village kit. Door/window dimensions never scale with the shell. */
export function buildingModel(b: Building, finish: typeof surface = surface) {
  const root = new T.Group(),
    plan = buildingPlan(b),
    look = buildingFinish(b.kind, plan);
  const mat = (color: string) => new T.MeshStandardMaterial({ color, roughness: 0.88 });
  function mesh(geometry: T.BufferGeometry, color: string, x: number, y: number, z: number) {
    const m = new T.Mesh(geometry, mat(color));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  }
  function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
    return mesh(new T.BoxGeometry(w, h, d), color, x, y, z);
  }
  function cylinder(r: number, h: number, color: string, x: number, y: number, z: number) {
    return mesh(new T.CylinderGeometry(r, r, h, 16), color, x, y, z);
  }
  function beam(a: T.Vector3, b: T.Vector3, thickness: number, color: string) {
    const m = box(thickness, a.distanceTo(b), thickness, color, 0, 0, 0);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  function wallFinish(m: T.Mesh<T.BufferGeometry, T.Material | T.Material[]>) {
    if (b.kind === 'home' && plan.siding === 'wood' && !plan.finish)
      return sidingMaterial(m, plan.wall);
    if (look.wall === 'stone') return finish(m, 'stone', 3, b.construction ? '#a6a18d' : look.tint);
    return finishSurface(m, look.wall, b.construction ? '#a6a18d' : look.tint);
  }
  function roof(v: BuildingVolume) {
    const w = v.width / 2 + 0.28,
      d = v.depth / 2 + 0.28,
      h = v.rise;
    if (v.roof === 'flat') {
      finishSurface(
        box(v.width + 0.35, 0.18, v.depth + 0.35, '#ffffff', v.x, v.eaves + 0.08, v.z),
        look.roof,
      );
      if (h > 0) {
        for (const side of [-1, 1]) {
          box(v.width + 0.2, h, 0.14, '#bfc3b4', v.x, v.eaves + h / 2, v.z + (side * v.depth) / 2);
          box(0.14, h, v.depth, '#bfc3b4', v.x + (side * v.width) / 2, v.eaves + h / 2, v.z);
        }
      }
      return;
    }
    if (v.roof === 'shed') {
      const top = finishSurface(
        box(w * 2, 0.16, Math.hypot(d * 2, h), '#ffffff', v.x, v.eaves + h / 2, v.z),
        look.roof,
      );
      top.rotation.x = Math.atan2(h, d * 2);
      // Tapered side infill closes the wedge beneath the sloping roof.
      for (const side of [-1, 1]) {
        const shape = new T.Shape();
        shape.moveTo(-d, 0);
        shape.lineTo(-d, h);
        shape.lineTo(d, 0);
        shape.closePath();
        const g = new T.ShapeGeometry(shape);
        g.rotateY(-Math.PI / 2);
        const wall = wallFinish(mesh(g, '#ffffff', v.x + (side * v.width) / 2, v.eaves, v.z));
        (wall.material as T.Material).side = T.DoubleSide;
      }
      wallFinish(box(v.width, h, 0.12, '#ffffff', v.x, v.eaves + h / 2, v.z - v.depth / 2));
      return;
    }
    const ridge = v.roof === 'hip' ? d * 0.45 : d;
    const vertices = [
      new T.Vector3(-w, 0, -d),
      new T.Vector3(w, 0, -d),
      new T.Vector3(w, 0, d),
      new T.Vector3(-w, 0, d),
      new T.Vector3(0, h, -ridge),
      new T.Vector3(0, h, ridge),
    ];
    const indices = [
      0,
      5,
      4,
      0,
      3,
      5,
      1,
      5,
      2,
      1,
      4,
      5,
      ...(v.roof === 'hip' ? [0, 4, 1, 3, 2, 5] : []),
    ];
    const geometry = new T.BufferGeometry().setFromPoints(indices.map((i) => vertices[i]));
    geometry.computeVertexNormals();
    const top = finishSurface(mesh(geometry, '#ffffff', v.x, v.eaves, v.z), look.roof);
    (top.material as T.Material).side = T.DoubleSide;
    if (v.roof === 'gable') {
      const shape = new T.Shape();
      shape.moveTo(-v.width / 2, 0);
      shape.lineTo(0, h - 0.08);
      shape.lineTo(v.width / 2, 0);
      shape.closePath();
      for (const side of [-1, 1]) {
        const face = wallFinish(
          mesh(
            new T.ShapeGeometry(shape),
            '#ffffff',
            v.x,
            v.eaves,
            v.z + side * (v.depth / 2 + 0.015),
          ),
        );
        if (side < 0) face.rotation.y = Math.PI;
        (face.material as T.Material).side = T.DoubleSide;
      }
    }
    beam(
      new T.Vector3(v.x, v.eaves + h + 0.04, v.z - ridge),
      new T.Vector3(v.x, v.eaves + h + 0.04, v.z + ridge),
      0.12,
      '#706c60',
    );
    for (const side of [-1, 1]) box(0.12, 0.15, 2 * d, '#d2c8af', v.x + side * w, v.eaves, v.z);
  }
  function window(x: number, y: number, z: number, width = 1.05, angle = 0) {
    const m =
      look.window === 'cottage'
        ? detailMaterial('window')
        : finishMaterial(`window-${look.window}`);
    m.emissiveMap = detailTexture('window-light');
    m.roughness = 0.45;
    const pane = new T.Mesh(new T.PlaneGeometry(width + 0.22, 1.42), m);
    pane.position.set(x + Math.sin(angle) * 0.06, y, z + Math.cos(angle) * 0.06);
    pane.rotation.y = angle;
    pane.userData.lightSource = b.id;
    root.add(pane);
  }
  function door(x: number, z: number) {
    const panel = new T.Mesh(
      new T.PlaneGeometry(1.17, plan.doorHeight + 0.13),
      look.door === 'house'
        ? detailMaterial('door', look.accent)
        : finishMaterial(look.door, look.accent),
    );
    panel.position.set(x, (plan.doorHeight + 0.13) / 2, z + 0.12);
    root.add(panel);
    box(1.5, 0.12, 0.65, '#aaa58f', x, 0.06, z + 0.25);
  }
  function chimney(x: number, z: number, top: number) {
    (root.userData.chimneys ??= []).push(new T.Vector3(x, top + 0.4, z));
    finish(box(0.62, top, 0.68, '#ffffff', x, top / 2, z), 'stone', 2, '#b79780');
    box(0.8, 0.16, 0.86, '#b6aa94', x, top, z);
    for (const dx of [-0.17, 0.17]) cylinder(0.095, 0.3, '#907360', x + dx, top + 0.2, z);
  }
  const main = plan.volumes[0],
    front = main.depth / 2 + 0.06;
  if (['notice', 'pickup', 'portal', 'turret'].includes(b.kind)) {
    if (b.kind === 'notice') {
      for (const x of [-0.9, 0.9]) box(0.13, 2.2, 0.13, plan.trim, x, 1.1, 0);
      wallFinish(box(2, 0.95, 0.16, '#ffffff', 0, 1.6, 0));
      for (const x of [-0.55, 0, 0.55]) box(0.4, 0.6, 0.02, '#e2d5af', x, 1.6, 0.095);
      roof(main);
    } else if (b.kind === 'portal') {
      for (const x of [-1.3, 1.3]) wallFinish(box(0.4, 3.8, 0.7, '#ffffff', x, 1.9, 0));
      box(3, 0.35, 0.75, plan.trim, 0, 3.8, 0);
      const ring = mesh(new T.TorusGeometry(1.15, 0.09, 8, 36), '#8cbbb8', 0, 2, 0);
      ring.scale.y = 1.35;
    } else if (b.kind === 'turret') {
      wallFinish(cylinder(1.1, 1.5, '#ffffff', 0, 0.75, 0));
      cylinder(0.75, 0.8, '#5b6762', 0, 1.9, 0);
      box(0.3, 0.3, 2, '#45504b', 0, 2.1, 0.8);
    } else {
      wallFinish(box(1.8, 1.1, 1.2, '#ffffff', 0, 0.55, 0));
      for (const x of [-0.7, 0.7]) box(0.12, 1.13, 1.23, '#51594b', x, 0.56, 0);
    }
    return root;
  }
  for (const v of plan.volumes) {
    if (b.kind === 'haybarn' && v.roof === 'shed') {
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          box(
            0.2,
            v.eaves,
            0.2,
            plan.trim,
            v.x + (x * v.width) / 2,
            v.eaves / 2,
            v.z + (z * v.depth) / 2,
          );
    } else wallFinish(box(v.width, v.eaves, v.depth, '#ffffff', v.x, v.eaves / 2, v.z));
    box(v.width + 0.15, 0.2, v.depth + 0.15, '#9d9f8e', v.x, 0.1, v.z);
    if (b.construction) {
      for (const side of [-1, 1])
        for (const end of [-1, 1])
          box(
            0.12,
            v.eaves + 1,
            0.12,
            '#a38a5d',
            v.x + side * (v.width / 2 + 0.5),
            (v.eaves + 1) / 2,
            v.z + end * (v.depth / 2 + 0.5),
          );
      continue;
    }
    if (b.kind === 'scripted' && b.style && v !== main) {
      finish(
        box(v.width - 0.16, 0.03, v.depth - 0.16, '#ffffff', v.x, v.eaves + 0.015, v.z),
        'gravel',
        3,
        '#51402d',
      );
    } else roof(v);
  }
  if (b.construction) return root;
  if (b.kind === 'haybarn') {
    // One instanced draw; the texture supplies fibre and twine detail.
    const bales = new T.InstancedMesh(
      new T.BoxGeometry(1.6, 0.8, 1.05),
      detailMaterial('hay', '#ffffff', 0.04),
      9,
    );
    for (let i = 0; i < 9; i++)
      bales.setMatrixAt(
        i,
        new T.Matrix4().makeTranslation(
          plan.volumes[1].x - 1.3 + (i % 2) * 1.7,
          0.5 + Math.floor(i / 6) * 0.82,
          -3 + Math.floor((i % 6) / 2) * 1.15,
        ),
      );
    bales.computeBoundingSphere();
    bales.userData.hayStack = true;
    bales.count = Math.min(9, Math.ceil(Math.max(0, b.stock.hay ?? 0) / 50));
    root.add(bales);
    box(2.1, 1.6, 0.1, plan.trim, 0, main.eaves + 0.45, front);
  }

  const shed = [
    'garage',
    'farm',
    'haybarn',
    'sawmill',
    'warehouse',
    'shipyard',
    'factory',
    'forge',
    'workshop',
    'dairy',
    'sheepfold',
    'piggery',
  ].includes(b.kind);
  if (shed) {
    const bays = ['garage', 'warehouse', 'factory', 'shipyard', 'haybarn'].includes(b.kind)
      ? [-2.7, 2.7]
      : [0];
    for (const x of bays) {
      // Frame, planks, bracing and shutter ribs are baked into one two-triangle panel.
      const height = Math.min(3.4, main.eaves - 0.25);
      const bay = new T.Mesh(
        new T.PlaneGeometry(3.6, height),
        finishMaterial(look.bay, look.accent),
      );
      bay.position.set(x, height / 2, front + 0.18);
      root.add(bay);
    }
    for (const z of [-2, 1.4]) window(main.width / 2 + 0.035, 2, z, 1.1, Math.PI / 2);
    if (b.kind === 'farm' || b.kind === 'sawmill') {
      // The wall texture supplies siding; retain the existing hayloft silhouette.
      const loft = box(1.4, 1.2, 0.08, plan.trim, 0, main.eaves + 0.45, front);
      loft.material.dispose();
      loft.material = finishMaterial('barn-door', look.accent);
    }
  } else {
    door(
      0,
      ['school', 'hotel'].includes(b.kind)
        ? plan.volumes[1].z + plan.volumes[1].depth / 2 + 0.06
        : front,
    );
    const xs = main.width > 10 ? [-4, -2, 2, 4] : [-main.width * 0.3, main.width * 0.3];
    for (const x of xs) window(x, 1.6, front);
    for (const side of [-1, 1])
      for (const z of [-main.depth * 0.26, main.depth * 0.26])
        window(side * (main.width / 2 + 0.035), 1.6, z, 1.05, (side * Math.PI) / 2);
    for (const x of [-main.width * 0.3, main.width * 0.3])
      window(x, 1.6, -main.depth / 2 - 0.035, 1.05, Math.PI);
    if (main.eaves > 7) {
      for (const x of [-main.width * 0.3, 0, main.width * 0.3]) {
        window(x, 6.6, front);
        window(x, 6.6, -main.depth / 2 - 0.035, 1.05, Math.PI);
      }
    }
    if (main.eaves > 4.8) {
      for (const x of [-main.width * 0.3, main.width * 0.3])
        window(x, 4.1, -main.depth / 2 - 0.035, 1.05, Math.PI);
      for (const x of [-main.width * 0.3, 0, main.width * 0.3]) window(x, 4.1, front);
      for (const side of [-1, 1])
        window(side * (main.width / 2 + 0.035), 4.1, 0, 1.05, (side * Math.PI) / 2);
    }
  }
  if (
    [
      'home',
      'bnb',
      'hotel',
      'kitchen',
      'roastery',
      'teaHouse',
      'bakery',
      'pub',
      'workhouse',
      'brickworks',
    ].includes(b.kind)
  )
    chimney(-main.width * 0.3, -main.depth * 0.22, main.eaves + main.rise + 0.5);
  if (['market', 'shop', 'bakery'].includes(b.kind)) {
    const width = main.width - 0.5;
    const canopy = box(width, 0.09, 1.7, '#ffffff', 0, 2.6, front + 0.7);
    canopy.rotation.x = 0.12;
    const valance = box(width, 0.22, 0.08, '#ffffff', 0, 2.38, front + 1.53);
    for (const panel of [canopy, valance]) {
      panel.material.dispose();
      panel.material = finishMaterial(b.kind === 'bakery' ? 'awning-rust' : 'awning-green');
    }
    for (const x of [-width / 2, width / 2]) box(0.09, 2.5, 0.09, '#6e6250', x, 1.25, front + 1.4);
  }
  if (b.kind === 'pub') {
    box(main.width + 0.06, 0.18, main.depth + 0.06, plan.trim, 0, 2.8, 0);
    for (const x of [-main.width / 2 + 0.08, -1.35, 1.35, main.width / 2 - 0.08])
      box(0.16, 2.55, 0.1, plan.trim, x, 4.05, front + 0.03);
    for (const x of [-3, 3])
      beam(
        new T.Vector3(x - 1, 2.9, front + 0.08),
        new T.Vector3(x + 1, 3.3, front + 0.08),
        0.12,
        plan.trim,
      );
    box(0.08, 0.08, 1.3, '#4d5246', -main.width / 2 - 0.4, 3, front + 0.45);
    box(0.8, 0.65, 0.09, '#647349', -main.width / 2 - 0.4, 2.6, front + 1);
  }
  if (b.kind === 'bank' || b.kind === 'school') {
    const entrance = ['school', 'hotel'].includes(b.kind)
      ? plan.volumes[1].z + plan.volumes[1].depth / 2 + 0.06
      : front;
    for (const x of [-1.3, 1.3]) cylinder(0.14, 2.45, '#d8d2bd', x, 1.225, entrance + 0.8);
    box(3.2, 0.2, 1.5, '#c5c4b3', 0, 2.55, entrance + 0.65);
    if (b.kind === 'school') {
      box(1.2, 1.2, 1.2, '#c6c3a9', 0, 5.45, -1);
      mesh(new T.ConeGeometry(0.95, 0.8, 4), '#747b71', 0, 6.4, -1).rotation.y = Math.PI / 4;
      cylinder(0.24, 0.45, '#998350', 0, 5.6, -0.32);
    }
  }
  if (b.kind === 'waterworks') {
    // Original pump-house kit: insulated tank, pressure bands, pump and buried intake.
    cylinder(1.05, 1.7, '#759b9c', 1.65, 4.75, -0.8);
    for (const y of [4, 4.75, 5.5])
      mesh(new T.TorusGeometry(1.07, 0.055, 5, 20), '#d1d6c4', 1.65, y, -0.8).rotation.x =
        Math.PI / 2;
    cylinder(0.22, 0.28, '#465d62', 1.65, 5.72, -0.8);
    box(1.1, 0.8, 1, '#567c83', -2.4, 0.6, -3.25);
    const intake = cylinder(0.13, 1.8, '#748281', -2.4, 0.48, -4.1);
    intake.rotation.x = Math.PI / 2;
    cylinder(0.18, 0.65, '#647574', -2.4, 0.325, -4.9);
    box(1.25, 0.16, 0.85, '#a6aca2', -2.4, 0.08, -4.7);
    const valve = mesh(new T.TorusGeometry(0.25, 0.045, 5, 16), '#9e5e45', -2.4, 1.18, -3.7);
    valve.rotation.x = Math.PI / 2;
    box(0.95, 0.5, 0.1, '#35535d', 0, 2.6, front + 0.08);
  }
  if (b.kind === 'mill') {
    chimney(4.5, -1, 5.2);
    // A mill wheel gives a recognizable silhouette without adding animated draw calls.
    const wheel = mesh(
      new T.TorusGeometry(1.6, 0.16, 8, 28),
      '#62513c',
      -main.width / 2 - 0.2,
      1.9,
      0,
    );
    wheel.rotation.y = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        new T.Vector3(-main.width / 2 - 0.2, 1.9, 0),
        new T.Vector3(-main.width / 2 - 0.2, 1.9 + Math.sin(a) * 1.6, Math.cos(a) * 1.6),
        0.12,
        '#62513c',
      );
      const paddle = box(
        0.75,
        0.26,
        0.45,
        '#8a7550',
        -main.width / 2 - 0.2,
        1.9 + Math.sin(a) * 1.6,
        Math.cos(a) * 1.6,
      );
      paddle.rotation.x = -a;
    }
  }
  if (['forge', 'brewery', 'factory'].includes(b.kind)) {
    const height = b.kind === 'forge' ? 8 : 7.3;
    finish(
      cylinder(0.45, height, '#ffffff', main.width * 0.35, height / 2, -main.depth * 0.3),
      'stone',
      2,
      '#968676',
    );
    cylinder(0.57, 0.2, '#79786a', main.width * 0.35, height, -main.depth * 0.3);
    (root.userData.chimneys ??= []).push(
      new T.Vector3(main.width * 0.35, height + 0.2, -main.depth * 0.3),
    );
  }
  if (['dairy', 'sheepfold', 'piggery', 'henhouse'].includes(b.kind)) {
    // Trough and hay stores sit against the building, within its standing yard.
    const x = main.width / 2 + 0.5;
    box(0.8, 0.4, 2.4, '#737a73', x, 0.2, -1);
    box(0.65, 0.03, 2.2, '#688e92', x, 0.4, -1);
    for (let i = 0; i < 3; i++) {
      const bale = cylinder(0.46, 0.8, '#ba9f5e', -main.width / 2 - 0.5, 0.46, -1 + i * 0.9);
      bale.rotation.z = Math.PI / 2;
    }
    if (b.kind === 'henhouse') {
      box(0.5, 0.65, 0.04, '#352c24', 1, 0.33, front + 0.09);
      const ramp = box(0.7, 0.08, 1.2, '#826c4a', 1, 0.13, front + 0.6);
      ramp.rotation.x = -0.2;
      for (let i = 0; i < 5; i++)
        box(0.68, 0.03, 0.06, '#b99e70', 1, 0.2 - i * 0.035, front + 0.2 + i * 0.22);
    }
  }
  if (b.kind === 'scripted' && b.style) {
    // The curious-tree business is a nursery: a compact potting house and one specimen.
    cylinder(0.3, 4.5, '#74624b', 4.5, 2.25, -1);
    for (const [x, y, z, r] of [
      [4.5, 5, -1, 1.7],
      [3.6, 4.4, -1.5, 1.2],
      [5.5, 4.5, -0.7, 1.2],
    ])
      mesh(new T.IcosahedronGeometry(r, 1), '#607548', x, y, z);
  }
  if (b.kind === 'starport') {
    root.add(spaceportModel());
    box(main.width + 0.2, 0.32, main.depth + 0.2, '#517b7e', 0, main.eaves, 0);
    for (const x of [-5, -3, -1, 1, 3, 5]) box(0.045, 2.7, 0.04, '#829d9c', x, 1.4, front);
    const tower = plan.volumes[1];
    for (const side of [-1, 1])
      box(
        tower.width + 0.05,
        0.75,
        0.08,
        '#4e777a',
        tower.x,
        tower.eaves - 1,
        tower.z + (side * tower.depth) / 2,
      );
    cylinder(0.045, 1.6, '#596861', tower.x, tower.eaves + 0.9, tower.z);
    const dish = mesh(
      new T.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      '#d3d4c6',
      tower.x,
      tower.eaves + 0.6,
      tower.z,
    );
    dish.rotation.x = -0.7;
    for (const x of [-4, 4]) box(0.18, 2.2, 0.18, '#657d73', x, 1.1, front + 0.7);
    // Cargo hangar, roller shutters, wall ribs and roof plant distinguish the port
    // from village buildings. These static parts share its existing scenery batches.
    const hangar = plan.volumes[2],
      face = hangar.z + hangar.depth / 2 + 0.07;
    for (const dx of [-7, 7]) {
      box(10, 9.5, 0.18, '#293c42', hangar.x + dx, 4.75, face);
      for (let y = 0.4; y < 9.4; y += 0.55)
        box(9.7, 0.065, 0.12, '#637477', hangar.x + dx, y, face + 0.12);
      box(10.5, 0.3, 0.5, '#bfa65c', hangar.x + dx, 9.8, face + 0.2);
    }
    for (let x = -hangar.width / 2; x <= hangar.width / 2; x += 2)
      box(
        0.14,
        hangar.eaves,
        0.18,
        '#737f80',
        hangar.x + x,
        hangar.eaves / 2,
        hangar.z - hangar.depth / 2 - 0.1,
      );
    for (let z = -10; z <= 10; z += 2)
      box(
        0.18,
        hangar.eaves,
        0.12,
        '#737f80',
        hangar.x + hangar.width / 2 + 0.1,
        hangar.eaves / 2,
        hangar.z + z,
      );
    for (const x of [-6, 5]) {
      box(3.5, 1.4, 2.8, '#6c7675', x, main.eaves + 0.9, -3);
      for (let i = 0; i < 6; i++)
        box(3.2, 0.07, 0.08, '#303e40', x, main.eaves + 0.5 + i * 0.18, -1.55);
    }
    // A loading canopy and pipe bridge sit inside the shared collision volumes.
    box(28.2, 0.25, 2.2, '#6a7b7b', hangar.x, 10, face + 0.4);
    for (const x of [17, 41]) box(0.25, 10, 0.25, '#929b95', x, 5, face + 1);
    for (const x of [1.8, 2.6]) cylinder(0.25, 7.5, '#858f8c', x, 3.75, -22);
  }
  return root;
}
