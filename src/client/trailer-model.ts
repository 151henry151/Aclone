// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { trailerDefs, type TrailerKind } from '../shared/trailers';
import { detailTexture } from './detail-textures';
import { batch } from './tractor';
import { animalModel } from './animal-model';
import type { Stock } from '../shared/types';
export function createTrailer(kind: TrailerKind, cargo: Stock = {}) {
  const def = trailerDefs[kind],
    group = new T.Group(),
    fixed = new T.Group(),
    load = new T.Group(),
    w = def.width,
    l = def.length;
  group.name = def.name;
  group.add(fixed, load);
  const mat = (color: string, metalness = 0) =>
    new T.MeshStandardMaterial({ color, metalness, roughness: 0.7, map: detailTexture('paint') });
  const paint = mat(def.color, 0.25),
    steel = mat('#343e40', 0.5),
    alloy = mat('#adb6b6', 0.6),
    rubber = mat('#25282a'),
    wood = mat('#ad8352'),
    darkwood = mat('#775a38'),
    red = new T.MeshStandardMaterial({
      color: '#a62c21',
      emissive: '#a62c21',
      emissiveIntensity: 0.15,
    });
  const add = (geo: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = fixed) => {
    const mesh = new T.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    m: T.Material,
    px: number,
    py: number,
    pz: number,
    parent = fixed,
  ) => add(new T.BoxGeometry(x, y, z), m, px, py, pz, parent);
  const rod = (a: number[], b: number[], r = 0.04, m: T.Material = steel, parent = fixed) => {
    const A = new T.Vector3(...a),
      B = new T.Vector3(...b),
      v = B.clone().sub(A);
    const mesh = add(new T.CylinderGeometry(r, r, v.length(), 8), m, 0, 0, 0, parent);
    mesh.position.copy(A.add(B).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    return mesh;
  };
  wood.map = detailTexture('siding');
  darkwood.map = detailTexture('siding');
  rubber.map = detailTexture('tyre');
  const hayMaterial = new T.MeshStandardMaterial({ map: detailTexture('hay'), roughness: 1 });
  // Twin chassis rails, crossmembers, tandem axles and leaf springs.
  for (const x of [-w * 0.32, w * 0.32]) box(0.14, 0.22, l, steel, x, 0.75, 0);
  for (let z = -l / 2 + 0.25; z < l / 2; z += 0.7) box(w - 0.15, 0.1, 0.08, steel, 0, 0.73, z);
  const wheels: T.Group[] = [];
  for (const z of [-1.25, -0.12]) {
    rod([-w / 2, 0.51, z], [w / 2, 0.51, z], 0.09);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++)
        box(0.12, 0.025, 1.2 - j * 0.2, steel, side * w * 0.32, 0.63 + j * 0.04, z);
      const wheel = new T.Group();
      wheel.position.set(side * (w / 2 - 0.12), 0.51, z);
      fixed.add(wheel);
      wheels.push(wheel);
      add(new T.CylinderGeometry(0.5, 0.5, 0.29, 20).rotateZ(Math.PI / 2), rubber, 0, 0, 0, wheel);
      add(new T.CylinderGeometry(0.27, 0.27, 0.31, 16).rotateZ(Math.PI / 2), alloy, 0, 0, 0, wheel);
      add(new T.CylinderGeometry(0.11, 0.11, 0.35, 12).rotateZ(Math.PI / 2), steel, 0, 0, 0, wheel);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const tread = box(
          0.32,
          0.045,
          0.16,
          rubber,
          0,
          Math.sin(a) * 0.49,
          Math.cos(a) * 0.49,
          wheel,
        );
        tread.rotation.x = -a;
      }
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3)
        add(
          new T.SphereGeometry(0.027, 5, 4),
          steel,
          side * 0.17,
          Math.sin(a) * 0.18,
          Math.cos(a) * 0.18,
          wheel,
        );
    }
  }
  for (const side of [-1, 1]) {
    box(0.46, 0.08, 2.35, paint, side * (w / 2 - 0.12), 1.08, -0.68);
    box(0.38, 0.35, 0.06, rubber, side * (w / 2 - 0.12), 0.72, -1.87);
  }
  // A-frame drawbar, eye, jack, hydraulic/brake lines and parking lever.
  const nose = l / 2 + 1.4;
  rod([-w * 0.32, 0.73, l / 2], [0, 0.62, nose], 0.095);
  rod([w * 0.32, 0.73, l / 2], [0, 0.62, nose], 0.095);
  const eye = add(new T.TorusGeometry(0.12, 0.035, 7, 16), alloy, 0, 0.62, nose);
  eye.rotation.x = Math.PI / 2;
  rod([0.24, 0.35, l / 2 + 0.4], [0.24, 0.9, l / 2 + 0.4], 0.055, alloy);
  box(0.28, 0.06, 0.24, steel, 0.24, 0.33, l / 2 + 0.4);
  rod([0.24, 0.95, l / 2 + 0.4], [0.45, 0.95, l / 2 + 0.4], 0.025);
  rod([-0.2, 0.9, l / 2], [-0.1, 0.68, nose - 0.1], 0.025, red);
  rod([0.15, 0.9, l / 2], [0.1, 0.68, nose - 0.1], 0.02, rubber);
  rod([-0.35, 0.8, l / 2 + 0.3], [-0.35, 1.15, l / 2 + 0.6], 0.025, alloy);
  const rear = -l / 2 - 0.08;
  for (const x of [-w * 0.38, w * 0.38]) {
    box(0.32, 0.15, 0.08, red, x, 0.79, rear);
    box(0.3, 0.06, 0.08, alloy, x, 0.65, rear);
  }
  box(0.55, 0.18, 0.03, mat('#e9d6a1'), 0, 0.72, rear - 0.04);
  const triangle = add(new T.CircleGeometry(0.19, 3), red, 0, 0.99, rear - 0.06);
  triangle.rotation.y = Math.PI;
  if (kind === 'logs') {
    for (const z of [-l * 0.38, 0, l * 0.38]) {
      box(w, 0.16, 0.2, paint, 0, 1.08, z);
      for (const side of [-1, 1])
        rod([side * w * 0.47, 1.08, z], [side * w * 0.43, 2.8, z], 0.065, paint);
    }
    for (let x = -w * 0.4; x <= w * 0.4; x += 0.3)
      rod([x, 1, l / 2], [x, 2.7, l / 2], 0.025, steel);
    for (const z of [-l * 0.3, l * 0.3]) {
      rod([-w * 0.45, 2.55, z], [w * 0.45, 2.55, z], 0.025, mat('#b59554'));
    }
  } else if (kind === 'tanker') {
    for (const z of [-1.1, 1.1]) box(w * 0.7, 0.25, 0.35, steel, 0, 1.1, z);
    const tank = add(
      new T.CylinderGeometry(0.96, 0.96, l - 0.6, 32).rotateX(Math.PI / 2),
      alloy,
      0,
      2,
      0,
    );
    for (const z of [-(l - 0.6) / 2, (l - 0.6) / 2])
      add(new T.SphereGeometry(0.96, 24, 12).scale(1, 1, 0.25), alloy, 0, 2, z);
    for (const z of [-l * 0.3, l * 0.3])
      add(new T.TorusGeometry(0.97, 0.035, 6, 32), steel, 0, 2, z);
    add(new T.CylinderGeometry(0.32, 0.32, 0.14, 16), steel, 0, 3.01, 0.1);
    add(new T.CylinderGeometry(0.27, 0.27, 0.08, 16), alloy, 0, 3.12, 0.1);
    rod([0, 1.5, -l / 2], [0.5, 1.5, -l / 2], 0.09, alloy);
    add(new T.TorusGeometry(0.16, 0.022, 6, 16), red, 0.5, 1.7, -l / 2);
    for (const x of [-0.24, 0.24]) rod([x, 1.1, rear], [x, 3, rear], 0.025, alloy);
    for (let y = 1.15; y < 3; y += 0.26) rod([-0.24, y, rear], [0.24, y, rear], 0.022, alloy);
  } else {
    box(w - 0.2, 0.12, l, kind === 'hay' ? wood : steel, 0, 1.1, 0);
    if (kind === 'hay') {
      for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.22)
        box(0.2, 0.035, l, darkwood, x, 1.18, 0);
      for (const z of [-l / 2, l / 2]) {
        for (const x of [-w * 0.46, w * 0.46]) rod([x, 1.12, z], [x, 2.9, z], 0.05, paint);
        for (const y of [1.5, 2.1, 2.7]) box(w, 0.08, 0.07, paint, 0, y, z);
      }
      for (let z = -l / 2 + 0.4; z < l / 2; z += 0.8)
        for (const side of [-1, 1])
          add(new T.TorusGeometry(0.055, 0.015, 5, 8), alloy, side * w * 0.49, 1.13, z).rotation.y =
            Math.PI / 2;
    } else if (kind === 'dump') {
      for (const side of [-1, 1]) {
        box(0.09, 1.1, l, paint, side * w * 0.46, 1.72, 0);
        for (let z = -l / 2 + 0.3; z < l / 2; z += 0.6)
          box(0.14, 1.13, 0.08, steel, side * w * 0.47, 1.7, z);
      }
      for (const z of [-l / 2, l / 2]) box(w - 0.1, 1.1, 0.09, paint, 0, 1.72, z);
      for (const x of [-w * 0.3, w * 0.3]) {
        box(0.2, 0.18, 0.16, steel, x, 2.3, -l / 2);
        rod([x, 0.7, 0.7], [x, 1.1, 1.5], 0.065, alloy);
      }
    } else if (kind === 'livestock') {
      for (const side of [-1, 1]) {
        box(0.06, 0.8, l, alloy, side * w * 0.46, 1.57, 0);
        for (let y = 2.05; y < 3; y += 0.26) box(0.07, 0.14, l, paint, side * w * 0.46, y, 0);
        for (let z = -l / 2; z <= l / 2; z += 0.9)
          box(0.09, 1.9, 0.07, steel, side * w * 0.47, 2.05, z);
      }
      const roof = new T.CylinderGeometry(w * 0.49, w * 0.49, l, 20, 1, true, Math.PI / 2, Math.PI);
      roof.rotateX(Math.PI / 2);
      roof.scale(1, 0.35, 1);
      add(roof, alloy, 0, 2.82, 0);
      for (const z of [-l / 2, l / 2]) box(w - 0.2, 1.7, 0.08, paint, 0, 2, z);
      for (let y = 1.3; y < 2.8; y += 0.3) box(w - 0.2, 0.05, 0.04, alloy, 0, y, rear - 0.02);
      for (const x of [-w * 0.4, w * 0.4]) rod([x, 1.1, rear], [x, 2.8, rear], 0.03, alloy);
    } else {
      for (const side of [-1, 1]) {
        box(0.06, 2.15, l, paint, side * w * 0.46, 2.2, 0);
        for (let z = -l / 2 + 0.1; z < l / 2; z += 0.32)
          box(0.025, 2.1, 0.018, alloy, side * w * 0.475, 2.2, z);
      }
      box(w - 0.1, 0.1, l, alloy, 0, 3.3, 0);
      for (const z of [-l / 2, l / 2]) box(w - 0.1, 2.15, 0.07, paint, 0, 2.2, z);
      for (const x of [-w * 0.22, w * 0.22]) {
        rod([x, 1.24, rear], [x, 3.17, rear], 0.026, alloy);
        box(0.24, 0.07, 0.08, steel, x, 2.05, rear - 0.05);
      }
      if (kind === 'fish') {
        for (const side of [-1, 1]) {
          box(0.025, 0.25, l - 0.15, mat('#307d9a'), side * w * 0.48, 1.65, 0);
          box(0.025, 0.06, l - 0.15, mat('#307d9a'), side * w * 0.48, 2, 0);
        }
        box(1.35, 0.75, 0.4, alloy, 0, 2.8, l / 2 + 0.2);
        for (const x of [-0.35, 0.35]) {
          add(new T.CircleGeometry(0.25, 16), steel, x, 2.8, l / 2 + 0.41);
          for (let a = 0; a < 3; a++) {
            const blade = box(0.06, 0.35, 0.03, alloy, x, 2.8, l / 2 + 0.44);
            blade.rotation.z = (a * Math.PI * 2) / 3;
          }
        }
        box(0.18, 0.12, 0.35, steel, w * 0.35, 1.05, -l / 2 + 0.1);
      }
    }
  }
  // Cargo is bounded visually; quantity remains authoritative in the cargo panel.
  if (kind === 'hay' && (cargo.hay ?? 0) > 0) {
    const n = Math.min(18, Math.ceil(cargo.hay / 17));
    for (let i = 0; i < n; i++) {
      const x = ((i % 2) - 0.5) * 1.05,
        z = -l * 0.34 + (Math.floor(i / 2) % 3) * l * 0.32,
        y = 1.56 + Math.floor(i / 6) * 0.73;
      box(0.94, 0.7, l * 0.29, hayMaterial, x, y, z, load);
      for (const offset of [-0.25, 0.25])
        box(0.02, 0.72, l * 0.3, mat('#696e48'), x + offset, y, z, load);
    }
  }
  if (kind === 'logs') {
    const n = Math.min(18, Math.ceil(((cargo.logs ?? 0) + (cargo.wood ?? 0)) / 20));
    for (let i = 0; i < n; i++) {
      const o = add(
        new T.CylinderGeometry(0.2, 0.24, l * 0.88, 10).rotateX(Math.PI / 2),
        darkwood,
        ((i % 4) - 1.5) * 0.45,
        1.45 + Math.floor(i / 4) * 0.38,
        0,
        load,
      );
      for (const z of [-l * 0.44 - 0.004, l * 0.44 + 0.004])
        add(new T.CircleGeometry(0.19, 12), wood, o.position.x, o.position.y, z, load).rotation.y =
          z < 0 ? Math.PI : 0;
    }
  }
  if (kind === 'dump' && Object.values(cargo).some((n) => n > 0)) {
    const fullness = Math.min(1, Object.values(cargo).reduce((a, b) => a + b, 0) / 500);
    add(
      new T.SphereGeometry(1, 14, 7).scale(w * 0.44, 0.3 + fullness * 0.5, l * 0.45),
      mat('#938d7b'),
      0,
      1.27 + fullness * 0.25,
      0,
      load,
    );
  }
  if (kind === 'livestock') {
    let at = 0;
    for (const animal of ['cows', 'sheep', 'pigs', 'chickens'] as const)
      for (
        let i = 0;
        i < Math.min(cargo[animal] ?? 0, animal === 'cows' ? 6 : 8) && at < 8;
        i++, at++
      ) {
        const a = new T.Group();
        for (const part of animalModel(animal)) {
          const m = new T.Mesh(
            part.geometry,
            new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
          );
          m.position.copy(part.pivot);
          a.add(m);
        }
        a.position.set(((at % 2) - 0.5) * 1.05, 1.17, -l * 0.33 + Math.floor(at / 2) * l * 0.32);
        load.add(a);
      }
  }
  group.userData.tailLights = red;
  group.userData.wheels = wheels;
  // Keep wheel groups separate for animation; merge the static chassis/body only.
  for (const wheel of wheels) fixed.remove(wheel);
  batch(fixed);
  for (const wheel of wheels) group.add(wheel);
  batch(load);
  return group;
}
