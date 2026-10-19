// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { BuildingPlan } from '../shared/building-shapes';
/** A residential marker, not a simulated mail service. Keep it outside the frontmost wing. */
export function cottageMailbox(plan: BuildingPlan) {
  const front = plan.volumes.reduce(
    (a, v) => (v.z + v.depth / 2 > a.z + a.depth / 2 ? v : a),
    plan.volumes[0],
  );
  const root = new T.Group();
  root.userData.mailbox = true;
  root.position.set(front.x - front.width * 0.3, 0, front.z + front.depth / 2 + 0.85);
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    m.position.set(x, y, z);
    root.add(m);
  };
  box(0.12, 1.05, 0.12, '#89734f', 0, 0.525, 0);
  box(0.5, 0.32, 0.38, plan.trim, 0, 1.08, 0);
  box(0.54, 0.06, 0.42, '#56655c', 0, 1.27, 0);
  box(0.29, 0.025, 0.015, '#262e2a', 0, 1.15, 0.198);
  box(0.025, 0.28, 0.035, '#a45c43', 0.28, 1.28, 0);
  box(0.15, 0.1, 0.035, '#b66a4a', 0.34, 1.39, 0);
  return root;
}
