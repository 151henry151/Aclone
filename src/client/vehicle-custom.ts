// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World, Player } from '../shared/types';
import { createTrawlRig } from './trawl-rig';
import { vehicleDef, isTrawler } from '../shared/vehicle-config';
import { creatorModel } from './creator-model';
import { publicPath } from '../shared/public-path';
import { boatLighting } from '../shared/boat-lighting';
declare const __ACLONE_BASE__: string;
export function configureVehicleVisual(root: T.Group, w: World, slot: number) {
  const v = vehicleDef(w, slot);
  if (isTrawler(slot, w) && !root.userData.fishingBoat) {
    const rig = createTrawlRig();
    root.add(rig.group);
    root.userData.customTrawl = rig;
  }
  const components: T.Group[] = [];
  for (const c of v.components ?? []) {
    const model = w.creator?.models.find((m) => m.id === c.model);
    if (!model) continue;
    const pivot = new T.Group(),
      visual = creatorModel(model, w);
    visual.scale.setScalar(c.scale);
    visual.rotation.y = (c.yaw * Math.PI) / 180;
    pivot.position.set(c.x, c.y, c.z);
    pivot.userData.role = c.role;
    pivot.add(visual);
    root.add(pivot);
    components.push(pivot);
  }
  if (v.cockpit) {
    root.userData.eye = new T.Vector3(v.cockpit.x, v.cockpit.y, v.cockpit.z);
    root.userData.viewPitch = 0;
    if (!root.userData.driver) root.userData.driver = new T.Group();
  }
  const lamps = (v.lights ?? []).map((l) => {
    const material = new T.MeshStandardMaterial({
      color: l.color,
      emissive: l.color,
      emissiveIntensity: l.intensity,
    });
    const lens = new T.Mesh(new T.SphereGeometry(0.08, 6, 4), material);
    lens.position.set(l.x, l.y, l.z);
    root.add(lens);
    return { lens, l };
  });
  if (v.tracks !== undefined || v.frontTrack !== undefined || v.rearTrack !== undefined) {
    root.userData.tyreFootprints =
      v.tracks === false
        ? []
        : [-1, 1].flatMap((side) => [
            {
              position: new T.Vector3(
                (side * (v.frontTrack ?? 1.8)) / 2,
                0,
                (v.wheelbase ?? 2.5) / 2,
              ),
              width: v.frontTyre ?? 0.35,
            },
            {
              position: new T.Vector3(
                (side * (v.rearTrack ?? 2.2)) / 2,
                0,
                -(v.wheelbase ?? 2.5) / 2,
              ),
              width: v.rearTyre ?? 0.55,
            },
          ]);
    root.userData.contacts = [-1, 1].flatMap((side) =>
      [-1, 1].map(
        (end) =>
          new T.Vector3(
            (side * Math.max(v.frontTrack ?? 1.8, v.rearTrack ?? 2.2)) / 2,
            0,
            (end * (v.wheelbase ?? 2.5)) / 2,
          ),
      ),
    );
  }
  let panel: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial> | undefined,
    canvas: HTMLCanvasElement | undefined,
    texture: T.CanvasTexture | undefined,
    art: HTMLImageElement | undefined,
    last = -1;
  if (v.instruments?.length || v.dashboard) {
    canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 256;
    texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    panel = new T.Mesh(new T.PlaneGeometry(0.95, 0.32), new T.MeshBasicMaterial({ map: texture }));
    const eye = root.userData.eye ?? new T.Vector3(0, 2, 0);
    panel.position.set(eye.x, eye.y - 0.38, eye.z + 0.8);
    panel.rotation.y = Math.PI;
    root.add(panel);
    const asset = w.assets.find((a) => a.id === v.dashboard);
    if (asset) {
      art = new Image();
      art.src = publicPath(__ACLONE_BASE__, asset.url);
    }
  }
  root.userData.animateConfiguration = (
    p: Player,
    dt: number,
    turn: number,
    time: number,
    cockpit: boolean,
  ) => {
    for (const c of components) {
      if (c.userData.role === 'wheel') c.rotation.x += (p.speed * dt) / 0.6;
      else if (c.userData.role === 'propeller')
        c.rotation.z += (p.engine && p.fuel > 0 ? 24 : 0) * dt;
      else if (c.userData.role === 'steer')
        c.rotation.y = T.MathUtils.clamp(turn / Math.max(dt, 0.001), -1, 1) * 0.45;
    }
    const switches = boatLighting(p);
    for (const { lens, l } of lamps) {
      const on =
        l.switch === 'always' ||
        (l.switch === 'headlights'
          ? p.lights
          : l.switch === 'cabin'
            ? switches.cabin !== 'off'
            : switches.deck);
      lens.material.emissiveIntensity =
        on && (!l.blink || (time * l.blink) % 1 < 0.5) ? l.intensity : 0;
      lens.material.color.set(l.color).multiplyScalar(on ? 1 : 0.25);
    }
    if (panel) panel.visible = cockpit;
    if (!cockpit || !canvas || !texture || time - last < 0.1) return;
    last = time;
    const x = canvas.getContext('2d')!;
    x.fillStyle = '#182629';
    x.fillRect(0, 0, 768, 256);
    if (art?.complete && art.naturalWidth) x.drawImage(art, 0, 0, 768, 256);
    const readings: Record<string, string> = {
      speed: `${Math.abs(p.speed * 2.237).toFixed(1)} mph`,
      fuel: `${p.fuel.toFixed(1)} / ${v.tank ?? 64}`,
      heading: `${(((((p.heading * 180) / Math.PI) % 360) + 360) % 360).toFixed(0)}°`,
      altitude: `${p.y.toFixed(0)} m`,
      pitch: `${(((p.flight?.pitch ?? root.rotation.x) * 180) / Math.PI).toFixed(0)}°`,
      condition: `${(p.fleetState?.[p.vehicle]?.condition ?? 100).toFixed(0)}%`,
    };
    for (const [i, key] of (v.instruments ?? []).entries()) {
      const px = 16 + (i % 3) * 250,
        py = 18 + Math.floor(i / 3) * 120;
      x.fillStyle = '#102023db';
      x.fillRect(px, py, 235, 105);
      x.fillStyle = '#c7cbb3';
      x.font = '18px monospace';
      x.fillText(key.toUpperCase(), px + 10, py + 28);
      x.fillStyle = '#f3e1a3';
      x.font = '26px monospace';
      x.fillText(readings[key], px + 10, py + 72, 215);
    }
    texture.needsUpdate = true;
  };
}
