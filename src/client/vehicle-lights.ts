import { isTractor } from '../shared/tractors';
import defaults from '../../data/settings.json';
import { vehicleDef } from '../shared/vehicle-config';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Player, World } from '../shared/types';
import { LIFEBOAT } from '../shared/boat-rescue';
import { flarePosition, flareStrength } from './lifeboat-flare';
/** Automatic work illumination uses existing synchronized motion, not a second switch. */
function reversing(w: World, p: Player) {
  return (
    (w.settings.tractorReverseLights ?? defaults.tractorReverseLights) &&
    (w.settings.tractorReverseLightIntensity ?? defaults.tractorReverseLightIntensity) > 0 &&
    isTractor(p.vehicle) &&
    p.engine &&
    p.speed < 0 &&
    !p.atHome &&
    !p.hitch
  );
}
const reversePosition = new T.Vector3(),
  reverseTarget = new T.Vector3();
export function updateReverseLight(light: T.SpotLight, w: World, p: Player, root: T.Group) {
  light.intensity = 0;
  light.castShadow = false;
  if (!root.visible || !reversing(w, p)) return false;
  light.color.set('#fff4df');
  light.intensity =
    w.settings.tractorReverseLightIntensity ?? defaults.tractorReverseLightIntensity;
  light.distance = w.settings.tractorReverseLightRange ?? defaults.tractorReverseLightRange;
  light.angle = Math.PI / 3;
  light.penumbra = 0.65;
  light.decay = 1;
  if (root.userData.reverseLamp) reversePosition.copy(root.userData.reverseLamp);
  else reversePosition.set(0, 1.8, -1.8);
  // Aim behind the lamp itself, including short-range custom world settings.
  reverseTarget.set(0, 0, reversePosition.z - 10);
  light.position.copy(root.localToWorld(reversePosition));
  light.target.position.copy(root.localToWorld(reverseTarget));
  return true;
}
/** Materials remain per-vehicle, including after geometry batching. */
export function vehicleLamp(material: T.MeshStandardMaterial, intensity: number) {
  material.userData.vehicleLamp = { intensity, color: material.color.clone() };
  material.emissiveIntensity = 0;
  material.color.multiplyScalar(0.36);
  return material;
}
export function updateVehicleLamps(root: T.Object3D, on: boolean) {
  let lamps = root.userData.switchableLamps as T.MeshStandardMaterial[] | undefined;
  if (!lamps) {
    const unique = new Set<T.MeshStandardMaterial>();
    root.traverse((o) => {
      if (o instanceof T.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m.userData.vehicleLamp) unique.add(m);
    });
    lamps = root.userData.switchableLamps = [...unique];
  }
  for (const m of lamps) {
    m.emissiveIntensity = on ? m.userData.vehicleLamp.intensity : 0;
    m.color.copy(m.userData.vehicleLamp.color).multiplyScalar(on ? 1 : 0.36);
  }
}
/** A fixed, shadow-free pool makes nearby players' beams visible without one light per player.
 * Keep zero-intensity lamps in the scene to avoid compiling shaders every time somebody toggles. */
export class OtherVehicleLights {
  readonly group = new T.Group();
  readonly lights: T.SpotLight[] = [];
  readonly flares = [0, 1].map(() => new T.PointLight('#ff471b', 0, 9, 2));
  private point = new T.Vector3();
  constructor(limit = 2) {
    this.group.name = 'Vehicle headlights and bounded rescue flare lights';
    for (const flare of this.flares) {
      flare.castShadow = false;
      this.group.add(flare);
    }
    for (let i = 0; i < limit; i++) {
      const light = new T.SpotLight('#fff1b5', 0, 110, Math.PI / 3.5, 0.65, 1);
      light.castShadow = false;
      this.lights.push(light);
      this.group.add(light, light.target);
    }
  }
  update(w: World, models: Map<string, T.Group>, localId: string, eye: T.Vector3, time = 0) {
    const sources: { p: Player; root: T.Group; distance: number }[] = [];
    const rescues: { p: Player; root: T.Group; distance: number }[] = [];
    for (const [id, root] of models) {
      const p = w.players[id];
      if (!p) continue;
      if (p.vehicle === LIFEBOAT) {
        if (!p.atHome && !p.hitch && root.visible && root.userData.lifeboat?.userData.flare) {
          const distance = root.position.distanceTo(eye);
          if (id === localId || distance < 35) rescues.push({ p, root, distance });
        }
        continue;
      }
      updateVehicleLamps(root, !!p.lights && !p.atHome && !p.hitch);
      if (id === localId || (!p.lights && !reversing(w, p)) || p.atHome || p.hitch || !root.visible)
        continue;
      const distance = root.position.distanceTo(eye);
      if (distance < 140) sources.push({ p, root, distance });
    }
    rescues.sort(
      (a, b) => Number(b.p.id === localId) - Number(a.p.id === localId) || a.distance - b.distance,
    );
    for (const [i, light] of this.flares.entries()) {
      const rescue = rescues[i];
      light.intensity = rescue ? 16 * flareStrength(time) : 0;
      if (rescue) {
        light.userData.player = rescue.p.id;
        this.point.copy(flarePosition);
        light.position.copy(rescue.root.localToWorld(this.point));
      } else delete light.userData.player;
    }
    sources.sort((a, b) => a.distance - b.distance);
    for (const [i, light] of this.lights.entries()) {
      const s = sources[i];
      if (!s) {
        light.intensity = 0;
        delete light.userData.player;
        continue;
      }
      light.userData.player = s.p.id;
      if (updateReverseLight(light, w, s.p, s.root)) {
        light.intensity *= Math.min(1, (140 - s.distance) / 30);
        continue;
      }
      light.color.set('#fff1b5');
      light.intensity =
        (vehicleDef(w, s.p.vehicle)?.headlight ?? 150) * Math.min(1, (140 - s.distance) / 30);
      light.distance = vehicleDef(w, s.p.vehicle)?.lightRange ?? 110;
      light.angle = Math.PI / 3.5;
      if (s.root.userData.flashlight) {
        light.intensity = 32 * Math.min(1, (140 - s.distance) / 30);
        light.distance = 28;
        light.angle = Math.PI / 8;
        s.root.userData.flashlight.muzzle.getWorldPosition(light.position);
        s.root.userData.flashlight.target.getWorldPosition(light.target.position);
        continue;
      }
      this.point.copy(s.root.userData.lamp ?? new T.Vector3(0, 1.7, 0));
      light.position.copy(s.root.localToWorld(this.point));
      this.point.set(0, 0, 35);
      light.target.position.copy(s.root.localToWorld(this.point));
    }
  }
  clear() {
    for (const light of [...this.lights, ...this.flares]) {
      light.intensity = 0;
      delete light.userData.player;
    }
  }
}
