import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Airfield } from '../shared/airfield';

export function airfieldModel(a: Airfield) {
  const root = new T.Group();
  root.name = 'Marked parish runway';
  root.position.set(a.x, a.height + 0.075, a.z);
  const asphalt = new T.MeshStandardMaterial({ color: '#454b4a', roughness: 0.95 });
  const white = new T.MeshStandardMaterial({ color: '#f4eddb', roughness: 0.85 });
  const markings: T.BufferGeometry[] = [];
  function stripe(
    x: number,
    z: number,
    width: number,
    length: number,
    material = white,
    lift = 0.008,
  ) {
    const m = new T.Mesh(new T.PlaneGeometry(width, length), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, lift, z);
    m.receiveShadow = true;
    if (material === white) {
      m.updateMatrix();
      m.geometry.applyMatrix4(m.matrix);
      markings.push(m.geometry);
    } else root.add(m);
  }
  stripe(0, 0, a.width, a.length, asphalt, 0);
  for (const x of [-a.width / 2 + 0.4, a.width / 2 - 0.4]) stripe(x, 0, 0.22, a.length - 4);
  for (let z = -a.length / 2 + 32; z < a.length / 2 - 25; z += 20) stripe(0, z, 0.35, 8);
  for (const sign of [-1, 1]) {
    for (const x of [-6, -4, -2, 2, 4, 6]) stripe(x, sign * (a.length / 2 - 7), 1, 8);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#f4eddb';
    c.font = 'bold 100px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(sign < 0 ? '18' : '36', 64, 64);
    const m = new T.Mesh(
      new T.PlaneGeometry(5, 7),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    m.rotation.set(-Math.PI / 2, 0, sign < 0 ? Math.PI : 0);
    m.position.set(0, 0.015, sign * (a.length / 2 - 20));
    root.add(m);
  }
  const merged = mergeGeometries(markings);
  for (const g of markings) g.dispose();
  const paint = new T.Mesh(merged, white);
  paint.receiveShadow = true;
  root.add(paint);
  // Reflective edge markers; no extra dynamic lights or shadows.
  const lamp = new T.MeshBasicMaterial({ color: '#fff1b0' });
  const geo = new T.SphereGeometry(0.12, 6, 4);
  const lights = new T.InstancedMesh(geo, lamp, 26);
  const transform = new T.Matrix4();
  let i = 0;
  for (const x of [-a.width / 2 - 0.5, a.width / 2 + 0.5])
    for (let z = -a.length / 2; z <= a.length / 2; z += a.length / 12)
      lights.setMatrixAt(i++, transform.makeTranslation(x, 0.18, z));
  root.add(lights);
  return root;
}
