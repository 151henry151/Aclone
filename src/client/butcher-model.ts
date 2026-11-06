// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building } from '../shared/types';
import type { BuildingPlan } from '../shared/building-shapes';
export function butcherDetails(root: T.Group, b: Building, plan: BuildingPlan) {
  const ramp = plan.waterfront![0],
    group = new T.Group();
  group.name = 'Livestock loading ramp';
  root.add(group);
  const wood = new T.MeshStandardMaterial({ color: '#857558', roughness: 0.95 }),
    metal = new T.MeshStandardMaterial({ color: '#697c7b', roughness: 0.8, metalness: 0.2 }),
    cold = new T.MeshStandardMaterial({ color: '#bbcaca', roughness: 0.55, metalness: 0.15 });
  const box = (
    host: T.Object3D,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    host.add(mesh);
    return mesh;
  };
  const start = ramp.z - ramp.depth / 2;
  for (let i = 0; i < 12; i++) {
    const height = 0.6 * (1 - i / 12);
    box(
      group,
      wood,
      ramp.x,
      height / 2,
      start + ((i + 0.5) * ramp.depth) / 12,
      ramp.width - 0.2,
      height,
      ramp.depth / 12 - 0.02,
    );
  }
  for (const side of [-1, 1]) {
    const x = ramp.x + side * (ramp.width / 2 - 0.1);
    for (let i = 0; i < 4; i++) {
      const z = start + (i * ramp.depth) / 3;
      box(group, metal, x, 0.8 - i * 0.1, z, 0.08, 1.6 - i * 0.2, 0.08);
    }
    for (const y of [0.75, 1.35]) {
      const rail = box(group, metal, x, y, ramp.z, 0.08, 0.08, ramp.depth);
      rail.rotation.x = Math.atan2(0.6, ramp.depth);
    }
  }
  const annex = plan.volumes[1];
  if (annex) {
    const front = annex.z + annex.depth / 2;
    const door = box(root, cold, annex.x, 1.25, front + 0.025, 1.7, 2.45, 0.04);
    door.name = 'Insulated cold-room door';
    box(root, metal, annex.x + 0.55, 1.15, front + 0.08, 0.08, 0.6, 0.06);
  }
  if (b.architecture === 'model-4') {
    const main = plan.volumes[0],
      front = main.z + main.depth / 2 + 0.025;
    const tiles = new T.MeshStandardMaterial({ color: '#e0e8df', roughness: 0.35 });
    for (const side of [-1, 1]) {
      box(root, tiles, side * main.width * 0.34, 0.65, front, main.width * 0.27, 1.25, 0.04);
      for (let i = 0; i < 3; i++)
        box(
          root,
          metal,
          side * main.width * 0.34,
          0.25 + i * 0.4,
          front + 0.025,
          main.width * 0.27,
          0.015,
          0.01,
        );
    }
  }
}
