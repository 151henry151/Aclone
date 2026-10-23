// SPDX-License-Identifier: GPL-3.0-or-later
import { Euler, Quaternion, Vector3 } from 'three';

/** The four tyre contacts of the standard tractor, in rendered metres. */
const defaultContacts = [-1.22 * 0.82, 1.22 * 0.82].flatMap((x) =>
  [-1.15 * 0.82, 1.37 * 0.82].map((z) => new Vector3(x, 0, z)),
);
/** Align the wheelbase with the bare ground. A fitted tangent plane supplies
 * pitch/roll, then all four rotated contacts determine the resting height.
 * This is visual only: server travel speed, heading and collisions are unchanged. */
export function vehicleGround(
  x: number,
  z: number,
  heading: number,
  sample: (x: number, z: number) => number,
  contacts: Vector3[] = defaultContacts,
) {
  const c = Math.cos(heading),
    s = Math.sin(heading);
  const heights = contacts.map((p) => sample(x + p.x * c + p.z * s, z + p.z * c - p.x * s));
  const along =
    (heights[1] + heights[3] - (heights[0] + heights[2])) / (2 * (contacts[1].z - contacts[0].z));
  const across =
    (heights[2] + heights[3] - (heights[0] + heights[1])) / (2 * (contacts[2].x - contacts[0].x));
  const pitch = -Math.atan(along),
    roll = Math.atan(across * Math.cos(pitch));
  const rotation = new Euler(pitch, heading, roll, 'YXZ');
  const q = new Quaternion().setFromEuler(rotation);
  const y = Math.max(
    ...contacts.map((p) => {
      const v = p.clone().applyQuaternion(q);
      return sample(x + v.x, z + v.z) - v.y;
    }),
  );
  return { rotation, y };
}
