// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { createHuman, seatHuman, type HumanFigure } from './human';
type Fade = { mesh: T.Mesh; original: T.Material | T.Material[]; copies: T.Material[] };
type Sequence = { human: HumanFigure; fades: Fade[]; driver?: T.Object3D; driverVisible?: boolean };
/** The shared clock and the real driver's model anchor keep every observer in step. */
export class VehicleMountScene {
  readonly group = new T.Group();
  private sequences = new Map<string, Sequence>();
  update(w: World, time: number, players: Map<string, T.Group>, parked: T.Group, dt: number) {
    const alive = new Set<string>();
    for (const p of Object.values(w.players)) {
      const a = p.task?.mount ?? p.task?.arrival?.mount;
      if (!a || time >= a.end) continue;
      alive.add(p.id);
      const vehicle = a.mounting
        ? players.get(p.id)
        : parked.children.find((g) => g.userData.parkedVehicle === `${p.id}:${a.slot}`);
      const driver = vehicle?.userData.driver as T.Object3D | undefined;
      let s = this.sequences.get(p.id);
      if (!s) {
        const human = createHuman();
        s = { human, fades: [], driver, driverVisible: driver?.visible };
        this.sequences.set(p.id, s);
        this.group.add(human.group);
        human.group.userData.mountingPlayer = p.id;
        for (const root of [human.group, driver])
          root?.traverse((o) => {
            if (!(o instanceof T.Mesh)) return;
            const original = o.material,
              copies = (Array.isArray(original) ? original : [original]).map((m) => {
                const c = m.clone();
                c.transparent = true;
                return c;
              });
            o.material = Array.isArray(original) ? copies : copies[0];
            s!.fades.push({ mesh: o, original, copies });
          });
      }
      const progress = T.MathUtils.clamp((time - a.start) / (a.end - a.start), 0, 1),
        f = a.mounting ? progress : 1 - progress;
      vehicle?.updateWorldMatrix(true, true);
      const seat =
        driver?.getWorldPosition(new T.Vector3()) ??
        new T.Vector3(a.vehicle.x, a.vehicle.y, a.vehicle.z);
      const eased = T.MathUtils.smoothstep(f, 0, 0.85);
      s.human.group.position.copy(new T.Vector3(a.door.x, a.door.y, a.door.z).lerp(seat, eased));
      s.human.group.rotation.y = a.vehicle.heading;
      s.human.animate(0, dt);
      // Lift a knee onto the step, then bring the other leg across the seat.
      const lift = Math.sin(Math.PI * T.MathUtils.clamp(f / 0.85, 0, 1));
      const thigh = s.human.group.getObjectByName('thigh--1'),
        shin = s.human.group.getObjectByName('shin--1');
      if (thigh) thigh.rotation.x = -lift * 1.2;
      if (shin) shin.rotation.x = lift * 1.4;
      seatHuman(s.human.group, eased);
      const seatOpacity = T.MathUtils.smoothstep(f, 0.7, 1);
      if (driver) driver.visible = seatOpacity > 0;
      s.human.group.visible = seatOpacity < 1;
      for (const fade of s.fades) {
        const walking = (() => {
          let o: T.Object3D | null = fade.mesh;
          while (o) {
            if (o === s!.human.group) return true;
            o = o.parent;
          }
          return false;
        })();
        for (const material of fade.copies)
          material.opacity = walking ? 1 - seatOpacity : seatOpacity;
      }
      const actor = players.get(p.id);
      if (!a.mounting && actor) actor.visible = false;
    }
    for (const [id, s] of this.sequences)
      if (!alive.has(id)) {
        for (const f of s.fades) {
          f.mesh.material = f.original;
          for (const m of f.copies) m.dispose();
        }
        if (s.driver) s.driver.visible = s.driverVisible ?? true;
        s.human.group.removeFromParent();
        this.sequences.delete(id);
        const actor = players.get(id),
          p = w.players[id];
        if (actor && p) actor.visible = !p.inside && !p.atHome;
      }
  }
}
