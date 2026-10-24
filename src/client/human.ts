// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { humanMaterial, humanSurface } from './human-surface';
import { animateHuman } from './human-gait';
export interface HumanFigure {
  group: T.Group;
  animate(distance: number, dt: number, turn?: number): void;
}
const templates = new Map<'walking' | 'seated', T.Group>();

/** A continuous clothed surface bound in an A-pose. +Z is forward, metres. */
export function createHuman(pose: 'walking' | 'seated' = 'walking'): HumanFigure {
  const template = templates.get(pose);
  if (template)
    return figure(
      (pose === 'seated' ? template.clone(true) : cloneSkeleton(template)) as T.Group,
      pose,
    );
  const group = new T.Group(),
    bones: T.Bone[] = [];
  function joint(parent: T.Object3D, name: string, x: number, y: number, z = 0) {
    const b = new T.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    bones.push(b);
    return b;
  }
  const hips = joint(group, 'hips', 0, 0.94),
    spine = joint(hips, 'spine', 0, 0.12),
    torso = joint(spine, 'torso', 0, 0.15),
    neck = joint(torso, 'neck', 0, 0.27),
    head = joint(neck, 'head', 0, 0.158, 0.004);
  const arms: { upper: T.Bone; lower: T.Bone }[] = [],
    legs: { upper: T.Bone; lower: T.Bone; foot: T.Bone }[] = [];
  for (const side of [-1, 1]) {
    const upper = joint(torso, `arm-${side}`, side * 0.221, 0.179);
    upper.rotation.z = side * 0.23;
    const lower = joint(upper, `forearm-${side}`, 0, -0.285);
    // Wrists carry restrained follow-through from the recorded gait.
    joint(lower, `hand-${side}`, 0, -0.293);
    arms.push({ upper, lower });
    const thigh = joint(hips, `thigh-${side}`, side * 0.105, 0),
      shin = joint(thigh, `shin-${side}`, 0, -0.43),
      foot = joint(shin, `foot-${side}`, 0, -0.42);
    legs.push({ upper: thigh, lower: shin, foot });
  }
  group.updateMatrixWorld(true);
  const skin = new T.SkinnedMesh(humanSurface(bones), humanMaterial());
  skin.name = 'continuous-human';
  skin.castShadow = skin.receiveShadow = true;
  group.add(skin);
  skin.bind(new T.Skeleton(bones));
  skin.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.35);
  skin.boundingBox = new T.Box3(new T.Vector3(-0.65, -0.1, -0.85), new T.Vector3(0.65, 1.9, 0.85));
  if (pose === 'seated') {
    hips.position.y = 0;
    torso.rotation.x = 0.1;
    for (const arm of arms) {
      arm.upper.rotation.set(-1.05, 0, 0);
      arm.lower.rotation.x = -0.46;
    }
    for (const leg of legs) {
      leg.upper.rotation.x = -1.38;
      leg.lower.rotation.x = 1.43;
      leg.foot.rotation.x = -0.05;
    }
    group.updateMatrixWorld(true);
    skin.skeleton.update();
    const geometry = skin.geometry.clone(),
      position = geometry.attributes.position,
      normal = geometry.attributes.normal;
    const point = new T.Vector3(),
      n = new T.Vector3(),
      out = new T.Vector3(),
      matrix = new T.Matrix4(),
      normalMatrix = new T.Matrix3();
    const ids = geometry.attributes.skinIndex,
      weights = geometry.attributes.skinWeight;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      skin.applyBoneTransform(i, point);
      position.setXYZ(i, point.x, point.y, point.z);
      out.set(0, 0, 0);
      for (let j = 0; j < 4; j++) {
        const id = ids.array[i * 4 + j],
          weight = weights.array[i * 4 + j];
        if (!weight) continue;
        matrix.multiplyMatrices(bones[id].matrixWorld, skin.skeleton.boneInverses[id]);
        normalMatrix.getNormalMatrix(matrix);
        n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix);
        out.addScaledVector(n, weight);
      }
      out.normalize();
      normal.setXYZ(i, out.x, out.y, out.z);
    }
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.shared = true;
    group.clear();
    skin.skeleton.dispose();
    const seated = new T.Mesh(geometry, skin.material);
    seated.castShadow = seated.receiveShadow = true;
    group.add(seated);
  } else {
    // Relax from the modelling A-pose into the same neutral pose used by animation.
    for (let i = 0; i < arms.length; i++) arms[i].upper.rotation.z = (i ? 1 : -1) * 0.14;
  }
  templates.set(pose, (pose === 'seated' ? group.clone(true) : cloneSkeleton(group)) as T.Group);
  return figure(group, pose);
}

function figure(group: T.Group, pose: 'walking' | 'seated'): HumanFigure {
  return { group, animate: pose === 'walking' ? animateHuman(group) : () => {} };
}
