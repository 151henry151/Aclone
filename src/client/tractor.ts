// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { contactShadow } from './materials';
import { createHuman } from './human';
/** Original detailed model. +Z is forward; wheel groups rotate about their X axle. */
export function tractor(g: T.Group, color: string) {
  const paint = new T.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.22 });
  const cream = new T.MeshStandardMaterial({ color: '#e0d4b6', roughness: 0.5, metalness: 0.15 });
  const steel = new T.MeshStandardMaterial({ color: '#454945', roughness: 0.46, metalness: 0.5 });
  const rubber = new T.MeshStandardMaterial({ color: '#242822', roughness: 0.95 });
  const black = new T.MeshStandardMaterial({ color: '#333a35', roughness: 0.72 });
  const glass = new T.MeshStandardMaterial({
    color: '#a9cbd4',
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const add = (
    parent: T.Group,
    geometry: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new T.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = !mat.transparent;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (
    parent: T.Group,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    round = 0,
  ) =>
    add(
      parent,
      round ? new RoundedBoxGeometry(w, h, d, 2, round) : new T.BoxGeometry(w, h, d),
      mat,
      x,
      y,
      z,
    );
  box(g, 1.65, 0.45, 3.75, steel, 0, 1, 0, 0.08);
  box(g, 1.6, 1.12, 2.18, paint, 0, 1.77, 0.99, 0.17);
  // Raised bonnet seam, radiator surround, black inset and individual grille bars.
  box(g, 0.045, 0.025, 2, cream, 0, 2.34, 1);
  box(g, 1.5, 0.92, 0.1, cream, 0, 1.74, 2.1, 0.05);
  box(g, 1.28, 0.72, 0.12, black, 0, 1.74, 2.17);
  for (let i = 0; i < 10; i++) box(g, 0.048, 0.69, 0.025, steel, -0.56 + i * 0.124, 1.74, 2.24);
  box(g, 1.95, 0.23, 0.28, steel, 0, 0.99, 2.26, 0.04);
  // Engine vents and a narrow maker stripe are geometry, readable at driving distance.
  for (const side of [-1, 1]) {
    box(g, 0.035, 0.09, 1.75, cream, side * 0.809, 2.05, 1.05);
    for (let i = 0; i < 7; i++)
      box(g, 0.04, 0.25, 0.04, black, side * 0.818, 1.69, 0.55 + i * 0.15);
    box(g, 0.54, 0.16, 2.15, paint, side * 1.08, 2.14, -1, 0.09);
    box(g, 0.11, 0.82, 1.6, paint, side * 0.86, 1.71, -1);
    box(g, 0.48, 0.13, 0.8, steel, side * 1.04, 0.73, -0.4);
    box(g, 0.36, 0.13, 0.64, steel, side * 0.98, 1.06, -0.4);
    // Cab door posts and sills frame genuine transparent glazing.
    for (const z of [-1.72, 0.07]) box(g, 0.095, 1.7, 0.095, cream, side * 0.82, 2.88, z);
    box(g, 0.08, 0.09, 1.83, cream, side * 0.82, 2.05, -0.82);
    box(g, 0.03, 1.38, 1.62, glass, side * 0.82, 2.87, -0.82);
    box(g, 0.06, 0.07, 0.3, steel, side * 0.88, 2.65, -0.25);
    box(g, 0.32, 0.25, 0.08, black, side * 1.12, 3.13, 0.02, 0.035);
    box(g, 0.28, 0.22, 0.025, glass, side * 1.12, 3.13, 0.071);
    box(g, 0.35, 0.04, 0.04, steel, side * 0.98, 3.1, 0);
    const lamp = add(
      g,
      new T.CylinderGeometry(0.19, 0.2, 0.13, 16),
      cream,
      side * 0.62,
      2.02,
      2.25,
    );
    lamp.rotation.x = Math.PI / 2;
    const lens = add(
      g,
      new T.CircleGeometry(0.15, 16),
      new T.MeshStandardMaterial({
        color: '#fff0c5',
        emissive: '#ffe4a0',
        emissiveIntensity: 0.45,
        roughness: 0.2,
      }),
      side * 0.62,
      2.02,
      2.33,
    );
    lens.castShadow = false;
    box(
      g,
      0.14,
      0.13,
      0.08,
      new T.MeshStandardMaterial({
        color: '#b3321e',
        emissive: '#8c2813',
        emissiveIntensity: 0.25,
      }),
      side * 1.12,
      2.24,
      -1.9,
    );
  }
  for (const z of [-1.74, 0.09]) {
    box(g, 1.59, 1.42, 0.025, glass, 0, 2.88, z);
    box(g, 1.72, 0.09, 0.08, cream, 0, 3.68, z);
    box(g, 1.7, 0.09, 0.08, cream, 0, 2.1, z);
  }
  box(g, 1.92, 0.19, 2.07, cream, 0, 3.81, -0.8, 0.08);
  const wiper = box(g, 0.035, 0.75, 0.025, black, -0.2, 2.89, 0.12);
  wiper.rotation.z = -0.4;
  // Seat, driver, steering wheel and controls visible through the cab.
  box(g, 0.9, 0.18, 0.75, black, 0, 2.1, -0.95, 0.08);
  box(g, 0.9, 0.66, 0.16, black, 0, 2.37, -1.3, 0.08);
  const driver = createHuman('seated');
  driver.group.position.set(0, 2.2, -0.85);
  g.add(driver.group);
  g.userData.driver = driver.group;
  const steering = add(g, new T.TorusGeometry(0.29, 0.033, 6, 16), black, 0, 2.62, -0.1);
  steering.rotation.x = -0.8;
  const pipe = add(g, new T.CylinderGeometry(0.095, 0.11, 1.65, 10), steel, -0.57, 2.94, 0.78);
  box(g, 0.3, 0.12, 0.24, black, pipe.position.x, 3.78, 0.78, 0.04);
  // Rounded sidewalls, recessed hubs, wheel bolts and alternating chevron lugs.
  for (const x of [-1.22, 1.22])
    for (const z of [-1.15, 1.37]) {
      const rear = z < 0,
        r = rear ? 1 : 0.65,
        width = rear ? 0.58 : 0.4,
        assembly = new T.Group();
      assembly.position.set(x, rear ? 1 : 0.68, z);
      g.add(assembly);
      (g.userData.wheels ??= []).push(assembly);
      const tire = add(
        assembly,
        new T.TorusGeometry(r - width * 0.36, width * 0.36, 8, 24),
        rubber,
        0,
        0,
        0,
      );
      tire.rotation.y = Math.PI / 2;
      const fill = add(
        assembly,
        new T.CylinderGeometry(r * 0.76, r * 0.76, width * 0.84, 24),
        rubber,
        0,
        0,
        0,
      );
      fill.rotation.z = Math.PI / 2;
      for (let i = 0; i < 18; i++)
        for (const side of [-1, 1]) {
          const a = (i * Math.PI) / 9 + side * 0.08,
            lug = box(
              assembly,
              width * 0.58,
              0.12,
              rear ? 0.29 : 0.2,
              rubber,
              side * width * 0.22,
              Math.cos(a) * (r - 0.04),
              Math.sin(a) * (r - 0.04),
              0,
            );
          lug.rotation.set(a, side * 0.42, 0);
        }
      for (const side of [-1, 1]) {
        const rim = add(
          assembly,
          new T.CylinderGeometry(r * 0.47, r * 0.47, 0.08, 20),
          cream,
          side * width * 0.47,
          0,
          0,
        );
        rim.rotation.z = Math.PI / 2;
        const hub = add(
          assembly,
          new T.CylinderGeometry(r * 0.19, r * 0.19, 0.14, 12),
          paint,
          side * width * 0.53,
          0,
          0,
        );
        hub.rotation.z = Math.PI / 2;
        for (let j = 0; j < 6; j++) {
          const a = (j * Math.PI) / 3;
          const bolt = add(
            assembly,
            new T.CylinderGeometry(0.035, 0.035, 0.05, 6),
            steel,
            side * width * 0.55,
            Math.sin(a) * r * 0.31,
            Math.cos(a) * r * 0.31,
          );
          bolt.rotation.z = Math.PI / 2;
        }
      }
      batch(assembly);
    }
  const shade = contactShadow(4.7, 6.5, 0.52);
  shade.position.y = 0.035;
  g.add(shade);
  batch(g);
}
/** Batch the stationary body and each animated wheel separately. */
function batch(group: T.Group) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  for (const o of [...group.children]) {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material) || o.material.transparent) continue;
    o.updateMatrix();
    const geos = batches.get(o.material) ?? [];
    geos.push(
      (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix),
    );
    batches.set(o.material, geos);
    o.geometry.dispose();
    group.remove(o);
  }
  for (const [material, geos] of batches) {
    const merged = mergeGeometries(geos)!;
    geos.forEach((g) => g.dispose());
    const m = new T.Mesh(merged, material);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
}
