import { waterLevel } from '../shared/ocean';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { yardBoat, yardFleets } from './yard-boats';
import { finishMaterial, finishSurface } from './building-finishes';
import { surface } from './materials';
import { terrainHeight } from '../shared/terrain';
import { dockPoint } from '../shared/boathouse';
import type { BuildingPlan } from '../shared/building-shapes';
import type { Building, World } from '../shared/types';

/** Static repair boats are inexpensive open hulls; the textures supply planking and paintwork. */
export function boatyardDetails(
  root: T.Group,
  plan: BuildingPlan,
  finish: typeof surface = surface,
  architecture = 'model-1',
) {
  const box = (
    host: T.Group,
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    wood = false,
  ) => {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    host.add(m);
    if (wood) finishSurface(m, 'boards', color);
    return m;
  };
  const fleet = yardFleets[Math.max(0, Math.min(4, Number(architecture.slice(-1)) - 1))];
  for (const [index, spec] of fleet.entries()) {
    const craft = yardBoat(spec);
    craft.position.set([10, 15.5, 19.2][index], 0, [0, -1, 3][index]);
    root.add(craft);
  }
  // Rope/paint store, stacked boards and service barrels in the open yard.
  for (let i = 0; i < 4; i++) box(root, 3.8, 0.16, 0.7, '#a98757', 15, 0.14 + i * 0.18, 6, true);
  for (let i = 0; i < 3; i++) {
    const m = new T.Mesh(
      new T.CylinderGeometry(0.36, 0.36, 0.9, 10),
      new T.MeshStandardMaterial({ color: '#53716a' }),
    );
    m.position.set(19 + i * 0.85, 0.45, 6);
    root.add(m);
  }
  // The lifting hall projects beyond the shoreline, with an open water floor.
  // Full-height side cladding, columns and a tall doorway admit both boat models.
  const shed = new T.Group();
  shed.name = 'over-water-lifting-hall';
  root.add(shed);
  for (const side of [-1, 1]) {
    const wall = box(shed, 0.18, 6.9, 36, plan.wall, side * 5.9, 4.55, -25);
    finishSurface(wall, plan.siding === 'wood' ? 'boards' : 'metal', plan.wall);
    for (const z of [-7.2, -19, -31, -42.8]) {
      box(shed, 0.3, 12, 0.3, '#53615e', side * 5.7, 2, z).name = 'water-pile';
      box(shed, 0.12, 6.9, 0.13, plan.trim, side * 6.02, 4.55, z);
    }
    // Gabled roof sheets and a pair of doors parked open on the side walls.
    const roof = box(shed, 6.35, 0.18, 36.8, '#596c72', side * 2.98, 8.65, -25);
    roof.rotation.z = -side * 0.22;
    const door = box(shed, 0.13, 6.9, 4.6, '#466569', side * 6.03, 4.55, -40.5);
    finishSurface(door, 'boards', '#466569');
  }
  box(shed, 12, 0.45, 0.4, '#c4bc94', 0, 7.8, -43);
  // Travelling crane, hook and broad slings: this is a boat lifting bay, not a shed on a pier.
  box(shed, 10.8, 0.3, 0.3, '#d6ad54', 0, 7.35, -33);
  box(shed, 0.8, 0.5, 0.65, '#4c5553', 0, 7, -33);
  for (const side of [-1, 1]) {
    box(shed, 0.055, 3.2, 0.06, '#464d48', side * 3.8, 5.6, -33);
  }
  box(shed, 7.6, 0.06, 0.18, '#c9a25a', 0, 4, -33);
  const dock = new T.Group();
  dock.name = 'floating-jetty';
  root.add(dock);
  // Side decks leave the middle completely open for a boat to enter the hall.
  for (const x of [-5.1, 5.1, 7.5]) box(dock, 1.25, 0.25, 23, '#9d8868', x, 0, -31.5, true);
  for (const z of [-23, -32, -41]) {
    box(dock, 0.2, 0.45, 0.2, '#414a46', 8.1, 0.3, z);
    box(dock, 0.5, 0.1, 0.12, '#414a46', 8.1, 0.55, z);
    const f = new T.Mesh(
      new T.TorusGeometry(0.3, 0.09, 5, 12),
      new T.MeshStandardMaterial({ color: '#343b39' }),
    );
    f.position.set(8.16, -0.05, z);
    f.rotation.y = Math.PI / 2;
    dock.add(f);
  }
  const gangway = new T.Group();
  gangway.name = 'boatyard-gangway';
  root.add(gangway);
  for (let i = 0; i < 20; i++)
    box(gangway, 1.25, 0.18, 0.7, '#9d8868', 7.5, 0, -6.35 - i * 0.7, true);
  const ring = new T.Mesh(
    new T.TorusGeometry(0.55, 0.13, 6, 20),
    new T.MeshStandardMaterial({ color: '#e79952' }),
  );
  ring.position.set(5, 2, -7.08);
  root.add(ring);
  const main = plan.volumes[0];
  const waterDoor = new T.Mesh(
    new T.PlaneGeometry(5.5, 3.7),
    finishMaterial('barn-door', '#557572'),
  );
  waterDoor.position.set(0, 1.95, -main.depth / 2 - 0.04);
  waterDoor.rotation.y = Math.PI;
  root.add(waterDoor);
  // Broad textured workshop doors, away from the gangway.
  for (const side of [-1, 1]) {
    const door = new T.Mesh(new T.PlaneGeometry(4.3, 3.7), finishMaterial('barn-door', '#557572'));
    door.position.set(side * 3.2, 1.95, main.depth / 2 + 0.04);
    root.add(door);
  }
  for (const v of plan.volumes.slice(1)) {
    const door = new T.Mesh(new T.PlaneGeometry(1.1, 2.1), finishMaterial('barn-door', '#5c7169'));
    door.position.set(v.x, 1.05, v.z + v.depth / 2 + 0.04);
    root.add(door);
    box(root, 1.1, 0.9, 0.05, '#335663', v.x - 1.7, 1.8, v.z + v.depth / 2 + 0.04);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#284d51';
    c.fillRect(0, 0, 512, 96);
    c.strokeStyle = '#d1bb7a';
    c.lineWidth = 5;
    c.strokeRect(6, 6, 500, 84);
    c.fillStyle = '#f0e3b6';
    c.font = 'bold 48px Georgia';
    c.textAlign = 'center';
    c.fillText('BOATYARD', 256, 66);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const sign = new T.Mesh(
      new T.PlaneGeometry(7, 0.9),
      new T.MeshStandardMaterial({ map: texture, roughness: 0.9 }),
    );
    sign.position.set(0, 4.3, main.depth / 2 + 0.06);
    root.add(sign);
    const watersideSign = sign.clone();
    watersideSign.position.set(0, 8.15, -43.24);
    watersideSign.rotation.y = Math.PI;
    root.add(watersideSign);
  }
}
export function fitBoatyardToWater(root: T.Group, b: Building, w: World) {
  const level = waterLevel(w) + 0.32 - (b.foundationY ?? terrainHeight(w, b.x, b.z));
  const dock = root.getObjectByName('floating-jetty');
  if (dock) dock.position.y = level;
  const gangway = root.getObjectByName('boatyard-gangway');
  const deckHeight = (x: number, z: number) => {
    const p = dockPoint(b, x, z);
    return (
      Math.max(waterLevel(w) + 0.32, terrainHeight(w, p.x, p.z) + 0.25) -
      (b.foundationY ?? terrainHeight(w, b.x, b.z))
    );
  };
  for (const slab of gangway?.children ?? []) {
    const z = slab.position.z,
      a = deckHeight(slab.position.x, z - 0.35),
      c = deckHeight(slab.position.x, z + 0.35);
    slab.position.y = (a + c) / 2;
    slab.rotation.x = -Math.atan2(c - a, 0.7);
    slab.scale.z = Math.hypot(0.7, c - a) / 0.7;
  }
}
