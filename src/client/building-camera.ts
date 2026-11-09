// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';

/** Cached structural volumes keep a truck's exterior view out of nearby halls.
 * No triangle raycasting or per-frame geometry traversal is needed. */
export class BuildingCamera {
  private ray = new T.Ray();
  private box = new T.Box3();
  private hit = new T.Vector3();
  clear(
    target: T.Vector3,
    camera: Pick<T.PerspectiveCamera, 'position' | 'near'>,
    buildings: readonly T.Group[],
    padding = 0,
  ) {
    for (const model of buildings) {
      const volumes = model.userData.cameraVolumes as T.Box3[] | undefined;
      if (!volumes?.length) continue;
      model.updateMatrix();
      for (const volume of volumes) {
        this.box.copy(volume).applyMatrix4(model.matrix);
        const reach = target.distanceTo(camera.position);
        if (!reach || this.box.containsPoint(target)) continue;
        // Keep the vehicle body visible as well as the camera look-at point.
        this.box.expandByScalar(padding);
        this.ray.origin.copy(target);
        this.ray.direction.copy(camera.position).sub(target).divideScalar(reach);
        const hit = this.ray.intersectBox(this.box, this.hit);
        if (!hit || target.distanceTo(hit) >= reach) continue;
        const top = this.box.max.y + camera.near * 2;
        this.box.min.y = -Infinity;
        this.box.max.y = Infinity;
        if (this.box.containsPoint(target)) {
          camera.position.y = Math.max(camera.position.y, top);
          continue;
        }
        this.ray.intersectBox(this.box, this.hit);
        const fraction = target.distanceTo(this.hit) / reach;
        if (fraction <= 0) continue;
        const lifted = target.y + (top - target.y) / fraction;
        if (lifted <= target.y + reach) camera.position.y = Math.max(camera.position.y, lifted);
        else {
          // Beside a tall wall, keep useful distance on the driver's outward side.
          const dx = target.x - (this.box.min.x + this.box.max.x) / 2;
          const dz = target.z - (this.box.min.z + this.box.max.z) / 2;
          const length = Math.hypot(dx, dz);
          const horizontal = Math.hypot(camera.position.x - target.x, camera.position.z - target.z);
          if (length) {
            camera.position.x = target.x + (dx / length) * horizontal;
            camera.position.z = target.z + (dz / length) * horizontal;
          }
        }
      }
    }
  }
}
