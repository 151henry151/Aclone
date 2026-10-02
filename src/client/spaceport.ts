// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { spaceportApron } from '../shared/building-shapes';

/** Original static rocket/apron kit. Opaque materials join the ordinary scenery batches;
 * emissive markers need no extra lights, particle systems or per-frame work. */
export function spaceportModel() {
  const root = new T.Group();
  root.name = 'Spaceport landing apron';
  const colors = {
    ivory: '#e5e3d5',
    teal: '#517b7e',
    orange: '#b9583b',
    steel: '#829d9c',
    dark: '#283a40',
    pad: '#697573',
    amber: '#e6bd65',
    glass: '#416f86',
  };
  type Finish = keyof typeof colors;
  const materials = Object.fromEntries(
    Object.entries(colors).map(([key, color]) => [
      key,
      new T.MeshStandardMaterial({
        color,
        roughness: key === 'glass' ? 0.22 : key === 'pad' ? 0.95 : 0.52,
        metalness: key === 'steel' ? 0.6 : 0.18,
      }),
    ]),
  ) as Record<Finish, T.MeshStandardMaterial>;
  const beacon = new T.MeshStandardMaterial({
    color: '#efca75',
    emissive: '#e6bd65',
    roughness: 0.45,
  });
  const mesh = (
    g: T.BufferGeometry,
    finish: Finish | T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new T.Mesh(g, typeof finish === 'string' ? materials[finish] : finish);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, finish: Finish, x: number, y: number, z: number) =>
    mesh(new T.BoxGeometry(w, h, d), finish, x, y, z);
  const cylinder = (
    top: number,
    bottom: number,
    h: number,
    finish: Finish,
    x: number,
    y: number,
    z: number,
    segments = 32,
  ) => mesh(new T.CylinderGeometry(top, bottom, h, segments), finish, x, y, z);
  const strut = (a: T.Vector3, b: T.Vector3, radius: number, finish: Finish) => {
    const m = mesh(new T.CylinderGeometry(radius, radius, a.distanceTo(b), 8), finish, 0, 0, 0);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const { x, z, radius } = spaceportApron;
  cylinder(radius, radius, 0.12, 'pad', x, 0.06, z, 64);
  cylinder(2.6, 2.6, 0.025, 'dark', x, 0.135, z, 48);
  for (const r of [3.55, 4.6]) {
    const ring = mesh(new T.RingGeometry(r - 0.065, r + 0.065, 64), 'ivory', x, 0.15, z);
    ring.rotation.x = -Math.PI / 2;
  }
  // Painted radial alignment marks and low inset perimeter beacons.
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    const mark = box(
      0.2,
      0.025,
      0.42,
      i % 2 ? 'dark' : 'amber',
      x + Math.sin(a) * 4.95,
      0.14,
      z + Math.cos(a) * 4.95,
    );
    mark.rotation.y = a;
    if (i % 3 === 0) {
      cylinder(0.15, 0.18, 0.16, 'dark', x + Math.sin(a) * 5.1, 0.18, z + Math.cos(a) * 5.1, 8);
      mesh(
        new T.SphereGeometry(0.11, 8, 6),
        beacon,
        x + Math.sin(a) * 5.1,
        0.3,
        z + Math.cos(a) * 5.1,
      );
    }
  }
  // Smooth lathed hull, tapered capsule and nose: roughly ten metres above the pad.
  const profile = [
    [0, 1.6],
    [0.8, 1.6],
    [1.25, 2.15],
    [1.3, 3],
    [1.3, 6.6],
    [1.24, 7.15],
    [1.05, 7.75],
    [0.7, 8.65],
    [0.32, 9.45],
    [0, 10.1],
  ];
  mesh(
    new T.LatheGeometry(
      profile.map(([r, y]) => new T.Vector2(r, y)),
      40,
    ),
    'ivory',
    x,
    0,
    z,
  );
  cylinder(1.31, 1.31, 0.7, 'teal', x, 5.65, z, 40);
  cylinder(1.315, 1.315, 0.14, 'orange', x, 5.18, z, 40);
  for (const y of [2.55, 4, 6.55]) {
    const seam = mesh(new T.TorusGeometry(1.302, 0.027, 4, 40), 'steel', x, y, z);
    seam.rotation.x = Math.PI / 2;
  }
  cylinder(0.55, 0.88, 0.9, 'dark', x, 1.23, z);
  cylinder(0.9, 0.9, 0.12, 'steel', x, 0.8, z);
  cylinder(0.73, 0.73, 0.015, 'dark', x, 0.732, z);
  // Four thick swept fins and splayed landing struts; no paper-thin cone silhouette.
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const fin = new T.Shape();
    fin.moveTo(1.1, 4.2);
    fin.lineTo(1.45, 3.4);
    fin.lineTo(2.25, 1.05);
    fin.lineTo(2.25, 0.6);
    fin.lineTo(1.25, 1.8);
    fin.closePath();
    const geo = new T.ExtrudeGeometry(fin, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 1,
      steps: 1,
    });
    geo.translate(0, 0, -0.07);
    const m = mesh(geo, 'orange', x, 0, z);
    m.rotation.y = angle;
    const point = (r: number, y: number) =>
      new T.Vector3(x + Math.cos(angle) * r, y, z - Math.sin(angle) * r);
    strut(point(1.15, 2.7), point(2.08, 0.3), 0.075, 'steel');
    cylinder(
      0.27,
      0.34,
      0.14,
      'dark',
      x + Math.cos(angle) * 2.08,
      0.23,
      z - Math.sin(angle) * 2.08,
      12,
    );
  }
  for (const a of [-0.5, 0, 0.5, Math.PI]) {
    const window = mesh(
      new T.SphereGeometry(0.29, 16, 10),
      'glass',
      x + Math.sin(a) * 1.11,
      7.45,
      z + Math.cos(a) * 1.11,
    );
    window.scale.set(1, 1.1, 0.3);
    window.rotation.y = a;
    const rim = mesh(
      new T.TorusGeometry(0.3, 0.04, 6, 20),
      'steel',
      window.position.x,
      7.45,
      window.position.z,
    );
    rim.rotation.y = a;
  }
  // Service mast: ladder, cross braces and an umbilical at the docking collar.
  for (const dz of [-0.65, 0.65]) box(0.17, 6.8, 0.17, 'steel', -7.4, 3.4, -3.8 + dz);
  for (let y = 0.5; y < 6.8; y += 0.5) box(0.18, 0.07, 1.35, 'dark', -7.4, y, -3.8);
  for (let y = 0.2; y < 6; y += 1.5)
    strut(new T.Vector3(-7.4, y, -4.45), new T.Vector3(-7.4, y + 1.5, -3.15), 0.055, 'steel');
  strut(new T.Vector3(-7.4, 5.65, -3.15), new T.Vector3(x + 0.9, 5.65, z - 0.9), 0.11, 'teal');
  box(0.65, 0.7, 0.65, 'teal', -7.4, 0.5, -3.8);
  mesh(new T.SphereGeometry(0.12, 8, 6), beacon, -7.4, 6.93, -3.8);
  return root;
}
