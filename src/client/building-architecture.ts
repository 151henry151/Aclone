// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building } from '../shared/types';
import type { BuildingPlan, BuildingVolume } from '../shared/building-shapes';
import { buildingArchitecture } from '../shared/building-architecture';
import { finishMaterial, type BuildingFinish } from './building-finishes';
import { detailMaterial } from './detail-textures';
import { spaceportModel } from './spaceport';
interface Kit {
  box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): T.Mesh;
  cylinder(r: number, h: number, color: string, x: number, y: number, z: number): T.Mesh;
  mesh(g: T.BufferGeometry, color: string, x: number, y: number, z: number): T.Mesh;
  wallFinish(m: T.Mesh): T.Mesh;
  roof(v: BuildingVolume): void;
  door(x: number, z: number): void;
  window(x: number, y: number, z: number, width?: number, angle?: number): void;
  chimney(x: number, z: number, top: number): void;
}
/** Low-poly architecture kit. Openings remain textured planes; extra geometry buys silhouette. */
export function architecturalDetails(
  root: T.Group,
  b: Building,
  plan: BuildingPlan,
  look: BuildingFinish,
  k: Kit,
) {
  const model = buildingArchitecture(b.kind, b.architecture)!;
  const { box, cylinder, mesh, wallFinish, roof, door, window, chimney } = k;
  const vs = plan.volumes,
    main = vs[0];
  if (model.family === 'prop') {
    for (const v of vs) {
      const { x, z, width: w, depth: d, eaves: h } = v;
      if (b.kind === 'notice') {
        for (const dx of [-w * 0.4, w * 0.4])
          wallFinish(box(0.16, h, 0.16, '#ffffff', x + dx, h / 2, z));
        wallFinish(box(w, h * 0.45, 0.18, '#ffffff', x, h * 0.7, z));
        for (const dx of [-w * 0.3, 0, w * 0.3])
          box(w * 0.22, h * 0.28, 0.025, '#e8dfb6', x + dx, h * 0.7, z + 0.11);
        if (model.index !== 0) roof(v);
      } else if (b.kind === 'portal') {
        for (const dx of [-w * 0.42, w * 0.42])
          wallFinish(box(w * 0.16, h, d, '#ffffff', x + dx, h / 2, z));
        wallFinish(box(w, 0.3, d, '#ffffff', x, h - 0.15, z));
        const ring = mesh(new T.TorusGeometry(w * 0.32, 0.08, 5, 20), '#82c4ca', x, h * 0.5, z);
        ring.scale.y = (h * 0.34) / (w * 0.32);
        if (model.index === 2) roof(v);
      } else if (b.kind === 'turret') {
        if (model.index === 0) wallFinish(cylinder(w * 0.4, h * 0.55, '#ffffff', x, h * 0.275, z));
        else wallFinish(box(w, h * 0.55, d, '#ffffff', x, h * 0.275, z));
        cylinder(w * 0.25, h * 0.22, '#4f6669', x, h * 0.67, z);
        const barrels = model.index === 4 ? [-0.18, 0.18] : [0];
        for (const dx of barrels) box(0.17, 0.17, d * 0.8, '#333f45', x + dx, h * 0.8, z + d * 0.1);
        if (model.index === 2) {
          for (const dx of [-w * 0.42, w * 0.42])
            box(0.12, h, 0.12, plan.trim, x + dx, h / 2, z - d * 0.4);
          roof(v);
        }
      } else {
        wallFinish(box(w, h, d, '#ffffff', x, h / 2, z));
        for (const dx of [-w * 0.37, w * 0.37])
          box(0.08, h + 0.03, d + 0.04, plan.trim, x + dx, h / 2, z);
        const panel = new T.Mesh(
          new T.PlaneGeometry(w * 0.7, h * 0.65),
          finishMaterial('service-door', look.accent),
        );
        panel.position.set(x, h * 0.5, z + d / 2 + 0.03);
        root.add(panel);
        if (model.index === 2) roof(v);
      }
    }
    return;
  }
  // A facade belongs to the exposed face of each volume, never behind another wing.
  const clear = (v: BuildingVolume, x: number, y: number, z: number, pad = 0.6) =>
    !vs.some(
      (o) =>
        o !== v &&
        y < o.eaves + o.rise &&
        Math.abs(x - o.x) < o.width / 2 + pad &&
        Math.abs(z - o.z) < o.depth / 2 + pad,
    );
  const industrial = ['barn', 'works', 'yard', 'port'].includes(model.family);
  const entries: { x: number; z: number; v: BuildingVolume }[] = [];
  for (const v of vs) {
    if (v.eaves < 2.3) continue;
    const front = v.z + v.depth / 2 + 0.07;
    const entry = clear(v, v.x, 1, front, 0.2);
    if (entry) {
      entries.push({ x: v.x, z: front, v });
      if (industrial && v.width >= 4) {
        const h = Math.min(3.4, v.eaves - 0.3),
          width = Math.min(3.6, v.width * 0.65);
        const panel = new T.Mesh(
          new T.PlaneGeometry(width, h),
          finishMaterial(look.bay, look.accent),
        );
        panel.position.set(v.x, h / 2, front + 0.04);
        root.add(panel);
      } else door(v.x, front);
    }
    for (let y = 1.6; y < v.eaves - 0.65; y += 2.7) {
      for (const side of [-1, 1]) {
        const z = v.z + side * (v.depth / 2 + 0.06);
        for (let x = v.x - v.width / 2 + 1.1; x < v.x + v.width / 2 - 0.8; x += 2.4) {
          if (side === 1 && entry && y < 2.5 && Math.abs(x - v.x) < (industrial ? 2.5 : 1.25))
            continue;
          if (clear(v, x, y, z))
            window(x, y, z, Math.min(1.05, v.width * 0.25), side === 1 ? 0 : Math.PI);
        }
        const x = v.x + side * (v.width / 2 + 0.06);
        for (let z = v.z - v.depth / 2 + 1.1; z < v.z + v.depth / 2 - 0.8; z += 2.4)
          if (clear(v, x, y, z)) window(x, y, z, 1.05, (side * Math.PI) / 2);
      }
    }
  }
  const entry = entries[0] ?? { x: main.x, z: main.z + main.depth / 2, v: main };
  const top = main.eaves + main.rise;
  if (
    [
      'home',
      'bnb',
      'hotel',
      'pub',
      'bakery',
      'kitchen',
      'dairyKitchen',
      'roastery',
      'teaHouse',
      'winery',
      'brickworks',
      'forge',
      'brewery',
    ].includes(b.kind)
  )
    chimney(main.x - main.width * 0.25, main.z - main.depth * 0.22, top + 0.65);
  if (['market', 'bakery', 'dairyKitchen', 'teaHouse'].includes(b.kind)) {
    const width = Math.min(entry.v.width - 0.2, 5);
    const awning = box(width, 0.09, 1.05, '#ffffff', entry.x, 2.55, entry.z + 0.4);
    (awning.material as T.Material).dispose();
    awning.material = finishMaterial(b.kind === 'bakery' ? 'awning-rust' : 'awning-green');
    awning.rotation.x = 0.14;
  }
  if (['school', 'town', 'bank'].includes(b.kind)) {
    const x = entry.x,
      z = entry.z;
    for (const dx of [-1.15, 1.15]) cylinder(0.13, 2.4, '#d8d2bd', x + dx, 1.2, z + 0.6);
    box(2.8, 0.2, 1.2, plan.trim, x, 2.5, z + 0.5);
    if (b.kind === 'town' || b.kind === 'bank') {
      const pediment = new T.Shape();
      pediment.moveTo(-1.8, 0);
      pediment.lineTo(0, 0.85);
      pediment.lineTo(1.8, 0);
      pediment.closePath();
      const face = wallFinish(mesh(new T.ShapeGeometry(pediment), '#ffffff', x, 2.65, z + 1.27));
      (face.material as T.Material).side = T.DoubleSide;
      box(3.9, 0.12, 1.5, '#b2b19d', x, 0.06, z + 0.55);
    }
    if (b.kind === 'school') {
      wallFinish(box(0.9, 1, 0.9, '#ffffff', main.x, top + 0.5, main.z));
      mesh(new T.ConeGeometry(0.75, 0.6, 4), plan.trim, main.x, top + 1.3, main.z).rotation.y =
        Math.PI / 4;
      cylinder(0.18, 0.25, '#b9954d', main.x, top + 0.5, main.z + 0.5);
    }
  }
  if (b.kind === 'pub') {
    box(entry.v.width, 0.15, 0.1, plan.trim, entry.x, 2.75, entry.z);
    box(0.1, 0.1, 0.8, '#333f37', entry.x + entry.v.width * 0.35, 2.8, entry.z + 0.35);
    box(0.65, 0.5, 0.06, plan.trim, entry.x + entry.v.width * 0.35, 2.45, entry.z + 0.7);
  }
  if (b.kind === 'mill') {
    const left = vs.reduce((a, v) => (v.x - v.width / 2 < a.x - a.width / 2 ? v : a), main);
    const x = left.x - left.width / 2 - 0.18,
      z = left.z,
      r = 1.4;
    mesh(new T.TorusGeometry(r, 0.12, 5, 20), '#826841', x, 1.65, z).rotation.y = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const spoke = box(0.12, r * 2, 0.12, '#826841', x, 1.65, z);
      spoke.rotation.x = a;
    }
  }
  if (['waterworks'].includes(b.kind)) {
    // Tanks sit on a supported roof deck (not suspended beside a changed roof).
    const deck = vs.find((v) => v.roof === 'flat') ?? main;
    const radius = Math.min(0.8, deck.width * 0.18, deck.depth * 0.18),
      y = deck.eaves + deck.rise;
    box(radius * 2.2, 0.15, radius * 2.2, '#657a78', deck.x, y + 0.08, deck.z);
    cylinder(radius, 1.6, '#8aaca9', deck.x, y + 0.95, deck.z);
    for (const dy of [0.25, 1.5])
      mesh(
        new T.TorusGeometry(radius + 0.01, 0.045, 4, 16),
        '#cbd2c6',
        deck.x,
        y + dy,
        deck.z,
      ).rotation.x = Math.PI / 2;
    if (b.kind === 'waterworks') {
      const pipe = cylinder(0.13, 1.7, '#627c7f', -2.4, 0.3, -3.8);
      pipe.rotation.x = Math.PI / 2;
      box(0.8, 0.5, 0.7, '#4a737a', -2.4, 0.25, -3.1);
    }
  }
  if (['forge', 'factory', 'brickworks', 'roastery', 'sawmill'].includes(b.kind)) {
    const x = main.x + main.width * 0.25,
      z = main.z - main.depth * 0.2,
      h = top + 1.8;
    cylinder(0.3, h, '#7c7770', x, h / 2, z);
    (root.userData.chimneys ??= []).push(new T.Vector3(x, h + 0.2, z));
  }
  if (b.kind === 'henhouse') {
    box(0.5, 0.5, 0.06, '#322d24', entry.x + 0.75, 0.25, entry.z + 0.05);
    const ramp = box(0.6, 0.06, 0.9, '#997944', entry.x + 0.75, 0.12, entry.z + 0.45);
    ramp.rotation.x = -0.2;
  }
  if (b.kind === 'haybarn') {
    const bales = new T.InstancedMesh(
      new T.BoxGeometry(1.2, 0.7, 0.85),
      detailMaterial('hay', '#ffffff', 0.04),
      9,
    );
    for (let i = 0; i < 9; i++)
      bales.setMatrixAt(
        i,
        new T.Matrix4().makeTranslation(
          entry.x - 1.3 + (i % 3) * 1.3,
          0.4 + Math.floor(i / 3) * 0.72,
          entry.z + 0.55,
        ),
      );
    bales.userData.hayStack = true;
    bales.count = Math.min(9, Math.ceil(Math.max(0, b.stock.hay ?? 0) / 50));
    bales.computeBoundingSphere();
    root.add(bales);
  }
  if (b.kind === 'scripted') {
    const bed = vs.find((v) => v.eaves < 1.5)!;
    box(bed.width - 0.1, 0.05, bed.depth - 0.1, '#514130', bed.x, bed.eaves + 0.03, bed.z);
    cylinder(0.18, 3, '#726146', bed.x, bed.eaves + 1.5, bed.z);
    mesh(new T.IcosahedronGeometry(1.25, 1), '#60754a', bed.x, bed.eaves + 3.4, bed.z);
  }
  if (b.kind === 'starport') {
    root.add(spaceportModel());
    const tower = vs.reduce((a, v) => (v.eaves > a.eaves ? v : a), main);
    cylinder(0.05, 2, '#637b7c', tower.x, tower.eaves + tower.rise + 1, tower.z);
    const dish = mesh(
      new T.SphereGeometry(0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      '#cad7d2',
      tower.x,
      tower.eaves + tower.rise + 0.7,
      tower.z,
    );
    dish.rotation.x = -0.7;
  }
}
