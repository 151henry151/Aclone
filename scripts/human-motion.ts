// SPDX-License-Identifier: GPL-3.0-or-later
// Retarget CMU ASF/AMC source into compact, in-place gait cycles. See art/motion/README.md.
import * as T from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
const rad = Math.PI / 180;
function rotation(v: number[]) {
  return new T.Quaternion().setFromEuler(new T.Euler(v[0] * rad, v[1] * rad, v[2] * rad, 'ZYX'));
}
function parse(subject: string) {
  const asf = readFileSync(`art/motion/${subject}.asf`, 'utf8');
  const bones = new Map<
    string,
    { direction: T.Vector3; length: number; axis: T.Quaternion; dof: string[]; parent: string }
  >();
  const data = asf.split(':bonedata')[1].split(':hierarchy')[0];
  for (const block of data.split(/\bbegin\b/).slice(1)) {
    const line = (key: string) =>
      block
        .match(new RegExp(`\\b${key} +([^\\r\\n]+)`))?.[1]
        .trim()
        .split(/\s+/) ?? [];
    bones.set(line('name')[0], {
      direction: new T.Vector3(...(line('direction').map(Number) as [number, number, number])),
      length: Number(line('length')[0]),
      axis: rotation(line('axis').slice(0, 3).map(Number)),
      dof: line('dof'),
      parent: '',
    });
  }
  for (const row of asf.split(':hierarchy')[1].split(/\r?\n/)) {
    const [parent, ...children] = row.trim().split(/\s+/);
    for (const child of children) if (bones.has(child)) bones.get(child)!.parent = parent;
  }
  const frames: Record<string, number[]>[] = [];
  for (const line of readFileSync(
    `art/motion/${subject}_${subject === '09' ? '02' : '01'}.amc`,
    'utf8',
  ).split(/\r?\n/)) {
    if (/^\d+$/.test(line.trim())) frames.push({});
    else if (frames.length) {
      const [name, ...v] = line.trim().split(/\s+/);
      if (v.length) frames.at(-1)![name] = v.map(Number);
    }
  }
  return { bones, frames };
}
function make(subject: string) {
  const { bones, frames } = parse(subject);
  const scale = 0.85 / (bones.get('lfemur')!.length + bones.get('ltibia')!.length);
  const poses = frames.map((frame) => {
    const root = new T.Vector3(
      ...(frame.root.slice(0, 3) as [number, number, number]),
    ).multiplyScalar(scale);
    const points = new Map<string, T.Vector3>([['root', root]]),
      rotations = new Map<string, T.Quaternion>([['root', rotation(frame.root.slice(3))]]);
    function solve(name: string): void {
      if (points.has(name)) return;
      const b = bones.get(name)!;
      solve(b.parent);
      const angles = [0, 0, 0];
      b.dof.forEach((d, i) => (angles['xyz'.indexOf(d[1])] = frame[name]?.[i] ?? 0));
      const q = rotations
        .get(b.parent)!
        .clone()
        .multiply(b.axis)
        .multiply(rotation(angles))
        .multiply(b.axis.clone().invert());
      rotations.set(name, q);
      points.set(
        name,
        points
          .get(b.parent)!
          .clone()
          .add(
            b.direction
              .clone()
              .multiplyScalar(b.length * scale)
              .applyQuaternion(q),
          ),
      );
    }
    for (const name of bones.keys()) solve(name);
    return { root, points, rotations };
  });
  // Root trajectory determines travel direction rather than assuming capture axes.
  const trajectory = poses.at(-1)!.root.clone().sub(poses[0].root);
  trajectory.y = 0;
  const heading = Math.atan2(trajectory.x, trajectory.z),
    undo = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -heading);
  for (const pose of poses) {
    for (const p of pose.points.values()) p.applyQuaternion(undo);
    for (const q of pose.rotations.values()) q.premultiply(undo);
  }
  let contactSide = 'l';
  let local = poses.map((p) => p.points.get('ltibia')!.clone().sub(p.root));
  const peaks: number[] = [];
  for (let i = 3; i < local.length - 3; i++)
    if (local.slice(i - 3, i + 4).every((p) => p.z <= local[i].z)) peaks.push(i);
  if (peaks.length < 2) {
    contactSide = 'r';
    local = poses.map((p) => p.points.get('rtibia')!.clone().sub(p.root));
    peaks.length = 0;
    for (let i = 3; i < local.length - 3; i++)
      if (local.slice(i - 3, i + 4).every((p) => p.z <= local[i].z)) peaks.push(i);
  }
  console.log(
    subject,
    contactSide,
    'frames',
    poses.length,
    'peaks',
    peaks,
    'height',
    poses[0].root.y,
    'scale',
    scale,
  );
  // A complete central left-contact to left-contact cycle; start-up/ending steps are excluded.
  const start = peaks[0],
    end = peaks[1];
  if (start === undefined || end === undefined) throw Error('No complete gait cycle');
  const stride = poses[end].root.z - poses[start].root.z;
  const keys = [
    'root',
    'lowerback',
    'upperback',
    'thorax',
    'lowerneck',
    'upperneck',
    'head',
    'lhipjoint',
    'rhipjoint',
    'lfemur',
    'rfemur',
    'ltibia',
    'rtibia',
    'lfoot',
    'rfoot',
    'lclavicle',
    'rclavicle',
    'lhumerus',
    'rhumerus',
    'lradius',
    'rradius',
    'lhand',
    'rhand',
  ];
  const samples: number[][] = [];
  for (let i = start; i <= end; i++) {
    const p = poses[i];
    samples.push(
      keys.flatMap((key) => {
        const swapped =
          contactSide === 'r' &&
          /^[lr](hipjoint|femur|tibia|foot|clavicle|humerus|radius|hand)$/.test(key)
            ? (key[0] === 'l' ? 'r' : 'l') + key.slice(1)
            : key;
        const point = p.points
          .get(swapped)!
          .clone()
          .sub(
            new T.Vector3(
              T.MathUtils.lerp(poses[start].root.x, poses[end].root.x, (i - start) / (end - start)),
              0,
              p.root.z,
            ),
          );
        if (contactSide === 'r') point.x *= -1;
        return point.toArray().map((v) => +v.toFixed(5));
      }),
    );
  }
  // Remove cycle drift and resample to 48 frames, then a small circular filter
  // removes capture jitter while retaining the actor's asymmetry and overlapping motion.
  const closed = Array.from({ length: 48 }, (_, f) => {
    const t = f / 48,
      index = t * (samples.length - 1),
      a = Math.floor(index),
      b = Math.min(samples.length - 1, a + 1);
    return samples[a].map(
      (v, j) =>
        T.MathUtils.lerp(v, samples[b][j], index - a) - t * (samples.at(-1)![j] - samples[0][j]),
    );
  });
  const filtered = closed.map((frame, i) =>
    frame.map(
      (v, j) =>
        +(v * 0.5 + closed[(i + 47) % 48][j] * 0.25 + closed[(i + 1) % 48][j] * 0.25).toFixed(5),
    ),
  );
  return {
    subject,
    clip: subject === '09' ? '02' : '01',
    keys,
    stride,
    duration: (end - start) / 120,
    samples: filtered,
  };
}
const data = { walk: make('07'), run: make('09') };
writeFileSync('src/client/generated/human-motion.json', JSON.stringify(data) + '\n');
console.log(
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      { stride: v.stride, duration: v.duration, samples: v.samples.length },
    ]),
  ),
);
