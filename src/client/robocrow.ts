// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface RobocrowFigure {
  group: T.Group;
  animate(dt: number): void;
}

/** Original mechanical scout. +Z is forward; metres match the other vehicles.
 * Batch every fixed part by material, leaving only two small fan assemblies animated. */
export function createRobocrow(): RobocrowFigure {
  const group = new T.Group();
  group.name = 'Industrial robocrow';
  const palette = {
    armour: new T.MeshStandardMaterial({ color: '#38434a', roughness: 0.49, metalness: 0.55 }),
    edge: new T.MeshStandardMaterial({ color: '#7e8c90', roughness: 0.36, metalness: 0.72 }),
    dark: new T.MeshStandardMaterial({ color: '#191f24', roughness: 0.7, metalness: 0.25 }),
    panel: new T.MeshStandardMaterial({ color: '#53636c', roughness: 0.57, metalness: 0.45 }),
    brass: new T.MeshStandardMaterial({ color: '#9a8056', roughness: 0.48, metalness: 0.6 }),
    marking: new T.MeshStandardMaterial({ color: '#c18747', roughness: 0.72, metalness: 0.1 }),
    lens: new T.MeshStandardMaterial({
      color: '#539cab',
      emissive: '#1c626e',
      roughness: 0.19,
      metalness: 0.4,
    }),
  };
  type Finish = keyof typeof palette;
  let parent = group;
  const add = (geo: T.BufferGeometry, finish: Finish, x: number, y: number, z: number) => {
    const m = new T.Mesh(geo, palette[finish]);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    finish: Finish,
    x: number,
    y: number,
    z: number,
    round = 0,
  ) =>
    add(
      round ? new RoundedBoxGeometry(w, h, d, 1, round) : new T.BoxGeometry(w, h, d),
      finish,
      x,
      y,
      z,
    );
  const cylinder = (
    r: number,
    h: number,
    finish: Finish,
    x: number,
    y: number,
    z: number,
    segments = 16,
  ) => add(new T.CylinderGeometry(r, r, h, segments), finish, x, y, z);
  const rod = (a: number[], b: number[], radius: number, finish: Finish) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b);
    const m = cylinder(radius, start.distanceTo(end), finish, 0, 0, 0, 8);
    m.position.copy(start).add(end).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize());
  };
  const plate = (points: number[][], thickness: number, finish: Finish, y: number) => {
    const shape = new T.Shape(points.map(([x, z]) => new T.Vector2(x, z)));
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 0.014,
      bevelThickness: 0.009,
      bevelSegments: 1,
      steps: 1,
    });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateX(Math.PI / 2);
    return add(geo, finish, 0, y, 0);
  };

  // Layered central shell, exposed keel, removable battery cassette and cooling slots.
  box(0.58, 0.46, 1.28, 'dark', 0, 0.05, -0.12, 0.13);
  box(0.66, 0.3, 1.12, 'armour', 0, 0.24, -0.15, 0.12);
  box(0.39, 0.08, 0.8, 'panel', 0, 0.425, -0.23, 0.03);
  box(0.39, 0.18, 0.64, 'edge', 0, -0.24, -0.15, 0.04);
  for (const x of [-0.25, 0.25]) {
    rod([x, -0.14, -0.68], [x, -0.14, 0.55], 0.028, 'brass');
    for (const z of [-0.48, -0.06, 0.34]) cylinder(0.028, 0.03, 'edge', x, 0.41, z, 6);
  }
  for (let i = 0; i < 7; i++) {
    box(0.24, 0.018, 0.035, 'dark', 0, 0.472, -0.52 + i * 0.09);
    box(0.025, 0.15, 0.04, 'dark', 0.333, 0.21, -0.48 + i * 0.09);
  }
  box(0.24, 0.035, 0.11, 'marking', 0, 0.474, 0.29);
  // Neck gimbal and faceted optical head. A beak-shaped sensor hood shades the front lens.
  cylinder(0.17, 0.23, 'brass', 0, 0.25, 0.64);
  box(0.47, 0.34, 0.47, 'armour', 0, 0.43, 0.8, 0.085);
  plate(
    [
      [-0.23, 0.88],
      [0, 1.53],
      [0.23, 0.88],
    ],
    0.12,
    'edge',
    0.38,
  );
  plate(
    [
      [-0.19, 0.98],
      [0, 1.46],
      [0.19, 0.98],
    ],
    0.035,
    'armour',
    0.458,
  );
  box(0.16, 0.065, 0.025, 'lens', 0, 0.35, 1.29);
  for (const side of [-1, 1]) {
    const socket = cylinder(0.115, 0.065, 'dark', side * 0.237, 0.48, 0.87);
    socket.rotation.z = Math.PI / 2;
    const eye = cylinder(0.072, 0.07, 'lens', side * 0.26, 0.48, 0.87, 24);
    eye.rotation.z = Math.PI / 2;
    box(0.1, 0.05, 0.24, 'panel', side * 0.245, 0.595, 0.83, 0.012);
  }

  const fans: T.Group[] = [];
  for (const side of [-1, 1]) {
    // Offset spars leave the lift ducts open; outer feathers sweep back like a crow's.
    rod([side * 0.2, 0.09, 0.09], [side * 1.9, 0.07, -0.2], 0.06, 'edge');
    rod([side * 0.3, -0.12, -0.49], [side * 1.7, -0.04, -0.68], 0.045, 'brass');
    plate(
      [
        [side * 0.35, -0.2],
        [side * 1.25, -0.12],
        [side * 2.35, -0.67],
        [side * 2.1, -1.05],
        [side * 0.4, -0.77],
      ],
      0.085,
      'armour',
      0.08,
    );
    // Individually tapered, overlapping metal feather plates with silver leading edges.
    for (let i = 0; i < 7; i++) {
      const x = 0.73 + i * 0.24;
      const z = -0.22 - i * 0.095;
      const tip = z - 0.65 - i * 0.045;
      plate(
        [
          [side * x, z],
          [side * (x + 0.24), z - 0.075],
          [side * (x + 0.42), tip - 0.08],
          [side * (x + 0.26), tip - 0.19],
          [side * (x + 0.05), tip],
        ],
        0.045,
        i % 3 === 0 ? 'panel' : 'armour',
        0.135 + i * 0.006,
      );
      rod(
        [side * (x + 0.015), 0.17 + i * 0.006, z - 0.02],
        [side * (x + 0.08), 0.17 + i * 0.006, tip + 0.07],
        0.014,
        'edge',
      );
      cylinder(0.026, 0.023, 'edge', side * (x + 0.11), 0.19 + i * 0.006, z - 0.14, 6);
    }
    // Shoulder drive and piston attachment, legible from above and below.
    const joint = cylinder(0.14, 0.18, 'dark', side * 0.51, 0.14, -0.27);
    joint.rotation.z = Math.PI / 2;
    rod([side * 0.31, -0.14, -0.5], [side * 1.04, 0.02, -0.64], 0.064, 'dark');
    rod([side * 0.64, -0.08, -0.56], [side * 1.33, 0.025, -0.7], 0.025, 'edge');
    // Armoured duct lip, intake stators and separately batched counter-rotating impeller.
    const fx = side * 0.89,
      fz = 0.31;
    const duct = add(new T.TorusGeometry(0.405, 0.065, 8, 32), 'armour', fx, 0.16, fz);
    duct.rotation.x = Math.PI / 2;
    const lip = add(new T.TorusGeometry(0.405, 0.017, 4, 32), 'edge', fx, 0.218, fz);
    lip.rotation.x = Math.PI / 2;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      rod([fx, 0.2, fz], [fx + Math.sin(a) * 0.39, 0.2, fz + Math.cos(a) * 0.39], 0.015, 'edge');
    }
    cylinder(0.09, 0.18, 'brass', fx, 0.16, fz);
    const fan = new T.Group();
    fan.name = side < 0 ? 'Port lift fan' : 'Starboard lift fan';
    fan.position.set(fx, 0.105, fz);
    group.add(fan);
    fans.push(fan);
    parent = fan;
    for (let i = 0; i < 6; i++) {
      const blade = box(0.115, 0.035, 0.27, 'dark', 0, 0, 0);
      const a = (i * Math.PI) / 3;
      blade.position.set(Math.sin(a) * 0.23, 0, Math.cos(a) * 0.23);
      blade.rotation.set(0, a + 0.25, 0.15);
    }
    batch(fan);
    parent = group;
    // Retracted gripping feet beneath the keel, with opposed hooked fingers.
    rod([side * 0.2, -0.24, -0.22], [side * 0.29, -0.48, -0.42], 0.04, 'edge');
    for (const offset of [-0.075, 0.075]) {
      rod([side * 0.29, -0.48, -0.42], [side * 0.29 + offset, -0.54, -0.1], 0.027, 'dark');
      rod([side * 0.29 + offset, -0.54, -0.1], [side * 0.29 + offset, -0.61, -0.16], 0.022, 'edge');
    }
  }
  // Split tail vanes, one amber service panel and a whip antenna on the other side.
  for (let i = -2; i <= 2; i++) {
    const x = i * 0.14;
    plate(
      [
        [x - 0.09, -0.64],
        [x + 0.09, -0.64],
        [x * 1.9 + 0.11, -1.58],
        [x * 1.9 - 0.11, -1.73],
      ],
      0.05,
      i % 2 ? 'panel' : 'armour',
      0.06,
    );
    rod([x, 0.097, -0.72], [x * 1.9, 0.097, -1.48], 0.013, 'edge');
  }
  box(0.19, 0.06, 0.31, 'marking', -0.47, 0.21, -0.49, 0.015);
  for (const z of [-0.58, -0.4]) cylinder(0.025, 0.025, 'dark', -0.47, 0.25, z, 6);
  rod([0.23, 0.39, -0.56], [0.29, 0.87, -0.85], 0.014, 'edge');
  cylinder(0.027, 0.07, 'dark', 0.29, 0.87, -0.85, 8);
  batch(group);
  let phase = 0;
  return {
    group,
    animate(dt) {
      phase = (phase + Math.max(0, Math.min(dt, 0.1)) * 29) % (Math.PI * 2);
      fans[0].rotation.y = phase;
      fans[1].rotation.y = -phase;
    },
  };
}

/** Fixed detail becomes seven body draws and one draw per moving fan. */
function batch(group: T.Group) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  for (const o of [...group.children]) {
    if (!(o instanceof T.Mesh)) continue;
    o.updateMatrix();
    const geometry = (
      o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    ).applyMatrix4(o.matrix);
    const material = o.material as T.Material;
    const parts = batches.get(material) ?? [];
    parts.push(geometry);
    batches.set(material, parts);
    o.geometry.dispose();
    group.remove(o);
  }
  for (const [material, parts] of batches) {
    const mesh = new T.Mesh(mergeGeometries(parts)!, material);
    for (const part of parts) part.dispose();
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
}
