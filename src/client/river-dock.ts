// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { finishSurface } from './building-finishes';
import { terrainHeight } from '../shared/terrain';
import { surfaceWaterLevel } from '../shared/ocean';
import { RIVER_BERTH, RIVER_JETTY, riverDockPoint } from '../shared/river-dock';
import type { Building, World } from '../shared/types';

/** A log jetty on driven piles with a plank deck, mooring posts and a fender
 * log along the berth side. Built in dock-local metres at deck height 0; the
 * scene lifts the jetty to the river surface, which sits above the sea datum. */
export function riverDockDetails(root: T.Group) {
  const jetty = new T.Group();
  jetty.name = 'river-jetty';
  root.add(jetty);
  const add = (geometry: T.BufferGeometry, color: string, x: number, y: number, z: number) => {
    const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    jetty.add(m);
    return m;
  };
  const length = RIVER_JETTY.end - RIVER_JETTY.start,
    centre = -(RIVER_JETTY.start + RIVER_JETTY.end) / 2;
  // Two bearer logs, plank deck and a shore sill.
  for (const x of [-0.8, 0.8])
    add(
      new T.CylinderGeometry(0.14, 0.14, length + 0.6, 8),
      '#6e5536',
      x,
      -0.2,
      centre,
    ).rotation.x = Math.PI / 2;
  const deck = add(new T.BoxGeometry(RIVER_JETTY.width, 0.1, length), '#ffffff', 0, 0, centre);
  finishSurface(deck, 'boards', '#a98757');
  add(
    new T.BoxGeometry(RIVER_JETTY.width + 0.4, 0.22, 0.4),
    '#6e5536',
    0,
    -0.05,
    -RIVER_JETTY.start,
  );
  // Driven piles every 2.4 m, reaching 2.6 m below the deck into the riverbed.
  for (let z = RIVER_JETTY.start + 0.4; z <= RIVER_JETTY.end; z += 2.4)
    for (const x of [-1, 1]) {
      const pile = add(new T.CylinderGeometry(0.16, 0.19, 3.2, 8), '#5a4a33', x, -1.3, -z);
      pile.name = 'river-pile';
    }
  // Mooring posts with rope, plus a fender log along the berth side.
  for (const x of [-0.95, 0.95]) {
    add(new T.CylinderGeometry(0.17, 0.2, 1.1, 8), '#4b3b27', x, 0.5, -RIVER_JETTY.end + 0.4);
    add(
      new T.TorusGeometry(0.22, 0.03, 6, 14),
      '#c7b28a',
      x,
      0.78,
      -RIVER_JETTY.end + 0.4,
    ).rotation.x = Math.PI / 2;
  }
  add(
    new T.CylinderGeometry(0.17, 0.17, RIVER_JETTY.width + 0.6, 8),
    '#6e5536',
    0,
    -0.12,
    -RIVER_JETTY.end - 0.25,
  ).rotation.z = Math.PI / 2;
  // A low lantern post at the shore end so the berth reads at dusk.
  add(new T.CylinderGeometry(0.06, 0.07, 2.2, 6), '#4b3b27', 1.3, 1.1, -RIVER_JETTY.start - 0.3);
  const lamp = add(
    new T.SphereGeometry(0.14, 8, 6),
    '#f0dfb0',
    1.3,
    2.25,
    -RIVER_JETTY.start - 0.3,
  );
  (lamp.material as T.MeshStandardMaterial).emissive = new T.Color('#8a7340');
  return jetty;
}
/** Place the deck 0.75 m above the local river surface and sink each pile to the bed. */
export function fitRiverDockToWater(root: T.Object3D, b: Building, w: World) {
  const jetty = root.getObjectByName('river-jetty');
  if (!jetty) return;
  const base = b.foundationY ?? terrainHeight(w, b.x, b.z);
  const berth = riverDockPoint(b, 0, -RIVER_BERTH.z);
  const level = surfaceWaterLevel(w, berth.x, berth.z);
  jetty.position.y = Math.max(level + 0.75, terrainHeight(w, b.x, b.z) + 0.3) - base;
  for (const pile of jetty.children.filter((o) => o.name === 'river-pile')) {
    const p = riverDockPoint(b, pile.position.x, pile.position.z);
    const bed = terrainHeight(w, p.x, p.z) - base - jetty.position.y;
    const top = 0.3;
    pile.scale.y = Math.max(0.5, (top - bed) / 3.2);
    pile.position.y = (top + bed) / 2;
  }
}
