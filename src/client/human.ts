// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export interface HumanFigure {
  group: T.Group;
  animate(distance: number, dt: number): void;
}
const templates = new Map<'walking' | 'seated', T.Group>();
let weave: T.DataTexture | undefined;
function clothWeave() {
  if (weave) return weave;
  const data = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const v = 155 + ((x + y) % 4 < 2 ? 45 : 0) + (x % 2 ? 12 : 0);
      data.set([v, v, v, 255], (y * 32 + x) * 4);
    }
  weave = new T.DataTexture(data, 32, 32);
  weave.wrapS = weave.wrapT = T.RepeatWrapping;
  weave.repeat.set(5, 5);
  weave.magFilter = T.LinearFilter;
  weave.minFilter = T.LinearFilter;
  weave.userData.shared = true;
  weave.needsUpdate = true;
  return weave;
}

/** Original articulated country workwear figure. +Z is forward; walking feet sit at Y=0. */
export function createHuman(pose: 'walking' | 'seated' = 'walking'): HumanFigure {
  const template = templates.get(pose);
  if (template) return figure(template.clone(true), pose);
  const group = new T.Group();
  const fabric = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    bumpMap: clothWeave(),
    bumpScale: 0.0014,
  });
  const skin = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.63 });
  const leather = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.68 });
  const colors = {
    skin: '#c49476',
    warm: '#b88970',
    jacket: '#85957a',
    seam: '#62725b',
    shirt: '#d0c6aa',
    denim: '#647b8a',
    boot: '#795e46',
    sole: '#292d29',
    hair: '#4a3931',
  };
  function mesh(parent: T.Group, geometry: T.BufferGeometry, color: string, mat = fabric) {
    const c = new T.Color(color),
      count = geometry.attributes.position.count;
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) c.toArray(values, i * 3);
    geometry.setAttribute('color', new T.BufferAttribute(values, 3));
    const part = new T.Mesh(geometry, mat);
    part.castShadow = part.receiveShadow = true;
    parent.add(part);
    return part;
  }
  function oval(
    parent: T.Group,
    color: string,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    mat = fabric,
    segments = 16,
  ) {
    const part = mesh(parent, new T.SphereGeometry(1, segments, 8), color, mat);
    part.position.set(x, y, z);
    part.scale.set(rx, ry, rz);
    return part;
  }
  function profile(
    parent: T.Group,
    color: string,
    points: [number, number][],
    depth = 1,
    mat = fabric,
  ) {
    const curve = new T.SplineCurve(points.map(([r, y]) => new T.Vector2(r, y)));
    const part = mesh(parent, new T.LatheGeometry(curve.getPoints(18), 18), color, mat);
    part.scale.z = depth;
    return part;
  }
  function joint(parent: T.Group, x: number, y: number, z: number) {
    const part = new T.Group();
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  }
  function limb(parent: T.Group, length: number, top: number, bottom: number, color: string) {
    profile(
      parent,
      color,
      [
        [0, -length],
        [bottom, -length + 0.018],
        [bottom * 1.08, -length * 0.62],
        [top, -length * 0.22],
        [top * 0.85, -0.01],
        [0, 0.02],
      ],
      0.9,
    );
  }
  const hips = joint(group, 0, pose === 'walking' ? 0.94 : 0, 0);
  hips.name = 'hips';
  const torso = joint(hips, 0, 0, 0);
  torso.name = 'torso';
  oval(torso, colors.denim, 0, 0.015, 0, 0.18, 0.12, 0.11);
  profile(
    torso,
    colors.jacket,
    [
      [0, 0.07],
      [0.17, 0.065],
      [0.18, 0.12],
      [0.178, 0.25],
      [0.218, 0.41],
      [0.208, 0.46],
      [0.1, 0.505],
      [0, 0.5],
    ],
    0.63,
  );
  // Collar, breast pockets, covered placket and stitching break up the cloth silhouette.
  for (const side of [-1, 1]) {
    const collar = new T.BufferGeometry();
    collar.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [side * 0.026, 0.515, 0.073, side * 0.13, 0.47, 0.112, side * 0.071, 0.423, 0.142],
        3,
      ),
    );
    collar.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    collar.setIndex(side > 0 ? [0, 2, 1] : [0, 1, 2]);
    collar.computeVertexNormals();
    mesh(torso, collar, colors.shirt);
    const pocket = mesh(
      torso,
      new RoundedBoxGeometry(0.113, 0.125, 0.017, 2, 0.008),
      colors.jacket,
    );
    pocket.position.set(side * 0.1, 0.331, 0.123);
    const flap = mesh(torso, new RoundedBoxGeometry(0.121, 0.031, 0.02, 2, 0.007), colors.seam);
    flap.position.set(side * 0.1, 0.382, 0.134);
  }
  oval(torso, colors.seam, 0, 0.285, 0.126, 0.012, 0.19, 0.008);
  for (const y of [0.16, 0.25, 0.34, 0.43])
    oval(torso, '#baa883', 0, y, 0.139, 0.008, 0.008, 0.005, leather, 8);
  oval(torso, colors.skin, 0, 0.533, 0, 0.057, 0.084, 0.054, skin);
  const head = joint(torso, 0, 0.698, 0.004);
  head.scale.set(0.9, 0.88, 0.9);
  // Continuous smooth skull/jaw, rather than a low-resolution sphere or box head.
  profile(
    head,
    colors.skin,
    [
      [0, -0.135],
      [0.061, -0.126],
      [0.085, -0.086],
      [0.102, -0.025],
      [0.105, 0.04],
      [0.095, 0.105],
      [0.062, 0.138],
      [0, 0.15],
    ],
    0.91,
    skin,
  );
  for (const side of [-1, 1]) {
    oval(head, colors.skin, side * 0.108, 0.004, -0.004, 0.021, 0.036, 0.023, skin);
    oval(head, colors.warm, side * 0.119, 0.005, 0.009, 0.009, 0.021, 0.01, skin);
    oval(head, colors.warm, side * 0.041, 0.031, 0.084, 0.023, 0.01, 0.008, skin);
    oval(head, '#e0d6bc', side * 0.041, 0.032, 0.092, 0.016, 0.0055, 0.003, skin);
    oval(head, '#505b4c', side * 0.04, 0.032, 0.0955, 0.0055, 0.0055, 0.002, leather, 12);
    oval(head, '#292a25', side * 0.04, 0.032, 0.098, 0.0022, 0.003, 0.001, leather, 8);
    const brow = oval(head, colors.hair, side * 0.043, 0.055, 0.089, 0.024, 0.005, 0.008);
    brow.rotation.z = side * 0.13;
    oval(head, colors.skin, side * 0.052, -0.009, 0.074, 0.034, 0.027, 0.009, skin);
    oval(head, colors.hair, side * 0.094, 0.047, -0.017, 0.013, 0.04, 0.041);
  }
  oval(head, colors.skin, 0, 0.009, 0.094, 0.015, 0.035, 0.015, skin);
  oval(head, colors.skin, 0, -0.017, 0.108, 0.019, 0.014, 0.016, skin);
  oval(head, '#956251', 0, -0.057, 0.079, 0.034, 0.006, 0.011, skin);
  oval(head, '#bc866e', 0, -0.065, 0.08, 0.029, 0.006, 0.01, skin);
  const hair = mesh(
    head,
    new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.51),
    colors.hair,
  );
  hair.scale.set(0.108, 0.15, 0.1);
  hair.position.z = -0.011;
  oval(head, '#6b6651', 0, 0.127, 0, 0.119, 0.044, 0.126);
  oval(head, '#514f40', 0, 0.107, 0.091, 0.101, 0.01, 0.071);
  const arms: { upper: T.Group; lower: T.Group }[] = [];
  const legs: { upper: T.Group; lower: T.Group; foot: T.Group }[] = [];
  for (const side of [-1, 1]) {
    const upper = joint(torso, side * 0.221, 0.449, 0);
    upper.name = `arm-${side}`;
    limb(upper, 0.285, 0.072, 0.057, colors.jacket);
    const lower = joint(upper, 0, -0.285, 0);
    lower.name = `forearm-${side}`;
    limb(lower, 0.26, 0.06, 0.039, colors.jacket);
    oval(lower, colors.jacket, 0, -0.005, 0, 0.057, 0.061, 0.054);
    oval(lower, colors.seam, 0, -0.248, 0, 0.043, 0.016, 0.041);
    const hand = joint(lower, 0, -0.293, 0);
    oval(hand, colors.skin, 0, 0, 0, 0.036, 0.052, 0.023, skin);
    for (let finger = 0; finger < 4; finger++) {
      const length = [0.041, 0.051, 0.047, 0.035][finger];
      oval(
        hand,
        colors.skin,
        (finger - 1.5) * 0.016,
        -0.04 - length / 2,
        0.004,
        0.009,
        length / 2,
        0.011,
        skin,
        8,
      );
    }
    const thumb = oval(
      hand,
      colors.skin,
      -side * 0.036,
      -0.012,
      0.014,
      0.013,
      0.033,
      0.015,
      skin,
      8,
    );
    thumb.rotation.z = -side * 0.5;
    arms.push({ upper, lower });
    const thigh = joint(hips, side * 0.105, 0, 0);
    thigh.name = `thigh-${side}`;
    limb(thigh, 0.43, 0.1, 0.071, colors.denim);
    const shin = joint(thigh, 0, -0.43, 0);
    shin.name = `shin-${side}`;
    limb(shin, 0.42, 0.073, 0.05, colors.denim);
    oval(shin, colors.denim, 0, 0, 0, 0.071, 0.066, 0.065);
    const foot = joint(shin, 0, -0.42, 0);
    foot.name = `foot-${side}`;
    oval(foot, colors.boot, 0, 0.04, 0.035, 0.071, 0.082, 0.118, leather);
    oval(foot, colors.boot, 0, -0.014, 0.088, 0.076, 0.054, 0.145, leather);
    oval(foot, colors.sole, 0, -0.067, 0.087, 0.077, 0.02, 0.147, leather);
    for (let i = 0; i < 3; i++)
      oval(
        foot,
        '#aa9578',
        0,
        0.026 + i * 0.012,
        0.138 - i * 0.023,
        0.05,
        0.004,
        0.005,
        leather,
        8,
      );
    legs.push({ upper: thigh, lower: shin, foot });
  }
  if (pose === 'seated') {
    torso.rotation.x = 0.1;
    for (const arm of arms) {
      arm.upper.rotation.x = -1.05;
      arm.lower.rotation.x = -0.46;
    }
    for (const leg of legs) {
      leg.upper.rotation.x = -1.38;
      leg.lower.rotation.x = 1.43;
      leg.foot.rotation.x = -0.05;
    }
    bake(group, true);
  } else bake(group, false);
  group.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.userData.shared = true;
      (o.material as T.Material).userData.shared = true;
    }
  });
  templates.set(pose, group.clone(true));
  return figure(group, pose);
}

function figure(group: T.Group, pose: 'walking' | 'seated'): HumanFigure {
  if (pose === 'seated') return { group, animate() {} };
  const hips = group.getObjectByName('hips') as T.Group;
  const torso = group.getObjectByName('torso') as T.Group;
  const arms = [-1, 1].map((side) => ({
    upper: group.getObjectByName(`arm-${side}`) as T.Group,
    lower: group.getObjectByName(`forearm-${side}`) as T.Group,
  }));
  const legs = [-1, 1].map((side) => ({
    upper: group.getObjectByName(`thigh-${side}`) as T.Group,
    lower: group.getObjectByName(`shin-${side}`) as T.Group,
    foot: group.getObjectByName(`foot-${side}`) as T.Group,
  }));
  let phase = 0,
    weight = 0;
  return {
    group,
    animate(distance: number, dt: number) {
      if (dt <= 0) return;
      const speed = Math.abs(distance) / dt;
      weight += ((speed > 0.03 ? Math.min(1, speed / 0.7) : 0) - weight) * (1 - Math.exp(-dt * 12));
      phase += distance / 1.12;
      hips.position.y = 0.94 - 0.075 * weight + Math.cos(phase * Math.PI * 4) * 0.008 * weight;
      torso.rotation.y = Math.sin(phase * Math.PI * 2) * 0.035 * weight;
      for (let i = 0; i < legs.length; i++) {
        const cycle = (((phase + i * 0.5) % 1) + 1) % 1;
        const swing = Math.max(0, (cycle - 0.5) * 2);
        const z =
          (cycle < 0.5 ? 0.28 - 1.12 * cycle : -0.28 + 0.56 * (swing * swing * (3 - 2 * swing))) *
          weight;
        const y = 0.09 + Math.sin(swing * Math.PI) * 0.14 * weight - hips.position.y;
        const length = Math.min(0.84999, Math.hypot(y, z));
        const knee = Math.acos(
          T.MathUtils.clamp((length * length - 0.43 ** 2 - 0.42 ** 2) / (2 * 0.43 * 0.42), -1, 1),
        );
        const hip =
          Math.atan2(-z, -y) - Math.atan2(0.42 * Math.sin(knee), 0.43 + 0.42 * Math.cos(knee));
        legs[i].upper.rotation.x = hip;
        legs[i].lower.rotation.x = knee;
        legs[i].foot.rotation.x = -hip - knee;
        arms[i].upper.rotation.x = Math.sin((phase + i * 0.5) * Math.PI * 2) * 0.35 * weight;
        arms[i].lower.rotation.x = -0.08 - 0.16 * weight;
      }
    },
  };
}

/** Keep joint pivots for walkers; bake a seated figure into just three material draws. */
function bake(root: T.Group, flatten: boolean) {
  if (!flatten) for (const child of root.children) if (child instanceof T.Group) bake(child, false);
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const meshes: T.Mesh[] = [];
  if (flatten)
    root.traverse((o) => {
      if (o instanceof T.Mesh) meshes.push(o);
    });
  else for (const o of root.children) if (o instanceof T.Mesh) meshes.push(o);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  for (const mesh of meshes) {
    const geometry = (
      mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    ).applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    const material = mesh.material as T.Material;
    const parts = batches.get(material) ?? [];
    parts.push(geometry);
    batches.set(material, parts);
    mesh.geometry.dispose();
    mesh.removeFromParent();
  }
  if (flatten) root.clear();
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
}
