// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { createFishingLights, type MarineLightLayout } from './fishing-lights';
/** A 4.3 m open fishing skiff: double skin, aft outboard and rowing thwarts. */
export function createMotorboat(color = '#608a9c') {
  const group = new T.Group(),
    fixed = new T.Group();
  group.add(fixed);
  const mat = (c: string, metalness = 0) =>
    new T.MeshStandardMaterial({ color: c, metalness, roughness: 0.6 });
  const paint = mat(color),
    ivory = mat('#e3e0d0'),
    rubber = mat('#283133'),
    steel = mat('#a3adb0', 0.65),
    wood = mat('#987c54'),
    black = mat('#202a31');
  const add = (geo: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = fixed) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
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
  const rod = (a: number[], b: number[], r = 0.025, m = steel, parent = fixed) => {
    const A = new T.Vector3(...a),
      B = new T.Vector3(...b),
      v = B.clone().sub(A),
      o = add(new T.CylinderGeometry(r, r, v.length(), 8), m, 0, 0, 0, parent);
    o.position.copy(A.add(B).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    return o;
  };
  const sections = [
    [-2, 0.7],
    [-1.6, 0.83],
    [-0.7, 0.9],
    [0.5, 0.88],
    [1.35, 0.65],
    [1.95, 0.22],
    [2.15, 0.02],
  ];
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [z, w] of sections)
    for (const [x, y] of [
      [-w, 0.65],
      [-w * 0.85, 0.05],
      [-w * 0.3, -0.28],
      [w * 0.3, -0.28],
      [w * 0.85, 0.05],
      [w, 0.65],
    ])
      vertices.push(x, y + Math.max(0, z - 1) * 0.12, z);
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 5; j++) {
      const a = i * 6 + j,
        b = a + 6;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const hull = new T.BufferGeometry();
  hull.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  hull.setAttribute(
    'uv',
    new T.Float32BufferAttribute(
      vertices.flatMap((_, i) => (i % 3 === 0 ? [vertices[i], vertices[i + 2]] : [])),
      2,
    ),
  );
  hull.setIndex(indices);
  hull.computeVertexNormals();
  paint.side = T.DoubleSide;
  add(hull, paint);
  box(1.4, 0.65, 0.12, ivory, 0, 0.3, -2);
  box(1.35, 0.1, 3.1, ivory, 0, 0.16, -0.35);
  for (const side of [-1, 1])
    for (let i = 0; i < sections.length - 1; i++) {
      const [z, w] = sections[i],
        [nz, nw] = sections[i + 1];
      rod(
        [side * w, 0.66 + Math.max(0, z - 1) * 0.12, z],
        [side * nw, 0.66 + Math.max(0, nz - 1) * 0.12, nz],
        0.055,
        rubber,
      );
      rod([side * (w - 0.08), 0.61, z], [side * (nw - 0.08), 0.61, nz], 0.08, ivory);
    }
  for (const z of [-1.25, 0.1]) {
    box(1.45, 0.1, 0.38, wood, 0, 0.65, z);
    for (const x of [-0.56, 0.56]) box(0.07, 0.45, 0.28, ivory, x, 0.4, z);
  }
  box(1, 0.12, 0.62, ivory, 0, 0.61, 1.18);
  box(0.56, 0.035, 0.38, paint, 0, 0.69, 1.18);
  rod([-0.12, 0.72, 1.2], [0.12, 0.72, 1.2]);
  for (const side of [-1, 1]) {
    for (const z of [0.65, 1.25]) rod([side * 0.66, 0.7, z], [side * 0.66, 1, z]);
    rod([side * 0.66, 1, 0.65], [side * 0.66, 1, 1.25]);
    for (const z of [-1.65, 0.7]) {
      rod([side * 0.68, 0.73, z - 0.08], [side * 0.68, 0.73, z + 0.08], 0.03);
      rod([side * 0.68, 0.66, z], [side * 0.68, 0.77, z], 0.025);
    }
    const f = add(new T.CapsuleGeometry(0.09, 0.28, 3, 7), ivory, side * 0.91, 0.36, -0.5);
    rod([side * 0.82, 0.65, -0.5], [side * 0.91, 0.5, -0.5], 0.012, wood);
  }
  // Portable tank, hose, transom clamps and outboard lower unit.
  box(0.5, 0.26, 0.34, mat('#b64834'), -0.4, 0.35, -1.64);
  box(0.11, 0.035, 0.07, black, -0.4, 0.5, -1.64);
  rod([-0.4, 0.45, -1.6], [0, 0.5, -2.14], 0.018, rubber);
  for (const x of [-0.15, 0.15]) rod([x, 0.7, -1.9], [x, 0.6, -2.2], 0.04);
  const motor = new T.Group();
  motor.position.set(0, 0, -2.16);
  group.add(motor);
  const cowling = add(new T.CapsuleGeometry(0.22, 0.25, 5, 12), black, 0, 0.76, 0, motor);
  cowling.scale.z = 1.3;
  box(0.44, 0.07, 0.28, steel, 0, 0.8, 0.02, motor);
  box(0.13, 0.7, 0.17, black, 0, 0.12, 0.08, motor);
  box(0.36, 0.035, 0.3, steel, 0, -0.23, 0.08, motor);
  const prop = new T.Group();
  prop.position.set(0, -0.35, -0.05);
  motor.add(prop);
  add(new T.ConeGeometry(0.08, 0.17, 8).rotateX(-Math.PI / 2), steel, 0, 0, 0, prop);
  for (let i = 0; i < 3; i++) {
    const blade = box(0.07, 0.36, 0.035, steel, 0, 0, 0, prop);
    blade.rotation.z = (i * Math.PI * 2) / 3;
  }
  rod([0, 0.75, 0], [0.4, 0.7, 0.7], 0.035, black, motor);
  rod([0.4, 0.7, 0.7], [0.4, 0.7, 0.93], 0.04, rubber, motor);
  // Oars are always carried, and work only when the tank is empty.
  const oars: T.Group[] = [];
  for (const side of [-1, 1]) {
    const oar = new T.Group();
    oar.position.set(side * 0.85, 0.7, 0.1);
    group.add(oar);
    rod([0, 0, 0], [side * 1.15, -0.12, 0], 0.027, wood, oar);
    box(0.3, 0.035, 0.5, wood, side * 1.18, -0.12, 0, oar);
    oars.push(oar);
  }
  for (let i = 0; i < oars.length; i++) oars[i].rotation.y = (i ? 1 : -1) * 1.35;
  const driver = createHuman('seated').group;
  driver.position.set(0.3, 0.69, -1.22);
  group.add(driver);
  group.userData.driver = driver;
  group.userData.eye = new T.Vector3(0.3, 1.57, -1.22);
  group.userData.viewPitch = -0.12;
  group.userData.lamp = new T.Vector3(0, 0.85, 1.7);
  const layout: MarineLightLayout = {
    deck: [],
    targets: [],
    cabin: new T.Vector3(),
    cabinTarget: new T.Vector3(),
    deckPower: 0,
    cabinPower: 0,
    specs: [
      ['port', '#ff3020', 0.3, 0.85, 1.65],
      ['starboard', '#1cff68', -0.3, 0.85, 1.65],
      ['trawlWhite', '#fff4d2', -0.57, 1.8, -1.8],
      ['stern', '#fff4d2', -0.57, 1.8, -1.8],
      ['masthead', '#fff4d2', -0.57, 1.8, -1.8],
    ],
  };
  rod([-0.57, 0.5, -1.8], [-0.57, 1.8, -1.8], 0.018);
  const lighting = createFishingLights(ivory, ivory, layout);
  group.add(lighting.group);
  group.userData.marineLighting = lighting;
  batch(fixed);
  let phase = 0;
  return {
    group,
    lighting,
    animate(dt: number, speed: number, rowing: boolean, turn = 0) {
      phase += dt * (rowing ? 2.5 : 8);
      motor.rotation.y = T.MathUtils.clamp(turn, -0.5, 0.5);
      prop.rotation.z += dt * speed * 6;
      for (let i = 0; i < 2; i++) {
        oars[i].rotation.y = rowing ? Math.sin(phase) * 0.45 : (i ? 1 : -1) * 1.35;
        oars[i].rotation.z = rowing ? Math.cos(phase) * 0.1 : 0;
      }
    },
  };
}
