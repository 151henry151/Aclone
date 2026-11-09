// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { detailTexture } from './detail-textures';
import { vehicleLamp } from './vehicle-lights';
import { vehicleDef } from '../shared/vehicle-config';
import { BULLDOZER } from '../shared/earthmoving-definitions';
import type { World } from '../shared/types';

/** Static subassemblies are batched; only joints, wheels and instanced plates move. */
export function createEarthmover(world: World, slot: number, color?: string) {
  const v = vehicleDef(world, slot),
    dozer = slot === BULLDOZER,
    w = v.width!,
    l = v.length!,
    h = v.height!;
  const root = new T.Group();
  root.name = v.name;
  const mat = (color: string, metalness = 0) =>
    new T.MeshStandardMaterial({ color, metalness, roughness: 0.72 });
  const paint = mat(color ?? v.color, 0.25),
    steel = mat('#3c4345', 0.5),
    alloy = mat('#abb2b0', 0.65),
    rubber = mat('#24282a'),
    seat = mat('#34382d');
  paint.map = detailTexture('paint');
  rubber.map = detailTexture('tyre');
  const glass = new T.MeshStandardMaterial({
    color: '#91b3b6',
    transparent: true,
    opacity: 0.15,
    roughness: 0.3,
    depthWrite: false,
  });
  const lens = (color: string, intensity: number) => {
    const material = mat(color);
    material.emissive.set(color);
    return vehicleLamp(material, intensity);
  };
  const white = lens('#eee4bd', 1.2),
    red = lens('#b54a30', 0.8);
  const groups: T.Group[] = [];
  const group = (name: string, parent: T.Object3D = root) => {
    const g = new T.Group();
    g.name = name;
    parent.add(g);
    groups.push(g);
    return g;
  };
  const add = (
    g: T.Object3D,
    geo: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = !m.transparent;
    o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const box = (
    g: T.Object3D,
    x: number,
    y: number,
    z: number,
    a: number,
    b: number,
    c: number,
    m: T.Material = paint,
  ) => add(g, new T.BoxGeometry(a, b, c), m, x, y, z);
  const link = (g: T.Object3D, a: T.Vector3, b: T.Vector3, r: number, m: T.Material = alloy) => {
    const o = add(
      g,
      new T.CylinderGeometry(r, r, a.distanceTo(b), 8),
      m,
      ...(a.clone().add(b).multiplyScalar(0.5).toArray() as [number, number, number]),
    );
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const chassis = group('chassis'),
    cab = group('cab-shell'),
    interior = group('cab-interior'),
    exhaust = group('exhaust');
  box(chassis, 0, 1, 0, w * 0.64, 0.45, l * 0.62, steel);
  box(chassis, 0, 1.5, l * 0.17, w * 0.5, 0.65, l * 0.28);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++)
      box(chassis, side * w * 0.255, 1.52, l * 0.12 + i * 0.065, 0.035, 0.32, 0.023, steel);
    box(chassis, side * w * 0.3, 1.24, -0.35, 0.22, 0.1, 1, alloy);
    for (let step = 0; step < 2; step++)
      box(chassis, side * w * 0.31, 1.02 - step * 0.3, -0.2, 0.32, 0.08, 0.35, steel);
    box(chassis, side * w * 0.22, 1.75, l * 0.29, 0.24, 0.16, 0.08, white);
    box(chassis, side * w * 0.25, 1.1, -l * 0.29, 0.18, 0.12, 0.06, red);
  }
  const cabWidth = Math.min(w * 0.58, 1.8),
    cabDepth = 1.55,
    cabZ = -0.35,
    floor = 1.32;
  box(cab, 0, floor, cabZ, cabWidth, 0.15, cabDepth);
  box(cab, 0, h - 0.07, cabZ, cabWidth + 0.12, 0.14, cabDepth + 0.12);
  for (const side of [-1, 1])
    for (const end of [-1, 1])
      box(
        cab,
        (side * cabWidth) / 2,
        (h + floor) / 2,
        cabZ + (end * cabDepth) / 2,
        0.07,
        h - floor,
        0.07,
        steel,
      );
  for (const side of [-1, 1]) {
    box(
      cab,
      (side * cabWidth) / 2,
      (h + floor) / 2,
      cabZ,
      0.018,
      h - floor - 0.2,
      cabDepth - 0.12,
      glass,
    );
    box(cab, side * (cabWidth / 2 + 0.16), h - 0.65, cabZ + 0.45, 0.26, 0.18, 0.05, steel);
    box(cab, side * (cabWidth / 2 + 0.17), h - 0.65, cabZ + 0.48, 0.21, 0.13, 0.01, alloy);
    link(
      cab,
      new T.Vector3((side * cabWidth) / 2, 1.75, 0.35),
      new T.Vector3((side * cabWidth) / 2, 2.2, 0.35),
      0.025,
    );
  }
  for (const end of [-1, 1])
    box(
      cab,
      0,
      (h + floor) / 2,
      cabZ + (end * cabDepth) / 2,
      cabWidth - 0.1,
      h - floor - 0.2,
      0.018,
      glass,
    );
  box(interior, 0, 1.55, -0.5, 0.68, 0.14, 0.62, seat);
  box(interior, 0, 1.85, -0.77, 0.68, 0.55, 0.12, seat);
  box(interior, 0, 2.02, 0.25, 0.9, 0.16, 0.22, steel);
  for (const x of [-0.23, 0, 0.23])
    add(
      interior,
      new T.CylinderGeometry(0.065, 0.065, 0.025, 12).rotateX(Math.PI / 2),
      alloy,
      x,
      2.12,
      0.12,
    );
  for (const side of [-1, 1]) {
    box(interior, side * 0.4, 1.83, -0.25, 0.035, 0.35, 0.035, steel);
    add(interior, new T.SphereGeometry(0.055, 8, 6), rubber, side * 0.4, 2, -0.25);
  }
  const driver = createHuman('seated');
  driver.group.position.set(0, 1.55, -0.4);
  root.add(driver.group);
  root.userData.driver = driver.group;
  root.userData.eye = new T.Vector3(0, 2.65, -0.12);
  root.userData.viewPitch = -0.08;
  link(
    exhaust,
    new T.Vector3(-w * 0.2, 1.6, l * 0.13),
    new T.Vector3(-w * 0.2, h - 0.12, l * 0.13),
    0.065,
    steel,
  );
  box(exhaust, -w * 0.2, h - 0.1, l * 0.13, 0.2, 0.05, 0.18, steel);
  root.userData.exhaust = new T.Vector3(-w * 0.2, h, l * 0.13);
  root.userData.lamp = new T.Vector3(0, 1.75, l * 0.3);
  root.userData.reverseLamp = new T.Vector3(0, 1.3, -l * 0.3);
  root.userData.contacts = [-w * 0.32, w * 0.32].flatMap((x) =>
    [-l * 0.2, l * 0.2].map((z) => new T.Vector3(x, 0, z)),
  );
  root.userData.tyreFootprints = [];
  root.userData.wheels = [];
  const implement = group(dozer ? 'blade' : 'loader');
  let plates: T.InstancedMesh | undefined,
    phase = 0,
    workPhase = 0,
    lower = 0;
  let boom: T.Group | undefined,
    stick: T.Group | undefined,
    bucket: T.Group | undefined,
    legs: T.Group | undefined;
  if (dozer) {
    const radius = 0.52,
      straight = l * 0.42,
      perimeter = 2 * straight + 2 * Math.PI * radius,
      count = 36;
    plates = new T.InstancedMesh(new T.BoxGeometry(w * 0.2, 0.09, 0.22), steel, count * 2);
    plates.name = 'track-plates';
    plates.instanceMatrix.setUsage(T.DynamicDrawUsage);
    root.add(plates);
    plates.frustumCulled = false;
    const roller = group('track-rollers');
    for (const side of [-1, 1]) {
      root.userData.tyreFootprints.push({
        position: new T.Vector3(side * w * 0.32, 0, 0),
        width: w * 0.2,
      });
      for (let i = 0; i < 6; i++) {
        const z = -straight / 2 + (i * straight) / 5;
        add(
          roller,
          new T.CylinderGeometry(0.4, 0.4, w * 0.16, 12).rotateZ(Math.PI / 2),
          rubber,
          side * w * 0.32,
          0.6,
          z,
        );
        add(
          roller,
          new T.CylinderGeometry(0.2, 0.2, w * 0.17, 10).rotateZ(Math.PI / 2),
          paint,
          side * w * 0.32,
          0.6,
          z,
        );
      }
    }
    box(implement, 0, 0.6, l / 2 - 0.16, w, 1.05, 0.18);
    box(implement, 0, 0.07, l / 2 - 0.07, w, 0.12, 0.28, alloy);
    for (const side of [-1, 1]) {
      box(implement, side * w * 0.28, 0.4, l * 0.18, 0.16, 0.18, l * 0.49, steel);
      link(
        implement,
        new T.Vector3(side * w * 0.27, 0.65, 0.4),
        new T.Vector3(side * w * 0.27, 0.9, l / 2 - 0.2),
        0.065,
      );
      box(implement, side * (w / 2 - 0.05), 0.6, l / 2 - 0.12, 0.1, 1.05, 0.3, steel);
    }
    const dummy = new T.Object3D();
    let tracksReady = false;
    root.userData.moveTracks = (travel: number) => {
      if (travel === 0 && tracksReady) return;
      tracksReady = true;
      phase = (phase + travel) % perimeter;
      for (let side = 0; side < 2; side++)
        for (let i = 0; i < count; i++) {
          let d = ((((i / count) * perimeter + phase) % perimeter) + perimeter) % perimeter,
            y: number,
            z: number,
            angle: number;
          if (d < straight) {
            z = -straight / 2 + d;
            y = radius;
            angle = 0;
          } else if ((d -= straight) < Math.PI * radius) {
            const a = d / radius;
            z = straight / 2 + Math.sin(a) * radius;
            y = Math.cos(a) * radius;
            angle = a;
          } else if ((d -= Math.PI * radius) < straight) {
            z = straight / 2 - d;
            y = -radius;
            angle = Math.PI;
          } else {
            d -= straight;
            const a = d / radius;
            z = -straight / 2 - Math.sin(a) * radius;
            y = -Math.cos(a) * radius;
            angle = Math.PI + a;
          }
          dummy.position.set((side ? 1 : -1) * w * 0.32, 0.59 + y, z);
          dummy.rotation.set(angle, 0, 0);
          dummy.updateMatrix();
          plates!.setMatrixAt(side * count + i, dummy.matrix);
        }
      plates!.instanceMatrix.needsUpdate = true;
    };
  } else {
    for (const side of [-1, 1])
      for (const rear of [false, true]) {
        const r = rear ? 0.66 : 0.48,
          z = rear ? -l * 0.18 : l * 0.23,
          x = side * (w / 2 - 0.27),
          wheel = group('wheel');
        wheel.position.set(x, r, z);
        wheel.userData.radius = r;
        root.userData.wheels.push(wheel);
        add(wheel, new T.CylinderGeometry(r, r, 0.48, 16).rotateZ(Math.PI / 2), rubber, 0, 0, 0);
        add(
          wheel,
          new T.CylinderGeometry(r * 0.52, r * 0.52, 0.5, 12).rotateZ(Math.PI / 2),
          paint,
          0,
          0,
          0,
        );
        root.userData.tyreFootprints.push({ position: new T.Vector3(x, 0, z), width: 0.48 });
        box(chassis, x, r * 2 + 0.1, z, 0.55, 0.08, 1.2);
      }
    box(implement, 0, 0.25, l / 2 - 0.4, w * 0.85, 0.15, 0.8, steel);
    box(implement, 0, 0.62, l / 2 - 0.75, w * 0.85, 0.68, 0.12);
    for (const side of [-1, 1]) {
      box(implement, side * w * 0.4, 0.55, l / 2 - 0.4, 0.1, 0.7, 0.8);
      link(
        implement,
        new T.Vector3(side * 0.65, 1.2, 0.4),
        new T.Vector3(side * 0.65, 0.65, l / 2 - 0.7),
        0.1,
        paint,
      );
      link(
        implement,
        new T.Vector3(side * 0.55, 1.55, 0.2),
        new T.Vector3(side * 0.55, 0.8, l * 0.35),
        0.055,
      );
    }
    boom = group('boom');
    boom.position.set(0, 1.25, -l * 0.18);
    box(boom, 0, 0.9, 0, 0.32, 1.8, 0.3);
    link(boom, new T.Vector3(0, 0.15, 0.23), new T.Vector3(0, 1.5, 0.23), 0.07);
    stick = group('stick', boom);
    stick.position.y = 1.8;
    box(stick, 0, 0.7, 0, 0.23, 1.4, 0.23);
    link(stick, new T.Vector3(0, 0.1, 0.2), new T.Vector3(0, 1.1, 0.2), 0.055);
    bucket = group('digging-bucket', stick);
    bucket.position.y = 1.4;
    box(bucket, 0, 0.25, 0, 0.65, 0.5, 0.12, steel);
    box(bucket, 0, 0.5, 0.23, 0.65, 0.12, 0.55, steel);
    for (const side of [-1, 1]) box(bucket, side * 0.29, 0.25, 0.2, 0.07, 0.5, 0.5, steel);
    for (let i = 0; i < 4; i++) box(bucket, -0.24 + i * 0.16, 0.5, 0.55, 0.075, 0.09, 0.2, alloy);
    legs = group('stabilisers');
    for (const side of [-1, 1]) {
      box(legs, side * w * 0.38, 0.75, -l * 0.23, 0.12, 1.1, 0.12, steel);
      box(legs, side * w * 0.38, 0.18, -l * 0.23, 0.45, 0.1, 0.4, alloy);
    }
  }
  for (const g of groups) batch(g);
  root.userData.earthmovingAnimate = (down: boolean, speed: number, travel: number, dt: number) => {
    lower += (Number(down) - lower) * (1 - Math.exp(-dt * 6));
    implement.position.y = (dozer ? 0.5 : 0.65) * (1 - lower);
    root.userData.moveTracks?.(travel);
    if (down && Math.abs(speed) > 0.05) workPhase += Math.abs(travel) * 1.5;
    if (boom && stick && bucket && legs) {
      const cycle = Math.sin(workPhase);
      boom.rotation.x = -0.48 - lower * (0.2 + cycle * 0.12);
      stick.rotation.x = -2.15 + lower * (0.4 - cycle * 0.25);
      bucket.rotation.x = -0.6 + lower * (0.4 + Math.cos(workPhase) * 0.3);
      legs.position.y = down && Math.abs(speed) < 0.05 ? 0 : 0.55;
    }
  };
  root.userData.earthmovingAnimate(false, 0, 0, 1);
  return root;
}
