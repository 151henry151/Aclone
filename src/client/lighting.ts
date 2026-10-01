// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { calendar, eveningLights, sunAt } from '../shared/environment';
import type { World } from '../shared/types';
type Source = {
  pane: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  building?: string;
  position: T.Vector3;
  target: T.Vector3;
};
/** Fixed light budget, regardless of village size. Windows shine outward, not through their house. */
export class TownLighting {
  readonly group = new T.Group();
  private sources: Source[] = [];
  private pool: T.SpotLight[];
  constructor(limit = 12) {
    this.pool = Array.from({ length: limit }, () => {
      const light = new T.SpotLight('#ffcd83', 0, 22, 1.12, 0.72, 1.4);
      this.group.add(light, light.target);
      return light;
    });
  }
  reset(root: T.Group) {
    this.sources = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof T.Mesh) || !o.userData.lightSource) return;
      const pane = o as Source['pane'],
        position = o.getWorldPosition(new T.Vector3());
      const street = o.userData.lightSource === 'street';
      const out = street
        ? new T.Vector3(0, -1, 0)
        : new T.Vector3(0, -0.35, 1).transformDirection(o.matrixWorld);
      this.sources.push({
        pane,
        position: position.clone().addScaledVector(out, 0.24),
        target: position.clone().addScaledVector(out, 6),
        building: street ? undefined : o.userData.lightSource,
      });
    });
    // One dynamic pane draw per building, rather than one per window.
    const batches = new Map<string, Source[]>();
    for (const source of this.sources) {
      const key = source.building ?? 'street';
      const list = batches.get(key) ?? [];
      list.push(source);
      batches.set(key, list);
    }
    for (const list of batches.values()) {
      const geometries = list.map((s) => s.pane.geometry.clone().applyMatrix4(s.pane.matrixWorld));
      const pane = new T.Mesh(mergeGeometries(geometries)!, list[0].pane.material.clone());
      root.add(pane);
      for (const source of list) {
        source.pane.removeFromParent();
        source.pane.geometry.dispose();
        source.pane.material.dispose();
        source.pane = pane;
      }
      geometries.forEach((g) => g.dispose());
    }
  }
  update(w: World, focus: T.Vector3) {
    const day = calendar(w).dayOfYear,
      night = 1 - sunAt(w.settings.time, day).daylight;
    const byId = new Map(w.buildings.map((b) => [b.id, b]));
    const active = this.sources
      .filter((s) => {
        const b = s.building && byId.get(s.building);
        const lit = s.building ? !!b && eveningLights(b, w.settings.time, day) : night > 0.8;
        s.pane.material.emissive.set('#ffca72');
        s.pane.material.emissiveIntensity = lit ? 2 : 0;
        return lit;
      })
      .sort((a, b) => a.position.distanceToSquared(focus) - b.position.distanceToSquared(focus));
    this.group.visible = active.length > 0;
    const counts = new Map<string, number>();
    const nearby = active.filter((s) => {
      const key = s.building ?? String(s.position.z);
      const n = counts.get(key) ?? 0;
      counts.set(key, n + 1);
      return n < 3;
    });
    this.pool.forEach((light, i) => {
      const source = nearby[i];
      light.intensity = source ? (source.building ? 65 : 55) : 0;
      if (source) {
        // Shallower distance falloff keeps the wide skirt useful between lamps.
        // Reduce output to retain the existing brightness directly underneath.
        // Reapply both profiles: a pooled lamp may have been a window last frame.
        const street = !source.building;
        light.distance = street ? 70 : 22;
        light.angle = street ? 1.55 : 1.12;
        light.penumbra = street ? 0.18 : 0.72;
        light.decay = street ? 0.8 : 1.4;
        light.position.copy(source.position);
        light.target.position.copy(source.target);
      }
    });
  }
}
