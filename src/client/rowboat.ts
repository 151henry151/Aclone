// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { vehicles } from '../shared/catalog';
import { ROWBOAT } from '../shared/rowboat-rules';
import type { VehicleDef } from '../shared/types';
/** Open clinker hull, flat floor and overlapping strakes; no hidden outboard or tank. */
export function createRowboat(color = vehicles[ROWBOAT].color, v: VehicleDef = vehicles[ROWBOAT]) {
  const group = new T.Group(),
    fixed = new T.Group();
  group.add(fixed);
  const wood = new T.MeshStandardMaterial({ color, roughness: 0.9, side: T.DoubleSide }),
    trim = new T.MeshStandardMaterial({ color: '#c6a577', roughness: 0.9 });
  const length = v.length!,
    beam = v.beam!;
  const mesh = (g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = fixed) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    px: number,
    py: number,
    pz: number,
    parent = fixed,
  ) => mesh(new T.BoxGeometry(x, y, z), trim, px, py, pz, parent);
  const sections = [
    [-0.5, 0.65],
    [-0.4, 0.9],
    [0, 1],
    [0.32, 0.75],
    [0.5, 0],
  ];
  for (const side of [-1, 1])
    for (let strake = 0; strake < 4; strake++) {
      const positions: number[] = [],
        indices: number[] = [];
      for (const [z, width] of sections) {
        for (const edge of [0, 1]) {
          const t = (strake + edge) / 4;
          positions.push(
            side * beam * 0.5 * width * (0.64 + 0.36 * t) + (edge === 0 ? side * 0.012 : 0),
            -0.13 + t * 0.7 + Math.max(0, z) * 0.14,
            z * length,
          );
        }
      }
      for (let i = 0; i < sections.length - 1; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      mesh(g, wood);
    }
  box(beam * 0.66, 0.07, length * 0.77, 0, 0.09, -length * 0.06);
  box(beam * 0.65, 0.65, 0.06, 0, 0.22, -length * 0.5);
  for (const z of [-0.3, 0.05, 0.3])
    box(beam * (z === 0.3 ? 0.7 : 0.88), 0.08, 0.28, 0, 0.52, z * length);
  for (const side of [-1, 1])
    for (let i = 0; i < sections.length - 1; i++) {
      const [z, width] = sections[i],
        [next, nextWidth] = sections[i + 1];
      const a = new T.Vector3(side * beam * 0.5 * width, 0.58 + Math.max(0, z) * 0.14, z * length),
        b = new T.Vector3(
          side * beam * 0.5 * nextWidth,
          0.58 + Math.max(0, next) * 0.14,
          next * length,
        ),
        delta = b.clone().sub(a);
      const rail = mesh(new T.CylinderGeometry(0.025, 0.025, delta.length(), 6), trim);
      rail.position.copy(a.add(b).multiplyScalar(0.5));
      rail.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    }
  const oars: T.Group[] = [];
  for (const side of [-1, 1]) {
    const oar = new T.Group();
    oar.position.set(side * beam * 0.47, 0.6, 0);
    group.add(oar);
    mesh(
      new T.CylinderGeometry(0.022, 0.022, 1.6, 7).rotateZ(Math.PI / 2),
      trim,
      side * 0.45,
      0,
      0,
      oar,
    );
    box(0.5, 0.03, 0.15, side * 1.2, 0, 0, oar);
    oars.push(oar);
    oar.rotation.y = (side === 1 ? 1 : -1) * 1.35;
  }
  const driver = createHuman('seated').group;
  driver.position.set(0, 0.57, 0.05 * length);
  driver.rotation.y = Math.PI;
  group.add(driver);
  group.userData.driver = driver;
  group.userData.eye = new T.Vector3(0, 1.45, 0.05 * length);
  group.userData.viewPitch = -0.12;
  batch(fixed);
  let phase = 0;
  return {
    group,
    oars,
    animate(dt: number, speed: number, rowing = true) {
      phase += dt * 2.5;
      for (let i = 0; i < 2; i++) {
        oars[i].rotation.y =
          rowing && Math.abs(speed) > 0.05 ? Math.sin(phase) * 0.45 : (i ? 1 : -1) * 1.35;
        oars[i].rotation.z = rowing && Math.abs(speed) > 0.05 ? Math.cos(phase) * 0.1 : 0;
      }
    },
  };
}
