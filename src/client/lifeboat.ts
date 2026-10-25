// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { createHuman } from './human';
import { batch } from './tractor';
export function createLifeboat(occupied = true) {
  const group = new T.Group(),
    body = new T.Group();
  group.add(body);
  const orange = new T.MeshStandardMaterial({ color: '#ec762e', roughness: 0.7 });
  const dark = new T.MeshStandardMaterial({ color: '#303b3d', roughness: 0.9 });
  const wood = new T.MeshStandardMaterial({ color: '#ba9868', roughness: 0.85 });
  function box(w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    body.add(m);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  const oars: T.Group[] = [];
  for (const side of [-1, 1]) {
    const tube = new T.Mesh(new T.CapsuleGeometry(0.3, 2.2, 4, 10), orange);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(side * 0.64, 0.15, 0);
    body.add(tube);
    box(0.04, 0.12, 2.1, dark, side * 0.94, 0.2, 0);
    const oar = new T.Group();
    oar.position.set(side * 0.78, 0.4, -0.1);
    group.add(oar);
    oars.push(oar);
    const handle = new T.Mesh(new T.BoxGeometry(1.2, 0.06, 0.07), wood);
    handle.position.x = side * 0.3;
    oar.add(handle);
    const blade = new T.Mesh(new T.BoxGeometry(0.7, 0.06, 0.27), wood);
    blade.position.x = side * 1.2;
    oar.add(blade);
  }
  const bow = new T.Mesh(new T.CapsuleGeometry(0.3, 1.28, 4, 10), orange);
  bow.rotation.z = Math.PI / 2;
  bow.position.set(0, 0.15, 1.1);
  body.add(bow);
  box(1.25, 0.15, 2.25, dark, 0, -0.05, 0);
  box(1.3, 0.12, 0.35, wood, 0, 0.26, -0.6);
  box(1.3, 0.12, 0.35, wood, 0, 0.26, 0.5);
  box(1.22, 0.48, 0.12, dark, 0, 0.08, -1.17);
  batch(body);
  if (occupied) {
    const person = createHuman('seated').group;
    person.position.set(0, 0.32, -0.6);
    group.add(person);
    group.userData.driver = person;
  }
  group.userData.row = (time: number, speed: number) =>
    oars.forEach((o, i) => {
      o.rotation.y = (i ? 1 : -1) * (0.3 + Math.sin(time * 3) * 0.5 * Math.min(1, Math.abs(speed)));
    });
  group.userData.eye = new T.Vector3(0, 1.16, -0.6);
  group.userData.viewPitch = -0.06;
  return group;
}
