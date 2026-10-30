// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { createHuman } from './human';
import { batch } from './tractor';
import { createRescueFlare, flarePosition } from './lifeboat-flare';

/** Compact survival raft: closed twin chambers, open rowing station and a rear shelter. */
export function createLifeboat(occupied = true) {
  const group = new T.Group(),
    body = new T.Group();
  group.name = 'Inflatable survival lifeboat';
  group.add(body);
  const orange = new T.MeshStandardMaterial({ color: '#ec681d', roughness: 0.76 });
  const canvas = new T.MeshStandardMaterial({
    color: '#f88928',
    roughness: 0.96,
    side: T.DoubleSide,
  });
  const dark = new T.MeshStandardMaterial({ color: '#263032', roughness: 0.95 });
  const silver = new T.MeshStandardMaterial({ color: '#d9e3d5', roughness: 0.5 });
  const rope = new T.MeshStandardMaterial({ color: '#e1cb91', roughness: 1 });
  const metal = new T.MeshStandardMaterial({ color: '#8b999a', metalness: 0.5, roughness: 0.45 });
  function mesh(
    geometry: T.BufferGeometry,
    material: T.Material,
    x = 0,
    y = 0,
    z = 0,
    parent = body,
  ) {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function box(w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) {
    return mesh(new T.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function line(points: T.Vector3[], radius: number, material: T.Material, closed = false) {
    const curve = new T.CatmullRomCurve3(points, closed, 'centripetal');
    return mesh(
      new T.TubeGeometry(curve, Math.max(12, points.length * 5), radius, 6, closed),
      material,
    );
  }
  const ring = (y: number) =>
    [
      [-0.65, y, -1.1],
      [-0.78, y, -0.72],
      [-0.78, y, 0.68],
      [-0.56, y, 1.2],
      [0, y, 1.35],
      [0.56, y, 1.2],
      [0.78, y, 0.68],
      [0.78, y, -0.72],
      [0.65, y, -1.1],
      [0, y, -1.3],
    ].map((p) => new T.Vector3(...p));
  for (const y of [0.01, 0.37]) line(ring(y), 0.23, orange, true);
  line(
    ring(0.08).map((p) => p.multiply(new T.Vector3(1.22, 1, 1.1))),
    0.038,
    dark,
    true,
  );
  // Recessed insulated floor and soft thwarts replace the rigid timber/transom hull.
  const floor = mesh(new T.CircleGeometry(1, 24), dark, 0, 0.06, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(0.73, 1.25, 1);
  for (let z = -0.9; z < 1; z += 0.18) box(1.15, 0.025, 0.012, metal, 0, 0.075, z);
  for (const z of [0.05, -0.68]) {
    const seat = mesh(new T.CapsuleGeometry(0.1, 1.0, 3, 8), dark, 0, 0.36, z);
    seat.rotation.z = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    // Segmented grab line, secured to visible welded attachment patches.
    const points: T.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const z = -1.05 + i * 0.175;
      points.push(
        new T.Vector3(
          side * (0.99 + Math.sin((i * Math.PI) / 3) ** 2 * 0.06),
          0.34 - Math.sin((i * Math.PI) / 3) ** 2 * 0.09,
          z,
        ),
      );
      if (i % 3 === 0) box(0.08, 0.045, 0.12, dark, side * 0.98, 0.37, z);
    }
    line(points, 0.015, rope);
    for (const z of [-0.8, 0.65]) {
      const band = mesh(
        new T.TorusGeometry(0.237, 0.025, 3, 12, Math.PI),
        silver,
        side * 0.78,
        0.37,
        z,
      );
      band.rotation.z = side < 0 ? Math.PI : 0;
    }
    for (const z of [-0.35, 0.35])
      mesh(new T.CylinderGeometry(0.04, 0.04, 0.025, 8), dark, side * 0.78, 0.61, z);
  }
  // Short arched storm hood; its open front leaves sight and oar travel clear.
  const vertices: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const arch = (i: number, z: number) =>
    new T.Vector3(
      -0.7 * Math.cos((i * Math.PI) / 12),
      0.6 + Math.sin((i * Math.PI) / 12) * 1.02,
      z,
    );
  for (let j = 0; j < 2; j++)
    for (let i = 0; i <= 12; i++) {
      const p = arch(i, j === 0 ? -1.03 : -0.34);
      vertices.push(p.x, p.y, p.z);
      uv.push(i / 12, j);
      if (j === 0 && i < 12) {
        const a = i;
        indices.push(a, a + 13, a + 1, a + 1, a + 13, a + 14);
      }
    }
  const hood = new T.BufferGeometry();
  hood.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  hood.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  hood.setIndex(indices);
  hood.computeVertexNormals();
  mesh(hood, canvas);
  const backShape = new T.Shape();
  backShape.moveTo(-0.7, 0.6);
  for (let i = 0; i <= 12; i++) {
    const p = arch(i, 0);
    backShape.lineTo(p.x, p.y);
  }
  backShape.closePath();
  mesh(new T.ShapeGeometry(backShape), canvas, 0, 0, -1.03);
  for (const z of [-1.03, -0.34])
    line(
      Array.from({ length: 13 }, (_, i) => arch(i, z)),
      0.027,
      dark,
    );
  for (const side of [-1, 1]) {
    const strip = box(0.16, 0.018, 0.42, silver, side * 0.41, 1.44, -0.69);
    strip.rotation.z = side * -0.52;
  }
  // Pack, boarding straps and a rolled-up ladder stay clear of the rowing station.
  box(0.43, 0.23, 0.35, dark, 0, 0.2, -0.9);
  for (const x of [-0.25, 0.25])
    line([new T.Vector3(x, 0.34, 1.48), new T.Vector3(x, -0.14, 1.6)], 0.018, rope);
  for (const y of [0.22, 0.05, -0.12]) box(0.52, 0.025, 0.05, dark, 0, y, 1.6);
  const holder = box(0.09, 0.26, 0.11, dark, flarePosition.x, 0.65, flarePosition.z);
  holder.rotation.z = -0.12;
  batch(body);

  const oars: T.Group[] = [];
  for (const side of [-1, 1]) {
    const oar = new T.Group();
    oar.position.set(side * 0.86, 0.62, 0.62);
    group.add(oar);
    oars.push(oar);
    const shaft = mesh(
      new T.CylinderGeometry(0.023, 0.023, 1.65, 8),
      metal,
      side * 0.28,
      0,
      0,
      oar,
    );
    shaft.rotation.z = Math.PI / 2;
    const grip = mesh(new T.CylinderGeometry(0.03, 0.03, 0.27, 8), dark, -side * 0.48, 0, 0, oar);
    grip.rotation.z = Math.PI / 2;
    const blade = mesh(new T.CapsuleGeometry(0.1, 0.35, 3, 8), orange, side * 1.25, 0, 0, oar);
    blade.rotation.z = Math.PI / 2;
    blade.scale.set(1, 0.95, 0.26);
    batch(oar);
  }
  if (occupied) {
    const person = createHuman('walking').group;
    person.getObjectByName('hips')!.position.y = 0;
    for (const side of [-1, 1]) {
      person.getObjectByName(`thigh-${side}`)!.rotation.x = -1.38;
      person.getObjectByName(`shin-${side}`)!.rotation.x = 1.43;
      person.getObjectByName(`foot-${side}`)!.rotation.x = -0.05;
    }
    person.position.set(0, 0.46, 0.05);
    group.add(person);
    group.userData.driver = person;
    const flare = createRescueFlare();
    group.add(flare.group);
    group.userData.flare = flare;
  }
  group.userData.row = (time: number, speed: number) => {
    const effort = Math.min(1, Math.abs(speed)),
      phase = time * 3;
    oars.forEach((o, i) => {
      const side = i === 0 ? -1 : 1;
      o.rotation.y = side * (0.12 + Math.sin(phase) * 0.45 * effort);
      o.rotation.z = side * (0.03 + Math.cos(phase) * 0.13 * effort);
    });
    const person = group.userData.driver as T.Group | undefined;
    if (person) {
      person.getObjectByName('torso')!.rotation.x = 0.1 + Math.sin(phase) * 0.055 * effort;
      for (const side of [-1, 1]) {
        person
          .getObjectByName(`arm-${side}`)!
          .rotation.set(-1.05 - Math.sin(phase) * 0.17 * effort, 0, side * 0.23);
        person.getObjectByName(`forearm-${side}`)!.rotation.x =
          -0.46 + Math.sin(phase) * 0.12 * effort;
      }
    }
    group.userData.flare?.animate(time);
  };
  group.userData.row(0, 0);
  group.userData.eye = new T.Vector3(0, 1.3, 0.05);
  group.userData.viewPitch = -0.06;
  return group;
}
