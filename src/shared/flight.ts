// SPDX-License-Identifier: GPL-3.0-or-later
import type { Input, Player } from './types';

/** Lightweight light-aircraft dynamics. Metres, seconds and radians; +pitch is nose up,
 * +bank/+rudder turn left (the game's +heading direction). Never writes world state. */
export interface FlightState {
  slot: number;
  throttle: number;
  pitch: number;
  bank: number;
  pitchRate: number;
  rollRate: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  airspeed: number;
  aoa: number;
  stalled: boolean;
}
export interface FlightEnvironment {
  ground(x: number, z: number): number;
  blocked(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
  ): boolean;
  seaLevel: number;
  half: number;
  grip: number;
  fuelRate: number;
  speed?: number;
  acceleration?: number;
  turn?: number;
  condition: number;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
const axis = (v: number | undefined) => (Number.isFinite(v) ? clamp(v!, -1, 1) : 0);
export const FLIGHT = {
  pushbackSpeed: 1.5,
  rotationSpeed: 19,
  approachSpeed: 24,
  maxLandingSink: 3.5,
  maxLandingBank: (12 * Math.PI) / 180,
  maxLandingPitch: (20 * Math.PI) / 180,
  stallAngle: (16 * Math.PI) / 180,
  gravity: 9.81,
};
export function flightState(p: Player, ground: number): FlightState {
  if (p.flight?.slot === p.vehicle) return p.flight;
  const grounded = p.y <= ground + 0.25;
  return (p.flight = {
    slot: p.vehicle,
    throttle: 0,
    pitch: grounded ? 0.22 : 0.05,
    bank: 0,
    pitchRate: 0,
    rollRate: 0,
    vx: Math.sin(p.heading) * Math.max(0, p.speed),
    vy: 0,
    vz: Math.cos(p.heading) * Math.max(0, p.speed),
    grounded,
    airspeed: Math.max(0, p.speed),
    aoa: 0,
    stalled: false,
  });
}
/** Returns an accident reason; the authoritative caller destroys the owned airframe. */
export function fly(
  p: Player,
  input: Input,
  seconds: number,
  env: FlightEnvironment,
): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const f = flightState(p, env.ground(p.x, p.z));
  const steps = Math.ceil(Math.min(seconds, 0.25) * 120),
    dt = Math.min(seconds, 0.25) / steps;
  for (let step = 0; step < steps; step++) {
    const ground = env.ground(p.x, p.z);
    f.throttle = clamp(f.throttle + axis(input.throttle) * 0.24 * dt, 0, 1);
    const powered = p.engine && (p.fuel > 0 || env.fuelRate === 0);
    const power = powered ? f.throttle * (0.7 + env.condition * 0.003) : 0;
    const speed = Math.hypot(f.vx, f.vy, f.vz),
      horizontal = Math.hypot(f.vx, f.vz);
    const authority = (clamp(speed / 22, 0, 1.25) * (env.turn ?? 1.2)) / 1.2;
    const pitchInput = axis(input.pitch),
      bankInput = axis(input.roll),
      rudder = axis(input.steer);
    if (f.grounded) {
      f.bank = 0;
      f.rollRate = 0;
      // Tail comes up with speed. The elevator must rotate the aircraft before it can lift off.
      const resting = 0.22 * (1 - clamp(speed / 14, 0, 1));
      f.pitchRate += (pitchInput * 0.55 * authority - f.pitchRate * 4) * dt;
      f.pitch = clamp(
        f.pitch + f.pitchRate * dt + (resting - f.pitch) * dt * (pitchInput ? 0 : 1.8),
        -0.04,
        0.3,
      );
      const rollingDirection = Math.sign(f.vx * Math.sin(p.heading) + f.vz * Math.cos(p.heading));
      p.heading +=
        rudder * rollingDirection * clamp(horizontal / 5, 0, 1) * (0.75 / (1 + speed / 18)) * dt;
    } else {
      const path = Math.atan2(f.vy, Math.max(0.1, horizontal));
      // Aerodynamic damping stops rotation; it does not snap the attitude back to level.
      f.pitchRate +=
        (pitchInput * 0.9 * authority - f.pitchRate * 2.5 - (f.pitch - path - 0.05) * 0.35) * dt;
      if (f.stalled) f.pitchRate -= 0.35 * dt;
      f.rollRate += (bankInput * 1.8 * authority - f.rollRate * 3.2) * dt;
      f.pitch = clamp(f.pitch + f.pitchRate * dt, -1.4, 1.4);
      f.bank = wrap(f.bank + f.rollRate * dt);
      const track = Math.atan2(f.vx, f.vz),
        slip = wrap(track - p.heading);
      p.heading +=
        (((FLIGHT.gravity * Math.tan(clamp(f.bank, -1.1, 1.1))) / Math.max(14, speed)) * 0.65 +
          rudder * 0.32 * authority +
          slip * 0.65) *
        dt;
    }
    p.heading = wrap(p.heading);
    const sh = Math.sin(p.heading),
      ch = Math.cos(p.heading),
      sp = Math.sin(f.pitch),
      cp = Math.cos(f.pitch),
      sb = Math.sin(f.bank),
      cb = Math.cos(f.bank);
    const forward = [sh * cp, sp, ch * cp],
      up = [ch * sb - sh * sp * cb, cp * cb, -sh * sb - ch * sp * cb],
      left = [ch * cb + sh * sp * sb, -cp * sb, -sh * cb + ch * sp * sb];
    const along = f.vx * forward[0] + f.vy * forward[1] + f.vz * forward[2];
    const normal = f.vx * up[0] + f.vy * up[1] + f.vz * up[2];
    f.aoa = Math.atan2(-normal, Math.max(0.1, along));
    const absAlpha = Math.abs(f.aoa),
      stall = absAlpha > FLIGHT.stallAngle;
    f.stalled = !f.grounded && stall;
    let cl = clamp(0.28 + 4.5 * f.aoa, -1.15, 1.45);
    if (stall) cl *= Math.max(0.15, 1 - (absAlpha - FLIGHT.stallAngle) * 3.2);
    const q = 0.0217 * speed * speed; // rho*S/(2*m): 23 m² wing, roughly 650 kg loaded.
    const drag = q * (40 / (env.speed ?? 40)) ** 2 * (0.035 + 0.065 * cl * cl + (stall ? 0.22 : 0));
    const lift = q * cl;
    const inv = 1 / Math.max(0.1, speed),
      direction = [f.vx * inv, f.vy * inv, f.vz * inv];
    const projection = up[0] * direction[0] + up[1] * direction[1] + up[2] * direction[2];
    const liftDir = up.map((v, i) => v - projection * direction[i]);
    const liftLength = Math.max(0.1, Math.hypot(...liftDir));
    const thrust =
      ((power * 4.2 * (env.acceleration ?? 9)) / 9) *
      Math.max(0.2, 1 - speed / ((75 * (env.speed ?? 40)) / 40));
    const slipSpeed = f.vx * left[0] + f.vy * left[1] + f.vz * left[2];
    const acceleration = forward.map(
      (v, i) =>
        v * thrust +
        (liftDir[i] / liftLength) * lift -
        direction[i] * drag -
        left[i] * slipSpeed * 0.35,
    );
    acceleration[1] -= FLIGHT.gravity;
    const from = { x: p.x, y: p.y, z: p.z };
    if (f.grounded) {
      const slope =
        (env.ground(p.x + sh * 2, p.z + ch * 2) - env.ground(p.x - sh * 2, p.z - ch * 2)) / 4;
      const rolling = 0.18 + (1 - env.grip) * 1.4;
      const brake = input.brake ? 5.5 * env.grip : 0;
      const signedSpeed = f.vx * sh + f.vz * ch;
      // Holding throttle-down at idle acts as ground-handling pushback, not
      // reverse propeller thrust. It also works with the engine off or no fuel.
      const pushback = axis(input.throttle) < 0 && f.throttle === 0 && signedSpeed < 0.3;
      let nextSpeed = signedSpeed + (thrust - FLIGHT.gravity * slope - (pushback ? 1.6 : 0)) * dt;
      const resistance = (drag + rolling + brake) * dt;
      nextSpeed = Math.sign(nextSpeed) * Math.max(0, Math.abs(nextSpeed) - resistance) || 0;
      if (pushback) nextSpeed = Math.max(-FLIGHT.pushbackSpeed, nextSpeed);
      f.vx = sh * nextSpeed;
      f.vz = ch * nextSpeed;
      f.vy = 0;
      p.y = ground;
      if (
        nextSpeed >= FLIGHT.rotationSpeed &&
        f.pitch > 0.07 &&
        acceleration[1] > 0.4 &&
        !input.brake
      ) {
        f.grounded = false;
        f.vy = acceleration[1] * dt;
        p.y += 0.025;
      }
    } else {
      f.vx += acceleration[0] * dt;
      f.vy += acceleration[1] * dt;
      f.vz += acceleration[2] * dt;
    }
    const next = { x: p.x + f.vx * dt, y: p.y + f.vy * dt, z: p.z + f.vz * dt };
    if (Math.abs(next.x) > env.half || Math.abs(next.z) > env.half) {
      if (speed > 5) return 'collision with the world boundary';
      f.vx = f.vz = 0;
      f.airspeed = p.speed = 0;
      continue;
    }
    const support = env.ground(next.x, next.z);
    if (env.blocked(from, next)) {
      if (speed > 7 || !f.grounded) return 'collision with an obstacle';
      f.vx = f.vy = f.vz = 0;
      f.airspeed = p.speed = 0;
      // Keep advancing controls while a parked aircraft touches an obstacle.
      // Otherwise only one physics substep runs and throttle-down becomes sluggish.
      continue;
    }
    // Wheels cannot glue the aircraft to a sudden drop at a cliff/runway edge.
    if (f.grounded && support < ground - 0.15) {
      f.grounded = false;
      f.vy = 0;
    }
    if (support < env.seaLevel - 0.12 && next.y <= env.seaLevel) return 'water impact';
    if (!f.grounded && next.y <= support) {
      const terrainRise = (support - ground) / dt;
      const sink = Math.max(0, terrainRise - f.vy);
      const course = Math.atan2(f.vx, f.vz);
      if (sink > FLIGHT.maxLandingSink) return 'hard landing';
      if (Math.abs(f.bank) > FLIGHT.maxLandingBank) return 'wing strike';
      if (f.pitch < -0.1 || f.pitch > FLIGHT.maxLandingPitch) return 'nose or tail strike';
      if (speed > 36 || Math.abs(wrap(course - p.heading)) > 0.35) return 'uncontrolled landing';
      f.grounded = true;
      f.vy = 0;
      f.pitchRate = 0;
      f.rollRate = 0;
      f.stalled = false;
    }
    if (f.grounded) {
      if (support < env.seaLevel - 0.12) return 'water impact';
      next.y = support;
      // Banked/uphill terrain can strike a wing even with a level fuselage.
      if (
        speed > 8 &&
        Math.max(
          env.ground(next.x + ch * 4, next.z - sh * 4),
          env.ground(next.x - ch * 4, next.z + sh * 4),
        ) -
          support >
          1.2
      )
        return 'wing strike on terrain';
    }
    p.x = next.x;
    p.y = next.y;
    p.z = next.z;
    f.airspeed = Math.hypot(f.vx, f.vy, f.vz);
    p.speed = f.grounded ? f.vx * Math.sin(p.heading) + f.vz * Math.cos(p.heading) : f.airspeed;
    if (powered) p.fuel = Math.max(0, p.fuel - env.fuelRate * (0.12 + 0.88 * f.throttle) * dt);
  }
}
