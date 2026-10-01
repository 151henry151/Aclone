// SPDX-License-Identifier: GPL-3.0-or-later
import type { Object3D } from 'three';
/** Bake static local/world matrices once, while explicitly preserving animated
 * subtrees such as mill blades. Rebuilding the town creates fresh objects. */
export function freezeScenery(root: Object3D, animated: Object3D[]) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.matrixWorldAutoUpdate = false;
  });
  for (const branch of animated) {
    branch.matrixAutoUpdate = true;
    branch.traverse((o) => {
      o.matrixWorldAutoUpdate = true;
    });
  }
}
