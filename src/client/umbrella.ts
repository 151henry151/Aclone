// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Player } from '../shared/types';
import { umbrellaPrint } from './umbrella-print';

export const UMBRELLA_RADIUS = 0.88;
export function needsRainUmbrella(
  p: Pick<Player, 'vehicle' | 'hitch' | 'atHome' | 'crowBody'>,
  precipitation: string,
) {
  return p.vehicle === 5 && !p.hitch && !p.atHome && !p.crowBody && precipitation === 'rain';
}
const ribs = 8,
  arcs = 12,
  rings = 8;
function surface(r: number, angle: number, open: boolean) {
  const panel = ((((angle / (Math.PI * 2)) * ribs) % 1) + 1) % 1;
  const scallop = Math.sin(panel * Math.PI);
  const radius = r * UMBRELLA_RADIUS * (1 - 0.085 * scallop * r ** 3);
  return new T.Vector3(
    Math.sin(angle) * radius * (open ? 1 : 0.065),
    0.99 - (open ? 0.31 * r ** 1.7 + 0.012 * scallop * Math.sin(r * Math.PI) : 0.79 * r),
    Math.cos(angle) * radius * (open ? 1 : 0.065),
  );
}
let canopyGeometry: T.BufferGeometry | undefined;
let cloth: T.MeshStandardMaterial | undefined;
function canopy() {
  if (!canopyGeometry) {
    const pos: number[] = [],
      closed: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    const segments = ribs * arcs;
    for (let r = 0; r <= rings; r++)
      for (let a = 0; a <= segments; a++) {
        const angle = (a / segments) * Math.PI * 2,
          v = surface(r / rings, angle, true);
        pos.push(v.x, v.y, v.z);
        const f = surface(r / rings, angle, false);
        closed.push(f.x, f.y, f.z);
        uv.push(0.5 + v.x / (UMBRELLA_RADIUS * 2), 0.5 + v.z / (UMBRELLA_RADIUS * 2));
        if (r && a) {
          const i = r * (segments + 1) + a;
          indices.push(i, i - segments - 2, i - 1, i, i - segments - 1, i - segments - 2);
        }
      }
    canopyGeometry = new T.BufferGeometry();
    canopyGeometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    canopyGeometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    canopyGeometry.setIndex(indices);
    canopyGeometry.computeVertexNormals();
    const folded = canopyGeometry.clone();
    folded.setAttribute('position', new T.Float32BufferAttribute(closed, 3));
    folded.computeVertexNormals();
    canopyGeometry.morphAttributes.position = [folded.attributes.position];
    canopyGeometry.morphAttributes.normal = [folded.attributes.normal];
    canopyGeometry.computeBoundingSphere();
    canopyGeometry.computeBoundingBox();
    canopyGeometry.userData.shared = true;
    folded.dispose();
  }
  if (!cloth) {
    cloth = new T.MeshStandardMaterial({
      color: '#ffffff',
      map: umbrellaPrint() ?? null,
      roughness: 0.78,
      side: T.DoubleSide,
    });
    cloth.userData.shared = true;
  }
  return new T.Mesh(canopyGeometry, cloth);
}
/** The left hand holds the umbrella; the right remains available for the torch.
 * Attach the returned group beside the human, so the canopy remains in first person. */
export function createRainUmbrella(human: T.Group) {
  const group = new T.Group();
  group.name = 'rain-umbrella';
  group.visible = false;
  const hand = human.getObjectByName('hand-1')!,
    upper = human.getObjectByName('arm-1')!,
    lower = human.getObjectByName('forearm-1')!;
  const fabric = canopy();
  fabric.name = 'printed-umbrella-canopy';
  fabric.castShadow = fabric.receiveShadow = true;
  group.add(fabric);
  const white = new T.MeshStandardMaterial({ color: '#f7f7f4', roughness: 0.35 });
  const metal = new T.MeshStandardMaterial({ color: '#626b73', metalness: 0.8, roughness: 0.28 });
  const shaft = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 1.06, 8), metal);
  shaft.position.y = 0.47;
  group.add(shaft);
  const tip = new T.Mesh(new T.CapsuleGeometry(0.018, 0.095, 3, 8), white);
  tip.position.y = 1.035;
  group.add(tip);
  const hook = new T.CatmullRomCurve3([
    new T.Vector3(0, 0.07, 0),
    new T.Vector3(0, -0.1, 0),
    new T.Vector3(0.025, -0.18, 0),
    new T.Vector3(0.105, -0.2, 0),
    new T.Vector3(0.155, -0.14, 0),
    new T.Vector3(0.15, -0.055, 0),
  ]);
  const handle = new T.Mesh(new T.TubeGeometry(hook, 20, 0.018, 8, false), white);
  group.add(handle);
  const runner = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.05, 8), metal);
  group.add(runner);
  const ribsGeometry = new T.BufferGeometry();
  const ribPositions = new Float32Array(ribs * rings * 2 * 3);
  ribsGeometry.setAttribute('position', new T.BufferAttribute(ribPositions, 3));
  const skeleton = new T.LineSegments(ribsGeometry, new T.LineBasicMaterial({ color: '#b4bac1' }));
  skeleton.frustumCulled = false;
  group.add(skeleton);
  const seamGeometry = new T.BufferGeometry();
  const seamPositions = new Float32Array(ribPositions.length);
  seamGeometry.setAttribute('position', new T.BufferAttribute(seamPositions, 3));
  const seams = new T.LineSegments(seamGeometry, new T.LineBasicMaterial({ color: '#ffffff' }));
  seams.frustumCulled = false;
  group.add(seams);
  const tips = new T.InstancedMesh(new T.SphereGeometry(0.014, 6, 4), white, ribs);
  tips.frustumCulled = false;
  group.add(tips);
  const matrix = new T.Matrix4(),
    point = new T.Vector3(),
    roof = new T.Vector3();
  const heldUpper = new T.Quaternion().setFromEuler(new T.Euler(-0.32, 0, 0.1));
  const liftingUpper = new T.Quaternion().setFromEuler(new T.Euler(-1.05, 0, 0.1));
  const upperPose = new T.Quaternion();
  const heldLower = new T.Quaternion().setFromEuler(new T.Euler(-1.62, 0, 0));
  let amount = 0,
    previous = -1;
  return {
    group,
    fabric,
    get openness() {
      return T.MathUtils.smoothstep(amount, 0.25, 1);
    },
    /** Position/radius consumed by the local precipitation renderer. */
    shelter() {
      if (amount < 0.98 || !group.visible) return undefined;
      roof.set(0, 0.65, 0);
      group.localToWorld(roof);
      return roof;
    },
    update(wet: boolean, dt: number) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      amount = T.MathUtils.clamp(amount + ((wet ? 1 : -1) * Math.min(dt, 0.1)) / 1.05, 0, 1);
      group.visible = amount > 0;
      if (!group.visible) return;
      const hold = T.MathUtils.smoothstep(amount, 0, 0.28),
        open = T.MathUtils.smoothstep(amount, 0.25, 1);
      // Lift above the head before opening the skirt, then settle the grip.
      upperPose.copy(liftingUpper).slerp(heldUpper, T.MathUtils.smoothstep(open, 0.55, 1));
      upper.quaternion.slerp(upperPose, hold);
      lower.quaternion.slerp(heldLower, hold);
      human.updateWorldMatrix(true, true);
      hand.getWorldPosition(point);
      if (group.parent) group.parent.worldToLocal(point);
      group.position.copy(point);
      if (open === previous) return;
      previous = open;
      fabric.morphTargetInfluences![0] = 1 - open;
      runner.position.y = 0.12 + open * 0.58;
      let index = 0;
      for (let rib = 0; rib < ribs; rib++) {
        const angle = (rib / ribs) * Math.PI * 2;
        for (let section = 0; section < rings; section++)
          for (const end of [section, section + 1]) {
            const v = surface(end / rings, angle, false).lerp(
              surface(end / rings, angle, true),
              open,
            );
            ribPositions.set([v.x, v.y - 0.005, v.z], index);
            seamPositions.set([v.x, v.y + 0.002, v.z], index);
            index += 3;
          }
        const v = surface(1, angle, false).lerp(surface(1, angle, true), open);
        tips.setMatrixAt(rib, matrix.makeTranslation(v.x, v.y, v.z));
      }
      ribsGeometry.attributes.position.needsUpdate = true;
      seamGeometry.attributes.position.needsUpdate = true;
      tips.instanceMatrix.needsUpdate = true;
    },
  };
}
