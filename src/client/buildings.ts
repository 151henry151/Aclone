// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { buildingPlan, type BuildingVolume } from '../shared/building-shapes';
import type { Building } from '../shared/types';
import { surface } from './materials';

/** Original metre-scale village kit. Door/window dimensions never scale with the shell. */
export function buildingModel(b: Building, finish: typeof surface = surface) {
  const root = new T.Group(),
    plan = buildingPlan(b);
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
    if (plan.siding === 'wood') {
      const material = m.material as T.MeshStandardMaterial;
      material.color.set(plan.wall);
      return m;
    }
    return finish(m, 'stone', 3, b.construction ? '#a6a18d' : plan.wall);
  }
  function roof(v: BuildingVolume) {
    const w = v.width / 2 + 0.28,
      d = v.depth / 2 + 0.28,
      h = v.rise;
    if (v.roof === 'flat') {
      finish(
        box(v.width + 0.35, 0.18, v.depth + 0.35, '#ffffff', v.x, v.eaves + 0.08, v.z),
        'roof',
        3,
        '#a7b1ad',
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
      const top = finish(
        box(w * 2, 0.16, Math.hypot(d * 2, h), '#ffffff', v.x, v.eaves + h / 2, v.z),
        'roof',
        3,
        '#b5bfc0',
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
        const wall = finish(
          mesh(g, '#ffffff', v.x + (side * v.width) / 2, v.eaves, v.z),
          'stone',
          3,
          plan.wall,
        );
        (wall.material as T.Material).side = T.DoubleSide;
      }
      finish(
        box(v.width, h, 0.12, '#ffffff', v.x, v.eaves + h / 2, v.z - v.depth / 2),
        'stone',
        3,
        plan.wall,
      );
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
    const top = finish(mesh(geometry, '#ffffff', v.x, v.eaves, v.z), 'roof', 3, '#dadcdb');
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
        if (plan.siding === 'wood') {
          for (let y = 0.2; y < h - 0.1; y += 0.22) {
            const width = v.width * (1 - y / h);
            box(
              width,
              0.025,
              0.025,
              plan.trim,
              v.x,
              v.eaves + y,
              v.z + side * (v.depth / 2 + 0.045),
            );
          }
        }
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
    const group = new T.Group();
    const start = root.children.length;
    box(width + 0.18, 1.36, 0.16, '#e2d5b8', 0, 0, 0);
    const pane = box(width, 1.16, 0.18, '#405e62', 0, 0, 0.03);
    pane.material.roughness = 0.24;
    box(0.065, 1.2, 0.08, '#e2d5b8', 0, 0, 0.15);
    box(width, 0.065, 0.08, '#e2d5b8', 0, 0, 0.15);
    box(width + 0.28, 0.12, 0.32, '#bcb49c', 0, -0.7, 0.06);
    for (const child of root.children.slice(start)) group.add(child);
    group.position.set(x, y, z);
    group.rotation.y = angle;
    root.add(group);
  }
  function door(x: number, z: number) {
    box(1.17, plan.doorHeight + 0.13, 0.18, '#c9bd9d', x, (plan.doorHeight + 0.13) / 2, z);
    box(0.96, plan.doorHeight, 0.21, plan.trim, x, plan.doorHeight / 2, z + 0.02);
    for (const y of [0.55, 1.45]) box(0.69, 0.65, 0.04, '#46574b', x, y, z + 0.145);
    box(0.06, 0.06, 0.08, '#d6b764', x + 0.31, 1.02, z + 0.19);
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
      for (const x of [-0.9, 0.9]) box(0.13, 2.2, 0.13, '#6b5740', x, 1.1, 0);
      box(2, 0.95, 0.16, '#796345', 0, 1.6, 0);
      for (const x of [-0.55, 0, 0.55]) box(0.4, 0.6, 0.02, '#e2d5af', x, 1.6, 0.095);
      roof(main);
    } else if (b.kind === 'portal') {
      for (const x of [-1.3, 1.3]) finish(box(0.4, 3.8, 0.7, '#ffffff', x, 1.9, 0), 'stone', 3);
      box(3, 0.35, 0.75, plan.trim, 0, 3.8, 0);
      const ring = mesh(new T.TorusGeometry(1.15, 0.09, 8, 36), '#8cbbb8', 0, 2, 0);
      ring.scale.y = 1.35;
    } else if (b.kind === 'turret') {
      cylinder(1.1, 1.5, '#7f8575', 0, 0.75, 0);
      cylinder(0.75, 0.8, '#5b6762', 0, 1.9, 0);
      box(0.3, 0.3, 2, '#45504b', 0, 2.1, 0.8);
    } else {
      box(1.8, 1.1, 1.2, '#8a7250', 0, 0.55, 0);
      for (const x of [-0.7, 0.7]) box(0.12, 1.13, 1.23, '#51594b', x, 0.56, 0);
    }
    return root;
  }
  for (const v of plan.volumes) {
    wallFinish(box(v.width, v.eaves, v.depth, '#ffffff', v.x, v.eaves / 2, v.z));
    if (plan.siding === 'wood' && !b.construction) {
      for (let y = 0.22; y < v.eaves; y += 0.22)
        for (const side of [-1, 1]) {
          box(v.width, 0.025, 0.04, plan.trim, v.x, y, v.z + side * (v.depth / 2 + 0.015));
          box(0.04, 0.025, v.depth, plan.trim, v.x + side * (v.width / 2 + 0.015), y, v.z);
        }
    }
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
    roof(v);
  }
  if (b.construction) return root;
  const shed = [
    'garage',
    'farm',
    'sawmill',
    'warehouse',
    'shipyard',
    'factory',
    'forge',
    'workshop',
  ].includes(b.kind);
  if (shed) {
    const bays = ['garage', 'warehouse', 'factory', 'shipyard'].includes(b.kind)
      ? [-2.7, 2.7]
      : [0];
    for (const x of bays) {
      box(3.25, 3.18, 0.14, '#343f3a', x, 1.59, front);
      for (let i = 0; i < 9; i++) box(3.04, 0.05, 0.04, plan.trim, x, 0.25 + i * 0.34, front + 0.1);
      for (const side of [-1, 1])
        box(0.14, 3.3, 0.22, '#d0c2a3', x + side * 1.66, 1.65, front + 0.05);
      box(3.45, 0.18, 0.25, '#d0c2a3', x, 3.27, front + 0.05);
    }
    for (const z of [-2, 1.4]) window(main.width / 2 + 0.035, 2, z, 1.1, Math.PI / 2);
    if (b.kind === 'farm' || b.kind === 'sawmill') {
      // Timber siding and high hayloft doors distinguish agricultural buildings.
      for (let x = -main.width / 2 + 0.2; x < main.width / 2; x += 0.38)
        box(0.08, main.eaves, 0.05, plan.trim, x, main.eaves / 2, -main.depth / 2 - 0.04);
      box(1.4, 1.2, 0.08, plan.trim, 0, main.eaves + 0.45, front);
    }
  } else {
    door(0, b.kind === 'school' ? 4.76 : front);
    const xs = main.width > 10 ? [-4, -2, 2, 4] : [-main.width * 0.3, main.width * 0.3];
    for (const x of xs) window(x, 1.6, front);
    for (const side of [-1, 1])
      for (const z of [-main.depth * 0.26, main.depth * 0.26])
        window(side * (main.width / 2 + 0.035), 1.6, z, 1.05, (side * Math.PI) / 2);
    for (const x of [-main.width * 0.3, main.width * 0.3])
      window(x, 1.6, -main.depth / 2 - 0.035, 1.05, Math.PI);
    if (main.eaves > 4.8) {
      for (const x of [-main.width * 0.3, main.width * 0.3])
        window(x, 4.1, -main.depth / 2 - 0.035, 1.05, Math.PI);
      for (const x of [-main.width * 0.3, 0, main.width * 0.3]) window(x, 4.1, front);
      for (const side of [-1, 1])
        window(side * (main.width / 2 + 0.035), 4.1, 0, 1.05, (side * Math.PI) / 2);
    }
  }
  if (['home', 'bakery', 'pub', 'workhouse'].includes(b.kind))
    chimney(-main.width * 0.3, -main.depth * 0.22, main.eaves + main.rise + 0.5);
  if (['market', 'shop', 'bakery'].includes(b.kind)) {
    const width = main.width - 0.5;
    for (let i = 0; i < 12; i++) {
      const awning = box(
        width / 12,
        0.09,
        1.7,
        i % 2 ? '#d9cba3' : plan.trim,
        -width / 2 + ((i + 0.5) * width) / 12,
        2.6,
        front + 0.7,
      );
      awning.rotation.x = 0.12;
      box(
        width / 12,
        0.22,
        0.08,
        i % 2 ? '#d9cba3' : plan.trim,
        -width / 2 + ((i + 0.5) * width) / 12,
        2.38,
        front + 1.53,
      );
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
    const entrance = b.kind === 'school' ? 4.76 : front;
    for (const x of [-1.3, 1.3]) cylinder(0.14, 2.45, '#d8d2bd', x, 1.225, entrance + 0.8);
    box(3.2, 0.2, 1.5, '#c5c4b3', 0, 2.55, entrance + 0.65);
    if (b.kind === 'school') {
      box(1.2, 1.2, 1.2, '#c6c3a9', 0, 5.45, -1);
      mesh(new T.ConeGeometry(0.95, 0.8, 4), '#747b71', 0, 6.4, -1).rotation.y = Math.PI / 4;
      cylinder(0.24, 0.45, '#998350', 0, 5.6, -0.32);
    }
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
  if (b.kind === 'starport') {
    const tower = plan.volumes[1];
    for (const side of [-1, 1])
      box(
        tower.width + 0.05,
        0.75,
        0.08,
        '#4e777a',
        tower.x,
        5.9,
        tower.z + (side * tower.depth) / 2,
      );
    cylinder(0.045, 1.6, '#596861', tower.x, 7.6, tower.z);
    const dish = mesh(
      new T.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      '#d3d4c6',
      tower.x,
      7.25,
      tower.z,
    );
    dish.rotation.x = -0.7;
    for (const x of [-4, 4]) box(0.18, 2.2, 0.18, '#657d73', x, 1.1, front + 0.7);
  }
  return root;
}
