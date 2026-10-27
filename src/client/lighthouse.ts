// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building } from '../shared/types';
import { buildingPlan } from '../shared/building-shapes';
import { buildingFinish, finishSurface } from './building-finishes';
import { surface } from './materials';

/** Low-poly masonry tower, glazed lantern and a separate keeper's cottage. */
export function lighthouseModel(b: Building, finish: typeof surface) {
  const root = new T.Group(),
    plan = buildingPlan(b),
    look = buildingFinish(b.kind, plan);
  const [tower, cottage] = plan.volumes;
  const index = Number((b.architecture ?? 'model-1').slice(-1)) - 1;
  const sides = [16, 8, 4, 12, 8][index] ?? 16;
  function mesh(g: T.BufferGeometry, color: string, x: number, y: number, z: number) {
    const m: T.Mesh<T.BufferGeometry, T.Material> = new T.Mesh(
      g,
      new T.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  }
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) =>
    mesh(new T.BoxGeometry(w, h, d), c, x, y, z);
  const wall = (m: T.Mesh) =>
    look.wall === 'stone'
      ? finish(m, 'stone', 3, look.tint)
      : finishSurface(m, look.wall, look.tint);
  const radius = Math.min(tower.width, tower.depth) * 0.43,
    height = tower.eaves;
  wall(
    mesh(
      new T.CylinderGeometry(radius * 0.68, radius, height, sides),
      look.tint,
      tower.x,
      height / 2,
      tower.z,
    ),
  );
  // A painted identification band and inset slit windows make the silhouette legible at sea.
  mesh(
    new T.CylinderGeometry(radius * 0.78 + 0.015, radius * 0.82 + 0.015, height * 0.12, sides),
    index % 2 ? '#ece3cc' : '#9b493b',
    tower.x,
    height * 0.62,
    tower.z,
  );
  for (let y = 3; y < height - 1; y += 3.5) {
    const r = radius * (1 - (0.32 * y) / height);
    box(0.55, 0.95, 0.06, '#293c40', tower.x, y, tower.z + r + 0.04);
  }
  box(1.1, 2, 0.12, '#344b50', tower.x, 1, tower.z + radius + 0.04);
  const deck = height + 0.15,
    lantern = height + 1.45;
  mesh(
    new T.CylinderGeometry(radius * 0.94, radius * 0.94, 0.3, sides),
    '#53605e',
    tower.x,
    deck,
    tower.z,
  );
  // Thin rail with eight supports; no expensive transparent rail or light shadows.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    box(
      0.08,
      1,
      0.08,
      '#283e40',
      tower.x + Math.sin(a) * radius * 0.88,
      deck + 0.55,
      tower.z + Math.cos(a) * radius * 0.88,
    );
  }
  const rail = mesh(
    new T.TorusGeometry(radius * 0.88, 0.045, 4, 16),
    '#283e40',
    tower.x,
    deck + 1.05,
    tower.z,
  );
  rail.rotation.x = Math.PI / 2;
  const glass = mesh(
    new T.CylinderGeometry(radius * 0.58, radius * 0.58, 2.1, 8),
    '#9caeaa',
    tower.x,
    lantern,
    tower.z,
  );
  glass.material = new T.MeshStandardMaterial({
    color: '#9caeaa',
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    roughness: 0.18,
  });
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    box(
      0.09,
      2.2,
      0.09,
      '#263c40',
      tower.x + Math.sin(a) * radius * 0.6,
      lantern,
      tower.z + Math.cos(a) * radius * 0.6,
    );
  }
  mesh(new T.ConeGeometry(radius * 0.78, 1.3, 8), '#354f51', tower.x, height + 3.15, tower.z);
  const lamp = mesh(new T.SphereGeometry(0.42, 8, 6), '#fff2ba', tower.x, lantern, tower.z);
  lamp.material = new T.MeshStandardMaterial({ color: '#d5c8a2', roughness: 0.3 });
  if (cottage) {
    const c = cottage;
    wall(box(c.width, c.eaves, c.depth, look.tint, c.x, c.eaves / 2, c.z));
    for (const sign of [-1, 1]) {
      const roof = box(
        c.width / 2 + 0.3,
        0.18,
        c.depth + 0.5,
        '#354f51',
        c.x + (sign * c.width) / 4,
        c.eaves + c.rise / 2,
        c.z,
      );
      roof.rotation.z = -sign * Math.atan2(c.rise, c.width / 2);
      roof.scale.x = 1 / Math.cos(roof.rotation.z);
      box(1.05, 1.2, 0.1, '#263e44', c.x + sign * c.width * 0.29, 1.85, c.z + c.depth / 2 + 0.04);
    }
    const gable = new T.Shape();
    gable.moveTo(-c.width / 2, 0);
    gable.lineTo(c.width / 2, 0);
    gable.lineTo(0, c.rise);
    gable.closePath();
    for (const sign of [-1, 1]) {
      const end = mesh(
        new T.ShapeGeometry(gable),
        look.tint,
        c.x,
        c.eaves,
        c.z + (sign * c.depth) / 2,
      );
      end.material.side = T.DoubleSide;
      wall(end);
    }
    box(0.95, 2, 0.14, '#78533d', c.x, 1, c.z + c.depth / 2 + 0.07);
    box(1.8, 0.25, 1, '#a59d86', c.x, 0.12, c.z + c.depth / 2 + 0.5);
    box(0.55, 1.4, 0.65, '#8e7967', c.x - c.width * 0.3, c.eaves + c.rise, c.z - 1);
  }
  const rotor = new T.Group();
  rotor.position.set(tower.x, lantern, tower.z);
  rotor.userData.lighthouseRotor = true;
  if (!b.construction) root.userData.lighthouseRotor = rotor;
  root.add(rotor);
  return root;
}
