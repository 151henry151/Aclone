// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** A hand-held torch. The skeleton carries it; no extra dynamic light is allocated. */
export function createFlashlight(human: T.Group) {
  const hand = human.getObjectByName('hand--1')!,
    upper = human.getObjectByName('arm--1')!,
    forearm = human.getObjectByName('forearm--1')!,
    group = new T.Group();
  group.name = 'hand-held-flashlight';
  const metal = new T.MeshStandardMaterial({ color: '#343e41', metalness: 0.6, roughness: 0.4 });
  const body = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.19, 10), metal);
  body.rotation.x = Math.PI / 2;
  const head = new T.Mesh(new T.CylinderGeometry(0.052, 0.035, 0.065, 12), metal);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.1;
  const lens = new T.Mesh(
    new T.CircleGeometry(0.043, 12),
    new T.MeshBasicMaterial({ color: '#fff2cb' }),
  );
  lens.position.z = 0.134;
  const muzzle = new T.Object3D(),
    target = new T.Object3D();
  muzzle.position.z = 0.15;
  target.position.set(0, -0.6, 18);
  group.add(body, head, lens, muzzle, target);
  hand.add(group);
  const q = new T.Quaternion(),
    rootQ = new T.Quaternion();
  return {
    group,
    muzzle,
    target,
    update(on: boolean) {
      group.visible = on;
      if (!on) return;
      // Keep the carrying arm raised while the other arm follows the walking gait.
      upper.rotation.set(-0.85, 0, -0.13);
      forearm.rotation.set(-0.65, 0, 0);
      human.updateWorldMatrix(true, true);
      hand.getWorldQuaternion(q);
      human.getWorldQuaternion(rootQ);
      group.quaternion.copy(q.invert().multiply(rootQ));
      group.updateWorldMatrix(false, true);
    },
  };
}
