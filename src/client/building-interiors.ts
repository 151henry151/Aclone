import { furnishInterior, updateInteriorStock, animateInteriorEffects } from './interior-props';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building, World } from '../shared/types';
import type { BuildingVolume } from '../shared/building-shapes';
import type { BuildingBay } from '../shared/building-bays';
import { buildingDoorRules, doorOpenness, buildingDoorActivity } from '../shared/building-doors';
import { finishMaterial, type BuildingFinish } from './building-finishes';
export type DoorRig = {
  group: T.Group;
  bay: BuildingBay;
  panels: T.Mesh[];
  phase: number;
  openness: number;
  target: number;
  initialized: boolean;
};
export type InteriorRig = {
  group: T.Group;
  doors: DoorRig[];
  volume: BuildingVolume;
  detail: T.Group;
  principal: T.Group;
};
export function addBayInterior(
  root: T.Group,
  b: Building,
  v: BuildingVolume,
  bays: BuildingBay[],
  look: BuildingFinish,
  wall: (m: T.Mesh) => unknown,
  primary = true,
) {
  const interior = new T.Group();
  interior.userData.interior = true;
  interior.visible = false;
  interior.frustumCulled = true;
  root.add(interior);
  const detail = new T.Group(),
    principal = new T.Group();
  interior.add(principal, detail);
  const box = (
    parent: T.Group,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color = '#807965',
  ) => {
    const mesh = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.88 }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const thickness = 0.16;
  // Separate thin faces leave a real volume; the front wall is split at each aperture.
  for (const side of [-1, 1])
    wall(
      box(
        root,
        thickness,
        v.eaves,
        v.depth,
        v.x + side * (v.width / 2 - thickness / 2),
        v.eaves / 2,
        v.z,
        look.tint,
      ),
    );
  for (const rear of [false, true]) {
    const face = v.z + (rear ? -1 : 1) * (v.depth / 2 - thickness / 2);
    const holes: { x: number; width: number; height: number; sill: number }[] = bays
      .filter((bay) => !!bay.rear === rear)
      .map((bay) => ({ ...bay, sill: 0 }));
    if (rear && b.aircraftHangar) holes.push({ x: v.x, width: 3, height: 4.8, sill: 3 });
    holes.sort((a, b) => a.x - b.x);
    let left = v.x - v.width / 2;
    for (const bay of holes) {
      const edge = bay.x - bay.width / 2;
      if (bay.sill)
        wall(box(root, bay.width, bay.sill, thickness, bay.x, bay.sill / 2, face, look.tint));
      if (edge > left)
        wall(
          box(
            root,
            edge - left,
            v.eaves,
            thickness,
            (left + edge) / 2,
            v.eaves / 2,
            face,
            look.tint,
          ),
        );
      wall(
        box(
          root,
          bay.width,
          v.eaves - bay.height,
          thickness,
          bay.x,
          (v.eaves + bay.height) / 2,
          face,
          look.tint,
        ),
      );
      left = bay.x + bay.width / 2;
    }
    if (left < v.x + v.width / 2)
      wall(
        box(
          root,
          v.x + v.width / 2 - left,
          v.eaves,
          thickness,
          (left + v.x + v.width / 2) / 2,
          v.eaves / 2,
          face,
          look.tint,
        ),
      );
  }
  const floor = box(
    interior,
    v.width - 0.34,
    0.08,
    v.depth - 0.34,
    v.x,
    0.24,
    v.z,
    ['farm', 'sawmill', 'haybarn', 'carpenter'].includes(b.kind) ? '#8b7350' : '#777b76',
  );
  floor.name = 'interior-floor';
  floor.material = finishMaterial(
    ['farm', 'sawmill', 'haybarn', 'carpenter'].includes(b.kind)
      ? 'boards'
      : ['forge', 'mason', 'quarry', 'mine', 'rareMine'].includes(b.kind)
        ? 'limestone'
        : 'limewash',
    ['farm', 'sawmill', 'haybarn', 'carpenter'].includes(b.kind) ? '#8b7350' : '#777b76',
  );
  box(interior, v.width - 0.34, 0.08, v.depth - 0.34, v.x, v.eaves - 0.12, v.z).name =
    'interior-ceiling';
  for (const side of [-1, 1]) {
    const inner = box(
      interior,
      0.025,
      v.eaves - 0.35,
      v.depth - 0.35,
      v.x + side * (v.width / 2 - 0.18),
      v.eaves / 2,
      v.z,
      look.tint,
    );
    inner.name = 'inner-wall';
    wall(inner);
    if (!(side === -1 && b.aircraftHangar) && !bays.some((bay) => !!bay.rear === (side === -1))) {
      const back = box(
        interior,
        v.width - 0.35,
        v.eaves - 0.35,
        0.025,
        v.x,
        v.eaves / 2,
        v.z + side * (v.depth / 2 - 0.18),
        look.tint,
      );
      back.name = 'inner-back-wall';
      wall(back);
    }
  }
  for (const dz of [-0.3, 0, 0.3])
    box(detail, v.width - 0.4, 0.15, 0.15, v.x, v.eaves - 0.3, v.z + dz * v.depth, '#5e5745').name =
      'roof-truss';
  for (const dz of [-0.25, 0.25])
    addInteriorLamp(interior, b.id, v.x, v.eaves - 0.35, v.z + v.depth * dz);
  if (b.aircraftHangar) {
    const sock = new T.Group();
    sock.name = 'rear-windsock';
    root.add(sock);
    box(sock, 0.06, 4.6, 0.06, v.x, 2.3, v.z - v.depth / 2 - 3, '#888b82');
    const fabric = new T.Mesh(
      new T.ConeGeometry(0.22, 1, 8),
      new T.MeshStandardMaterial({ color: '#b9603e', roughness: 1 }),
    );
    fabric.rotation.x = Math.PI / 2;
    fabric.position.set(v.x, 4.4, v.z - v.depth / 2 - 2.5);
    sock.add(fabric);
  }
  const doors = bays.map((bay) => makeBayDoor(root, bay, look));
  const rig: InteriorRig = { group: interior, doors, volume: v, detail, principal };
  furnishInterior(rig, b, primary);
  updateInteriorStock(rig, b);
  (root.userData.interiors ??= []).push(rig);
  return rig;
}
export function animateBuildingDoors(
  root: T.Group,
  w: World,
  b: Building,
  dt: number,
  distance: number,
  low = false,
  onSound?: (motion: string, gain: number) => void,
) {
  const rigs = root.userData.interiors as InteriorRig[] | undefined;
  if (!rigs) return;
  const r = buildingDoorRules(w.settings),
    target = doorOpenness(w, b);
  for (const rig of rigs) {
    for (const d of rig.doors) {
      if (d.initialized && d.target !== target && distance < r.buildingDoorSoundRange)
        onSound?.(d.bay.motion, 1 - distance / r.buildingDoorSoundRange);
      d.target = target;
      d.phase =
        !d.initialized || distance > r.buildingDoorAnimateRange
          ? target
          : T.MathUtils.clamp(
              d.phase + (Math.sign(target - d.phase) * dt) / r.buildingDoorSeconds,
              0,
              1,
            );
      d.initialized = true;
      const arrival = root.userData.arrivalBay;
      const crossing =
        arrival && !d.bay.rear && Math.hypot(d.bay.x - arrival.x, d.bay.z - arrival.z) < 0.25
          ? arrival.openness
          : 0;
      d.openness = Math.max(crossing, d.phase * d.phase * (3 - 2 * d.phase));
      d.group.userData.openness = d.openness;
      poseDoor(d, r.buildingDoorSwingDegrees);
    }
    rig.group.visible =
      r.buildingInteriorDetail !== 'none' &&
      ((b.doorActivity ?? buildingDoorActivity(w, b)).inside ||
        rig.doors.some((d) => d.openness > r.buildingInteriorThreshold));
    rig.detail.visible = !low && r.buildingInteriorDetail === 'full';
    for (const effect of (rig.group.userData.effects ?? []) as T.Object3D[])
      if (effect.name === 'kettle-steam') effect.visible = rig.detail.visible;
    if (rig.group.visible && rig.detail.visible && distance <= r.buildingDoorAnimateRange)
      animateInteriorEffects(rig, dt);
  }
}

/** Pose actual leaves for both fresh previews and the running scene. */
function poseDoor(d: DoorRig, swingDegrees: number) {
  const h = d.bay.height,
    width = d.bay.width;
  d.panels.forEach((panel, i) => {
    panel.rotation.set(0, 0, 0);
    if (d.bay.motion === 'roll') {
      const panelHeight = h / d.panels.length,
        radius = panelHeight / 2,
        trackTop = h - panelHeight / 2;
      const travel = (i + 0.5) * panelHeight + d.openness * (h + panelHeight);
      const bend = Math.max(0, travel - trackTop),
        angle = Math.min(Math.PI / 2, bend / radius);
      panel.position.set(
        0,
        travel <= trackTop ? travel : trackTop + Math.sin(angle) * radius,
        -(radius * (1 - Math.cos(angle)) + Math.max(0, bend - (radius * Math.PI) / 2)),
      );
      panel.rotation.x = -angle;
    } else if (d.bay.motion === 'slide')
      panel.position.set((i ? 1 : -1) * width * (0.25 + 0.5 * d.openness), h / 2, 0);
    else {
      panel.position.set(((i ? 1 : -1) * width) / 2, h / 2, 0);
      panel.rotation.y = ((i ? 1 : -1) * d.openness * swingDegrees * Math.PI) / 180;
    }
  });
}

export function makeBayDoor(
  root: T.Group,
  bay: BuildingBay,
  look: BuildingFinish,
  baseY = 0,
): DoorRig {
  const group = new T.Group();
  group.position.set(bay.x, baseY, bay.z + (bay.rear ? -0.025 : 0.025));
  if (bay.rear) group.rotation.y = Math.PI;
  group.userData.bayDoor = true;
  group.userData.loadingDoor = true;
  root.add(group);
  const panels = Array.from({ length: bay.motion === 'roll' ? 6 : 2 }, (_, i) => {
    const h = bay.motion === 'roll' ? bay.height / 6 : bay.height,
      w = bay.motion === 'roll' ? bay.width : bay.width / 2;
    const material = finishMaterial(look.bay, look.accent).clone();
    material.side = T.DoubleSide;
    const panel = new T.Mesh(new T.PlaneGeometry(w, h), material);
    panel.castShadow = panel.receiveShadow = true;
    group.add(panel);
    if (bay.motion === 'hinge') panel.geometry.translate(((i ? -1 : 1) * w) / 2, 0, 0);
    return panel;
  });
  const door = { group, bay, panels, phase: 0, openness: 0, target: 0, initialized: false };
  poseDoor(door, 0);
  return door;
}

export function addInteriorLamp(
  parent: T.Group,
  buildingId: string,
  x: number,
  y: number,
  z: number,
) {
  const lamp = new T.Mesh(
    new T.BoxGeometry(0.45, 0.07, 0.3),
    new T.MeshStandardMaterial({
      color: '#fff0c0',
      roughness: 0.88,
      emissive: '#ffd994',
      emissiveIntensity: 0.2,
    }),
  );
  lamp.position.set(x, y, z);
  lamp.name = 'interior-lamp';
  lamp.userData.lightSource = buildingId;
  lamp.userData.interiorLight = true;
  parent.add(lamp);
  return lamp;
}
