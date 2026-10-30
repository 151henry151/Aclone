// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { trailerDefs } from '../shared/trailers';
import { createTrailer } from './trailer-model';
import { vehicleGround } from './vehicle-ground';
/** Fixed small models, rebuilt only when the visible load changes. */
export class TrailerScene {
  readonly group = new T.Group();
  private models = new Map<
    string,
    { model: T.Group; key: string; heading: number; x: number; z: number }
  >();
  update(
    w: World,
    players: Map<string, T.Group>,
    sample: (x: number, z: number) => number,
    dt: number,
  ) {
    const alive = new Set<string>();
    for (const t of Object.values(w.trailers ?? {})) {
      alive.add(t.id);
      const def = trailerDefs[t.kind];
      const key = t.kind + JSON.stringify(t.cargo);
      let entry = this.models.get(t.id);
      if (!entry || entry.key !== key) {
        if (entry) this.remove(entry.model);
        const model = createTrailer(t.kind, t.cargo);
        this.group.add(model);
        entry = {
          model,
          key,
          heading: entry?.heading ?? t.heading,
          x: entry?.x ?? t.x,
          z: entry?.z ?? t.z,
        };
        this.models.set(t.id, entry);
      }
      const e = entry,
        model = e.model,
        tractor = t.attached ? players.get(t.attached) : undefined;
      const alpha = 1 - Math.exp(-Math.min(0.1, dt) * 12);
      e.heading +=
        Math.atan2(Math.sin(t.heading - e.heading), Math.cos(t.heading - e.heading)) * alpha;
      let x = t.x,
        z = t.z;
      if (tractor) {
        const forward = new T.Vector3(0, 0, 1).applyQuaternion(tractor.quaternion);
        const h = Math.atan2(forward.x, forward.z);
        x = tractor.position.x - Math.sin(h) * 2.7 - Math.sin(e.heading) * (def.length / 2 + 1.4);
        z = tractor.position.z - Math.cos(h) * 2.7 - Math.cos(e.heading) * (def.length / 2 + 1.4);
      } else {
        x = e.x + (x - e.x) * alpha;
        z = e.z + (z - e.z) * alpha;
      }
      const distance = (x - e.x) * Math.sin(e.heading) + (z - e.z) * Math.cos(e.heading);
      e.x = x;
      e.z = z;
      const contacts = [-def.width * 0.4, def.width * 0.4].flatMap((cx) =>
        [-def.length * 0.4, def.length * 0.4].map((cz) => new T.Vector3(cx, 0, cz)),
      );
      const ground = vehicleGround(x, z, e.heading, sample, contacts);
      model.position.set(x, ground.y, z);
      model.rotation.copy(ground.rotation);
      for (const wheel of model.userData.wheels as T.Group[]) wheel.rotation.x += distance / 0.5;
      (model.userData.tailLights as T.MeshStandardMaterial).emissiveIntensity =
        t.attached && w.players[t.attached]?.lights ? 1.8 : 0.15;
    }
    for (const [id, e] of this.models)
      if (!alive.has(id)) {
        this.remove(e.model);
        this.models.delete(id);
      }
  }
  private remove(model: T.Group) {
    const materials = new Set<T.Material>();
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    for (const m of materials) m.dispose();
    this.group.remove(model);
  }
}
