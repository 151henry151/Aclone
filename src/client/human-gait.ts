// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import motion from './generated/human-motion.json';
const down = new T.Vector3(0, -1, 0),
  up = new T.Vector3(0, 1, 0),
  forward = new T.Vector3(0, 0, 1);
const identity = new T.Quaternion(),
  restingHips = new T.Vector3(0, 0.94, 0);
const keys = motion.walk.keys,
  offsets = new Map(keys.map((k, i) => [k, i * 3]));
const smooth = T.MathUtils.smoothstep,
  lerp = T.MathUtils.lerp;

/** Recorded gait timing with retargeted limb lengths and constrained foot contacts.
 * Physics owns root movement; animation never moves the player or changes speed. */
export function animateHuman(group: T.Group) {
  const bone = (name: string) => group.getObjectByName(name) as T.Bone;
  const hips = bone('hips'),
    spine = bone('spine'),
    torso = bone('torso'),
    neck = bone('neck'),
    head = bone('head');
  const limbs = [1, -1].map((side) => ({
    side,
    prefix: side === 1 ? 'l' : 'r',
    upper: bone(`arm-${side}`),
    lower: bone(`forearm-${side}`),
    hand: bone(`hand-${side}`),
    thigh: bone(`thigh-${side}`),
    shin: bone(`shin-${side}`),
    foot: bone(`foot-${side}`),
    target: new T.Vector3(),
    pole: new T.Vector3(),
    pitch: 0,
    lock: new T.Vector3(),
    locked: false,
    release: 0,
  }));
  const values = new Float64Array(keys.length * 3);
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    axis = new T.Vector3(),
    vertical = new T.Vector3(),
    zaxis = new T.Vector3();
  const matrix = new T.Matrix4(),
    q = new T.Quaternion(),
    q2 = new T.Quaternion(),
    hipsQ = new T.Quaternion(),
    chestQ = new T.Quaternion(),
    spineQ = new T.Quaternion(),
    headQ = new T.Quaternion(),
    upperQ = new T.Quaternion(),
    lowerQ = new T.Quaternion(),
    footQ = new T.Quaternion();
  const point = (name: string, out: T.Vector3) => out.fromArray(values, offsets.get(name)!);
  function frame(x: T.Vector3, y: T.Vector3, out: T.Quaternion) {
    axis.copy(x).normalize();
    zaxis.crossVectors(axis, y).normalize();
    vertical.crossVectors(zaxis, axis).normalize();
    return out.setFromRotationMatrix(matrix.makeBasis(axis, vertical, zaxis));
  }
  function local(joint: T.Bone, world: T.Quaternion, parent: T.Quaternion) {
    joint.quaternion.copy(parent).invert().multiply(world);
  }
  function sample(phase: number, run: number) {
    const f = phase * 48,
      i = Math.floor(f) % 48,
      j = (i + 1) % 48,
      t = f - Math.floor(f);
    for (let k = 0; k < values.length; k++)
      values[k] = lerp(
        lerp(motion.walk.samples[i][k], motion.walk.samples[j][k], t),
        lerp(motion.run.samples[i][k], motion.run.samples[j][k], t),
        run,
      );
  }
  let phase = 0,
    speed = 0,
    weight = 0,
    direction = 1,
    time = 0,
    turnLean = 0;
  return (distance: number, dt: number, turn = 0) => {
    if (!Number.isFinite(distance) || !Number.isFinite(dt) || dt <= 0) return;
    if (Math.abs(distance) > Math.max(1.5, dt * 9)) {
      distance = 0;
      phase = 0;
      speed = 0;
      weight = 0;
      for (const l of limbs) {
        l.locked = false;
        l.release = 0;
      }
    }
    const step = Math.min(dt, 0.1),
      blend = 1 - Math.exp(-step * 10),
      measured = Math.min(6, Math.abs(distance) / dt);
    speed += (measured - speed) * blend;
    weight += (smooth(measured, 0.02, 0.45) - weight) * (1 - Math.exp(-step * 9));
    if (Math.abs(distance) > 0.0001) direction += (Math.sign(distance) - direction) * blend;
    const run = smooth(speed, 1.9, 3.2),
      shortStep = lerp(0.52, 1, smooth(speed, 0.25, 1.4));
    const stride = lerp(motion.walk.stride * shortStep, motion.run.stride, run);
    phase = (phase + Math.abs(distance) / stride) % 1;
    time += step;
    turnLean +=
      ((Number.isFinite(turn) ? T.MathUtils.clamp(turn / dt, -2, 2) : 0) *
        Math.min(speed, 3) *
        0.035 -
        turnLean) *
      blend;
    sample(phase, run);
    const longitudinal = lerp(shortStep, 1, run) * direction;
    for (let i = 0; i < keys.length; i++) values[i * 3 + 2] *= longitudinal;
    point('lhipjoint', a);
    point('rhipjoint', b);
    hips.position.copy(a).add(b).multiplyScalar(0.5);
    // Capture ankle markers sit lower than the game boot pivots.
    const ankleOffset = lerp(0.027, 0.005, run);
    hips.position.y += ankleOffset;
    hips.position.lerp(restingHips, 1 - weight);
    frame(a.sub(b), up, hipsQ);
    hipsQ.slerp(identity, 1 - weight);
    hips.quaternion.copy(hipsQ);
    point('lclavicle', a);
    point('rclavicle', b);
    point('thorax', c);
    point('root', vertical);
    frame(a.sub(b), c.sub(vertical), chestQ);
    chestQ.slerp(identity, 1 - weight);
    q.setFromAxisAngle(forward, -turnLean * weight);
    chestQ.premultiply(q);
    spineQ.copy(hipsQ).slerp(chestQ, 0.42);
    local(spine, spineQ, hipsQ);
    local(torso, chestQ, spineQ);
    point('head', a);
    point('upperneck', b);
    point('lclavicle', c);
    point('rclavicle', vertical);
    frame(c.sub(vertical), a.sub(b), headQ);
    headQ.slerp(identity, 1 - weight);
    q.copy(chestQ).slerp(headQ, 0.6);
    local(neck, q, chestQ);
    local(head, headQ, q);
    // Quiet breathing remains after movement settles; no uniform whole-body bob.
    torso.scale.y = 1 + Math.sin(time * 1.7) * 0.002 * (1 - weight);
    for (let i = 0; i < limbs.length; i++) {
      const l = limbs[i],
        prefix = l.prefix,
        cycle = (phase + i * 0.5) % 1;
      point(`${prefix}tibia`, l.target);
      point(`${prefix}femur`, l.pole);
      point(`${prefix}foot`, a).sub(l.target);
      l.pitch =
        T.MathUtils.clamp(-Math.atan2(a.y, Math.hypot(a.x, a.z)) - 0.22, -0.55, 1.5) *
        direction *
        weight;
      l.target.y += ankleOffset;
      l.target.lerp(b.set(l.side * 0.105, 0.09, 0), 1 - weight);
      // Match the hip width to our model while keeping captured lateral foot placement.
      l.target.x = lerp(l.side * 0.105, l.target.x, weight * 0.65);
      const sole = 0.087 * Math.cos(l.pitch) + (l.pitch > 0 ? 0.234 : -0.06) * Math.sin(l.pitch);
      l.target.y = Math.max(sole + 0.003, l.target.y);
      const start = lerp(0.12, 0.1, run),
        end = lerp(0.44, 0.22, run);
      const planting = cycle >= start && cycle < end && weight > 0.1 && measured > 0.03;
      if (planting) {
        if (!l.locked) {
          l.lock.copy(l.target);
          l.locked = true;
        } else {
          if (Number.isFinite(turn)) l.lock.applyAxisAngle(up, -turn);
          l.lock.z -= distance;
        }
        l.target.x = l.lock.x;
        l.target.z = l.lock.z;
        l.release = 1;
      } else if (l.locked || l.release > 0) {
        l.locked = false;
        if (Number.isFinite(turn)) l.lock.applyAxisAngle(up, -turn);
        l.lock.z -= distance;
        l.release = Math.max(0, l.release - step * 12);
        l.target.x = lerp(l.target.x, l.lock.x, l.release);
        l.target.z = lerp(l.target.z, l.lock.z, l.release);
      }
      // Never lock the knees straight to reach a planted foot. Lower the pelvis
      // smoothly enough for both leg chains to reach instead of snapping a knee.
      b.copy(l.thigh.position).applyQuaternion(hipsQ).add(hips.position);
      const horizontal = (l.target.x - b.x) ** 2 + (l.target.z - b.z) ** 2;
      const maxY = l.target.y + Math.sqrt(Math.max(0.15, 0.846 ** 2 - horizontal));
      if (b.y > maxY) hips.position.y -= b.y - maxY;
    }
    for (const l of limbs) {
      const prefix = l.prefix;
      // Analytic 3-D leg IK preserves the captured knee direction while soles stay planted.
      a.copy(l.thigh.position).applyQuaternion(hipsQ).add(hips.position); // hip socket
      b.copy(l.target).sub(a);
      const length = T.MathUtils.clamp(b.length(), 0.12, 0.849);
      b.normalize();
      c.copy(l.pole).sub(a);
      c.addScaledVector(b, -c.dot(b));
      // An almost-straight captured knee has an unstable bend plane. Keep the
      // anatomical bend forward even when reversing, with restrained lateral
      // variation from capture; never let the knee flip through the leg axis.
      const poleWeight = smooth(c.length(), 0.02, 0.12) * 0.3;
      c.normalize();
      axis.copy(forward).addScaledVector(b, -b.z).normalize();
      c.multiplyScalar(poleWeight)
        .addScaledVector(axis, 1 - poleWeight)
        .normalize();
      const along = (0.43 ** 2 - 0.42 ** 2 + length ** 2) / (2 * length),
        height = Math.sqrt(Math.max(0, 0.43 ** 2 - along ** 2));
      c.multiplyScalar(height).addScaledVector(b, along).add(a); // knee target
      upperQ.setFromUnitVectors(down, b.copy(c).sub(a).normalize());
      lowerQ.setFromUnitVectors(down, b.copy(l.target).sub(c).normalize());
      local(l.thigh, upperQ, hipsQ);
      local(l.shin, lowerQ, upperQ);
      footQ.setFromEuler(new T.Euler(l.pitch, 0, 0));
      local(l.foot, footQ, lowerQ);
      // Captured shoulders, elbows and wrists overlap instead of moving as one pendulum.
      point(`${prefix}humerus`, a);
      point(`${prefix}clavicle`, b);
      upperQ.setFromUnitVectors(down, a.sub(b).normalize());
      q.setFromEuler(new T.Euler(0, 0, l.side * 0.14));
      upperQ.slerp(q, 1 - weight);
      local(l.upper, upperQ, chestQ);
      point(`${prefix}radius`, a);
      point(`${prefix}humerus`, b);
      lowerQ.setFromUnitVectors(down, a.sub(b).normalize());
      q.copy(upperQ).multiply(q2.setFromEuler(new T.Euler(-0.12, 0, 0)));
      lowerQ.slerp(q, 1 - weight);
      local(l.lower, lowerQ, upperQ);
      point(`${prefix}hand`, a);
      point(`${prefix}radius`, b);
      q.setFromUnitVectors(down, a.sub(b).normalize());
      // Capture finger markers can be noisy; keep only a restrained wrist follow-through.
      q2.copy(lowerQ).slerp(q, 0.25 * weight);
      local(l.hand, q2, lowerQ);
    }
  };
}
