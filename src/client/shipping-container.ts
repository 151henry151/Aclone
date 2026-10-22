// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { BuildingPlan } from '../shared/building-shapes';
import { finishSurface, finishMaterial } from './building-finishes';
/** Corrugation and door seams are textured; only the box frame and locking bars add geometry. */
export function shippingContainers(plan: BuildingPlan) {
  const root = new T.Group();
  let host = root;
  const color = plan.finish === 'metal' ? plan.wall : '#9f4938';
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, tint = color) => {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color: tint, roughness: 0.8 }),
    );
    m.position.set(x, y, z);
    host.add(m);
    return m;
  };
  for (const v of plan.volumes) {
    host = new T.Group();
    host.position.set(v.x, 0, v.z);
    root.add(host);
    const across = v.width > v.depth;
    if (across) host.rotation.y = Math.PI / 2;
    const w = across ? v.depth : v.width,
      d = across ? v.width : v.depth,
      h = v.eaves,
      x = 0,
      z = 0;
    finishSurface(box(w, h, d, x, h / 2, z), 'metal', color).userData.snowCap = 0.75;
    for (const dx of [-1, 1])
      for (const dz of [-1, 1])
        box(0.13, h + 0.04, 0.13, x + dx * (w / 2 - 0.045), h / 2, z + dz * (d / 2 - 0.045));
    for (const y of [0.08, h - 0.08]) {
      box(w, 0.16, 0.13, x, y, z + d / 2);
      box(w, 0.16, 0.13, x, y, z - d / 2);
      for (const dx of [-1, 1]) box(0.13, 0.16, d, x + (dx * w) / 2, y, z);
    }
    for (const side of [-1, 1]) {
      const panel = new T.Mesh(
        new T.PlaneGeometry(w * 0.46, h - 0.32),
        finishMaterial('roller-door', color),
      );
      panel.position.set(x + side * w * 0.24, h / 2, z + d / 2 + 0.071);
      host.add(panel);
      for (const offset of [-0.12, 0.12]) {
        box(
          0.035,
          h - 0.5,
          0.035,
          x + side * w * 0.24 + offset,
          0.5 * h,
          z + d / 2 + 0.1,
          '#b3b9b6',
        );
        box(0.15, 0.045, 0.055, x + side * w * 0.24 + offset, 0.95, z + d / 2 + 0.12, '#9ca8a7');
      }
    }
    const label = box(0.65, 0.18, 0.012, x - w * 0.23, h - 0.42, z + d / 2 + 0.09, '#e1d8bb');
    label.userData.containerPlate = true;
  }
  return root;
}
