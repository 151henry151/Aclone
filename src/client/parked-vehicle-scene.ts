import { batchParkedBody } from './parked-batching';
import { creatorModel, disposeCreator } from './creator-model';
import { vehicleGround } from './vehicle-ground';
import { label } from './labels';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { vehicleDef } from '../shared/vehicle-config';
import { configureVehicleVisual } from './vehicle-custom';
export class ParkedVehicleScene {
  readonly group = new T.Group();
  private models = new Map<string, { key: string; model: T.Group; bounds: T.Box3 }>();
  private cameraRay = new T.Ray();
  private cameraBox = new T.Box3();
  private cameraHit = new T.Vector3();
  constructor(
    private build: (slot: number, name: string, paint?: string) => T.Group,
    private finish?: (model: T.Group) => void,
  ) {}
  update(w: World, x: number, z: number, range: number, ground?: (x: number, z: number) => number) {
    const alive = new Set<string>();
    for (const [id, v] of Object.entries(w.parkedVehicles ?? {})) {
      if (v.inside) continue;
      alive.add(id);
      const name = `${w.players[v.owner]?.name ?? v.ownerName ?? v.owner}'s ${vehicleDef(w, v.slot).name}`;
      const visual = w.creator?.models.find((m) => m.id === w.creator?.vehicleModels[v.slot]);
      const key = JSON.stringify([v.slot, v.paint, name, w.vehicleTuning?.[v.slot], visual]);
      let entry = this.models.get(id);
      if (!entry || entry.key !== key) {
        if (entry) this.remove(entry.model);
        const model = visual ? creatorModel(visual, w) : this.build(v.slot, name, v.paint);
        if (visual && typeof document !== 'undefined') {
          const tag = label(name);
          tag.position.y = new T.Box3().setFromObject(model).max.y + 1;
          model.add(tag);
        }
        configureVehicleVisual(model, w, v.slot);
        model.userData.parkedVehicle = id;
        model.userData.engineRunning = false;
        const copies = new Map<T.Material, T.Material>();
        model.traverse((o) => {
          if (o.userData.driver instanceof T.Object3D) o.userData.driver.visible = false;
          if (o instanceof T.Light) o.visible = false;
          if (o instanceof T.Sprite) {
            o.material = o.material.clone();
            o.material.sizeAttenuation = false;
            o.scale.multiplyScalar(0.035);
          }
          if (o instanceof T.Mesh) {
            const dark = (m: T.Material) => {
              if (!(m instanceof T.MeshStandardMaterial) || m.emissiveIntensity === 0) return m;
              let copy = copies.get(m) as T.MeshStandardMaterial | undefined;
              if (!copy) {
                copy = m.clone();
                copy.userData = { ...m.userData, shared: false };
                copy.emissiveIntensity = 0;
                copies.set(m, copy);
              }
              return copy;
            };
            o.material = Array.isArray(o.material) ? o.material.map(dark) : dark(o.material);
          }
        });
        if (!visual) batchParkedBody(model);
        this.finish?.(model);
        model.updateMatrixWorld(true);
        const bounds = new T.Box3();
        model.traverseVisible((o) => {
          if (!(o instanceof T.Mesh)) return;
          o.geometry.computeBoundingBox();
          if (o.geometry.boundingBox)
            bounds.union(this.cameraBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
        });
        bounds.applyMatrix4(model.matrixWorld.clone().invert());
        entry = { key, model, bounds };
        this.models.set(id, entry);
        this.group.add(model);
      }
      entry.model.position.set(v.x, v.y, v.z);
      entry.model.rotation.set(0, v.heading, 0, 'YXZ');
      if (
        ground &&
        (entry.model.userData.wheels || entry.model.userData.contacts) &&
        [0, 1, 4].includes(vehicleDef(w, v.slot).mode)
      ) {
        const pose = vehicleGround(v.x, v.z, v.heading, ground, entry.model.userData.contacts);
        entry.model.rotation.copy(pose.rotation);
        entry.model.position.y = pose.y;
      }
      entry.model.visible = Math.hypot(x - v.x, z - v.z) <= range;
    }
    for (const [id, entry] of this.models)
      if (!alive.has(id)) {
        this.remove(entry.model);
        this.models.delete(id);
      }
  }
  /** Lift the walking chase view over a parked body without entering the walker. */
  clearCamera(target: T.Vector3, camera: Pick<T.PerspectiveCamera, 'position' | 'near'>) {
    for (const { model, bounds } of this.models.values()) {
      if (!model.visible || bounds.isEmpty()) continue;
      const reach = target.distanceTo(camera.position);
      if (reach === 0) return;
      this.cameraRay.origin.copy(target);
      this.cameraRay.direction.copy(camera.position).sub(target).divideScalar(reach);
      model.updateMatrix();
      this.cameraBox.copy(bounds).applyMatrix4(model.matrix);
      if (this.cameraBox.containsPoint(target)) continue;
      const hit = this.cameraRay.intersectBox(this.cameraBox, this.cameraHit);
      if (!hit || target.distanceTo(hit) >= reach) continue;
      const top = this.cameraBox.max.y + camera.near * 2;
      // Find the near horizontal edge; clear that edge, not just the lens position.
      this.cameraBox.min.y = -Infinity;
      this.cameraBox.max.y = Infinity;
      if (this.cameraBox.containsPoint(target)) continue;
      this.cameraRay.intersectBox(this.cameraBox, this.cameraHit);
      const fraction = target.distanceTo(this.cameraHit) / reach;
      if (fraction > 0) {
        const lifted = target.y + (top - target.y) / fraction;
        if (lifted <= target.y + reach) camera.position.y = Math.max(camera.position.y, lifted);
        else {
          // Beside the door, a vertical solution tends to infinity. Keep the
          // ordinary chase distance on the pedestrian's outward side instead.
          const dx = target.x - (this.cameraBox.min.x + this.cameraBox.max.x) / 2;
          const dz = target.z - (this.cameraBox.min.z + this.cameraBox.max.z) / 2;
          const horizontal = Math.hypot(camera.position.x - target.x, camera.position.z - target.z);
          const length = Math.hypot(dx, dz);
          if (length > 0) {
            camera.position.x = target.x + (dx / length) * horizontal;
            camera.position.z = target.z + (dz / length) * horizontal;
          }
        }
      }
    }
  }
  private remove(model: T.Group) {
    if (model.userData.creatorModel) {
      disposeCreator(model);
      model.removeFromParent();
      return;
    }
    const materials = new Set<T.Material>();
    model.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Sprite) {
        if (!o.geometry.userData.shared) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (!m.userData.shared) materials.add(m);
      }
    });
    for (const m of materials) m.dispose();
    model.removeFromParent();
  }
}
