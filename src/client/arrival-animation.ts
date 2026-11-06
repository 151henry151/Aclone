import { arrivalDoorOpenness } from '../shared/arrival';
import { buildingEntry } from '../shared/parking-site';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building, World } from '../shared/types';
import { parkingRules } from '../shared/parking-rules';
/** A short open plateau lets the walker cross an already open doorway. */
export function animateArrivalDoors(root: T.Group, w: World, b: Building, time: number) {
  const doors = (root.userData.pedestrianDoors ?? []) as T.Group[];
  let openness = 0;
  for (const p of Object.values(w.players)) {
    const a = p.task?.arrival;
    if (a?.building !== b.id) continue;
    openness = Math.max(openness, arrivalDoorOpenness(a, time));
  }
  const entry = buildingEntry(b),
    dx = entry.x - b.x,
    dz = entry.z - b.z;
  const local = {
    x: dx * Math.cos(b.rotation) - dz * Math.sin(b.rotation),
    z: dx * Math.sin(b.rotation) + dz * Math.cos(b.rotation),
  };
  root.userData.arrivalBay = { ...local, openness };
  for (const pivot of doors) {
    const point = pivot.userData.doorPivot;
    const used = point && Math.hypot(point.x - local.x, point.z - local.z) < 0.25;
    pivot.rotation.y =
      (-(used ? openness : 0) * parkingRules(w.settings).arrivalDoorDegrees * Math.PI) / 180;
    pivot.updateMatrixWorld(true);
  }
}
