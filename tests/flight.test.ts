// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fly, flightState, type FlightEnvironment } from '../src/shared/flight.ts';
import { addPlayer, createWorld, move, act, terrainHeight } from '../src/shared/simulation.ts';
import { aircraftInput } from '../src/client/flight-controls.ts';
import { LocalPrediction } from '../src/client/prediction.ts';
import { Store } from '../src/server/store.ts';
import { prepareFrame } from '../src/server/snapshots.ts';
import { MotionTrack } from '../src/client/motion.ts';
import { aircraftControllerInput } from '../src/client/controller.ts';
import type { Input, Player } from '../src/shared/types.ts';
const idle: Input = { throttle: 0, steer: 0, boost: false };
const env: FlightEnvironment = {
  ground: () => 0,
  blocked: () => false,
  seaLevel: -1,
  half: 20000,
  grip: 1,
  fuelRate: 0.03,
  condition: 100,
};
function pilot(altitude = 0) {
  const w = createWorld('flight', 'Flight', 'p');
  w.buildings = [];
  const p = addPlayer(w, 'p', 'Pilot');
  Object.assign(p, {
    vehicle: 2,
    fleet: [0, 5, 2],
    engine: true,
    fuel: 50,
    x: 0,
    y: altitude,
    z: 0,
    heading: 0,
    speed: 0,
  });
  flightState(p, 0);
  return { w, p };
}
function airborne(height = 150, speed = 26, sink = 0) {
  const { p } = pilot(height);
  Object.assign(p.flight!, {
    throttle: 1,
    pitch: 0.08,
    vx: 0,
    vy: sink,
    vz: speed,
    grounded: false,
    airspeed: speed,
  });
  p.speed = speed;
  return p;
}
function run(
  p: Player,
  seconds: number,
  input: Input | ((t: number) => Input) = idle,
  environment = env,
  dt = 0.05,
) {
  for (let t = 0; t < seconds - 1e-6; t += dt) {
    const accident = fly(p, typeof input === 'function' ? input(t) : input, dt, environment);
    if (accident) return accident;
  }
}
const holdPitch = (p: Player, angle: number): Input => ({
  ...idle,
  pitch: (angle - p.flight!.pitch) * 3,
});
test('two-handed inputs keep throttle, rudder, pitch and bank independent', () => {
  assert.deepEqual(aircraftInput(new Set(['w', 'a', 'ArrowDown', 'ArrowRight']), idle, idle), {
    ...idle,
    throttle: 1,
    steer: 1,
    pitch: 1,
    roll: -1,
    brake: false,
  });
  assert.equal(aircraftInput(new Set(['ArrowDown']), idle, idle).throttle, 0);
  assert.equal(aircraftInput(new Set(['ArrowUp']), idle, idle).pitch, -1);
  assert.equal(aircraftInput(new Set(['ArrowDown']), idle, idle).pitch, 1);
  assert.deepEqual(aircraftInput(new Set(['w', 'ArrowUp']), idle, idle, true), {
    ...idle,
    pitch: 0,
    roll: 0,
    brake: false,
  });
});
test('throttle persists when released and wheel brakes hold against full power', () => {
  const { p } = pilot();
  run(p, 2, { ...idle, throttle: 1, brake: true });
  assert.ok(Math.abs(p.flight!.throttle - 0.48) < 0.001);
  run(p, 2, { ...idle, brake: true });
  assert.ok(Math.abs(p.flight!.throttle - 0.48) < 0.001);
  run(p, 5, { ...idle, throttle: 1, brake: true });
  assert.equal(p.flight!.throttle, 1);
  assert.equal(p.speed, 0);
  assert.equal(p.z, 0);
});
test('full throttle alone does not auto-climb; deliberate rotation follows a substantial ground run', () => {
  const { p } = pilot();
  run(p, 12, { ...idle, throttle: 1 });
  assert.equal(p.flight!.grounded, true);
  assert.equal(p.y, 0);
  const q = pilot().p;
  let liftOffDistance = 0;
  run(q, 18, (t) => {
    if (!q.flight!.grounded && !liftOffDistance) liftOffDistance = q.z;
    return {
      ...idle,
      throttle: t < 5 ? 1 : 0,
      pitch: t > 8 && q.flight!.grounded ? 0.8 : (0.08 - q.flight!.pitch) * 3,
    };
  });
  assert.ok(liftOffDistance > 60 && liftOffDistance < 200, String(liftOffDistance));
  assert.ok(q.y > 5);
});
test('banking turns the aircraft and neutral ailerons retain bank instead of snapping level', () => {
  const p = airborne();
  run(p, 2, { ...idle, roll: 0.6 });
  const bank = p.flight!.bank;
  assert.ok(bank > 0.4);
  run(p, 4, () => holdPitch(p, 0.08));
  assert.ok(p.flight!.bank >= bank);
  assert.ok(p.heading > 0.3);
});
test('excess angle of attack stalls; lowering the nose recovers with a loss of height', () => {
  const p = airborne(150, 19);
  let stalled = false;
  const accident = run(p, 20, (t) => {
    stalled ||= p.flight!.stalled;
    return { ...idle, pitch: t < 4 ? 1 : t < 8 ? -0.8 : (0.04 - p.flight!.pitch) * 3 };
  });
  assert.equal(accident, undefined);
  assert.equal(stalled, true);
  assert.equal(p.flight!.stalled, false);
  assert.ok(p.y < 150 && p.y > 40);
});
test('an engine-off aircraft glides, consumes no fuel and cannot hover', () => {
  const p = airborne();
  p.engine = false;
  const fuel = p.fuel;
  assert.equal(
    run(p, 20, () => holdPitch(p, -0.02)),
    undefined,
  );
  assert.ok(p.y < 120 && p.y > 30);
  assert.ok(p.flight!.vy < -1);
  assert.ok(p.speed > 20);
  assert.equal(p.fuel, fuel);
});
test('a gentle wings-level approach lands and braking stops the rollout', () => {
  const p = airborne(8, 26, -1.2);
  p.flight!.throttle = 0.3;
  for (let t = 0; t < 40 && !p.flight!.grounded; t += 0.05)
    assert.equal(fly(p, holdPitch(p, 0.08), 0.05, env), undefined);
  assert.equal(p.flight!.grounded, true);
  p.flight!.throttle = 0;
  assert.equal(run(p, 10, { ...idle, brake: true }), undefined);
  assert.equal(p.y, 0);
  assert.equal(p.speed, 0);
});
test('a full discrete-control takeoff, approach and landing survives modest input delay', () => {
  for (const delay of [0, 0.2, 0.4]) {
    const { p } = pilot();
    const f = p.flight!;
    const commands: Input[] = [];
    let phase = 'takeoff',
      maxHeight = 0,
      airborne = false,
      touchdownSpeed = 0;
    for (let t = 0; t < 100; t += 0.1) {
      if (phase === 'takeoff' && !f.grounded) {
        phase = 'climb';
        airborne = true;
      }
      if (phase === 'climb' && p.y > 20) phase = 'approach';
      if (phase === 'approach' && f.grounded) phase = 'stop';
      // Test pilot changes only ordinary controls after starting parked.
      const desiredSink = p.y < 4 ? -0.6 : -1.4;
      const approachAngle =
        (9.81 / (0.0217 * Math.max(20, f.airspeed) ** 2) - 0.28) / 4.5 +
        Math.atan2(desiredSink, Math.max(20, f.airspeed));
      const error = (phase === 'climb' ? 0.15 : approachAngle) - f.pitch - f.pitchRate * 0.7;
      const targetThrottle =
        phase === 'takeoff' ? 1 : phase === 'climb' ? 0.45 : phase === 'approach' ? 0.18 : 0;
      commands.push({
        ...idle,
        throttle:
          Math.abs(targetThrottle - f.throttle) > 0.02 ? Math.sign(targetThrottle - f.throttle) : 0,
        pitch:
          phase === 'takeoff'
            ? f.airspeed > 20
              ? 1
              : 0
            : phase === 'stop'
              ? 0
              : Math.abs(error) > 0.03
                ? Math.sign(error)
                : 0,
        brake: phase === 'stop',
      });
      if (phase === 'approach' && !f.grounded) touchdownSpeed = f.airspeed;
      assert.equal(
        fly(p, commands[Math.max(0, commands.length - 1 - Math.round(delay / 0.1))], 0.1, env),
        undefined,
      );
      maxHeight = Math.max(maxHeight, p.y);
      if (phase === 'stop' && Math.abs(p.speed) < 0.01) break;
    }
    assert.ok(airborne && maxHeight > 20, 'A real climb precedes the approach');
    assert.equal(phase, 'stop');
    assert.ok(touchdownSpeed > 20 && touchdownSpeed < 30, `Approach speed ${touchdownSpeed}`);
    assert.equal(f.grounded, true);
    assert.equal(p.y, 0);
    assert.equal(p.speed, 0);
  }
});
test('hard impacts, banked landings, obstacles and water produce distinct accidents', () => {
  assert.equal(run(airborne(0.1, 26, -10), 0.1), 'hard landing');
  const banked = airborne(0.05, 24, -1);
  banked.flight!.bank = 0.5;
  assert.equal(run(banked, 0.1), 'wing strike');
  assert.equal(
    run(airborne(20), 0.1, idle, { ...env, blocked: () => true }),
    'collision with an obstacle',
  );
  assert.equal(
    run(airborne(0.01, 24, -2), 0.1, idle, { ...env, ground: () => -5, seaLevel: 0 }),
    'water impact',
  );
});
test('physics is stable across server and faster render timesteps', () => {
  const a = airborne(),
    b = structuredClone(a);
  run(a, 10, idle, env, 0.05);
  run(b, 10, idle, env, 1 / 60);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.05);
});
test('a crash destroys only the active aircraft and emits one notice; prediction changes no world state', () => {
  const { w, p } = pilot();
  p.y = terrainHeight(w, 0, 0) + 0.01;
  Object.assign(p.flight!, { grounded: false, vz: 26, vy: -10 });
  p.vehiclePaints = { 0: 'plum', 2: 'rust' };
  p.parkedFuel = { 0: 17 };
  const before = JSON.stringify(w);
  const prediction = new LocalPrediction();
  prediction.receive(w, p, 0, 0, 0);
  prediction.sample(50, idle);
  assert.equal(JSON.stringify(w), before);
  const messages = w.messages.length;
  move(w, p, idle, 0.05);
  assert.equal(p.vehicle, 5);
  assert.deepEqual(p.fleet, [0, 5]);
  assert.deepEqual(p.vehiclePaints, { 0: 'plum' });
  assert.equal(p.fuel, 17);
  assert.equal(p.flight, undefined);
  assert.equal(p.lastFlightCrash?.cause, 'hard landing');
  assert.equal(w.messages.length, messages + 1);
  move(w, p, idle, 0.05);
  assert.equal(w.messages.length, messages + 1);
});
test('airborne players cannot switch vehicles or freeze flight by entering another activity', () => {
  const { w, p } = pilot();
  p.flight!.grounded = false;
  for (const action of [
    { type: 'vehicle', slot: 5 },
    { type: 'crow' },
    { type: 'home', building: 'home' },
    { type: 'joinGame', game: 'fishing' },
  ]) {
    assert.throws(() => act(w, p.id, action), /Land the aircraft/);
  }
});

test('saved flight resumes with throttle and velocity; remote snapshots carry interpolated attitude', () => {
  const { w, p } = pilot();
  p.online = true;
  p.y = 150;
  Object.assign(p.flight!, {
    grounded: false,
    throttle: 0.72,
    vx: 3,
    vy: 2,
    vz: 26,
    bank: 0.4,
    pitch: 0.1,
  });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world.players[p.id];
    assert.deepEqual(saved.flight, p.flight);
    const publicPilot = JSON.parse(prepareFrame(w).players[p.id]);
    assert.deepEqual(publicPilot.flight, p.flight);
    assert.equal(publicPilot.inventory, undefined);
    const track = new MotionTrack();
    track.receive(0, p);
    const later = structuredClone(p);
    later.y += 1;
    later.flight!.bank = 0.6;
    later.flight!.pitch = 0.2;
    track.receive(0.2, later);
    assert.ok(Math.abs(track.sample(0.1)!.flight!.bank - 0.5) < 1e-8);
    assert.ok(Math.abs(track.sample(0.1)!.flight!.pitch - 0.15) < 1e-8);
  } finally {
    store.close();
  }
});
test('gamepad flight uses separate sticks and a wheel brake', () => {
  const input = aircraftControllerInput({
    axes: [-1, -1, 1, -1],
    buttons: Array.from({ length: 6 }, (_, i) => ({ pressed: i === 4 })) as GamepadButton[],
  });
  assert.equal(input.throttle, 1);
  assert.equal(input.steer, 1);
  assert.equal(input.pitch, 1);
  assert.equal(input.roll, -1);
  assert.equal(input.brake, true);
});

test('idle throttle-down pushes back slowly without fuel, and release/brakes stop it', () => {
  const { p } = pilot();
  p.engine = false;
  p.fuel = 0;
  assert.equal(run(p, 6, { ...idle, throttle: -1 }), undefined);
  assert.ok(p.z < -5);
  assert.ok(p.speed < -1 && p.speed >= -1.5);
  assert.equal(p.flight!.throttle, 0);
  assert.equal(p.flight!.grounded, true);
  assert.equal(p.fuel, 0);
  run(p, 1, { ...idle, throttle: -1, brake: true });
  assert.equal(p.speed, 0);
  const stopped = p.z;
  run(p, 2, { ...idle, throttle: -1, brake: true });
  assert.equal(p.z, stopped);
  run(p, 2, { ...idle, throttle: -1 });
  run(p, 12, idle);
  assert.equal(p.speed, 0);
});

test('pushback steers backwards, then forward throttle resumes normal taxi', () => {
  const { p } = pilot();
  run(p, 3, { ...idle, throttle: -1 });
  run(p, 3, { ...idle, throttle: -1, steer: 1 });
  assert.ok(p.heading < -0.1);
  run(p, 5, { ...idle, throttle: 1 });
  assert.ok(p.speed > 2);
  assert.ok(p.flight!.throttle > 0.9);
  assert.equal(p.flight!.grounded, true);
});

test('throttle-down at speed or in flight never instantly reverses the aircraft', () => {
  const { p } = pilot();
  Object.assign(p.flight!, { vz: 12, airspeed: 12 });
  p.speed = 12;
  run(p, 1, { ...idle, throttle: -1 });
  assert.ok(p.speed > 10);
  const air = airborne();
  air.flight!.throttle = 0;
  run(air, 2, { ...idle, throttle: -1 });
  assert.ok(air.flight!.vz > 20);
  assert.equal(air.flight!.grounded, false);
});

test('a plane stopped against an obstacle can back away but cannot push through it', () => {
  const { p } = pilot();
  const wall = {
    ...env,
    blocked: (_from: { z: number }, to: { z: number }) => to.z > 0.01 || to.z < -6,
  };
  run(p, 6, { ...idle, throttle: 1 }, wall);
  assert.ok(p.z <= 0.01);
  assert.equal(run(p, 10, { ...idle, throttle: -1 }, wall), undefined);
  assert.ok(p.z < -5 && p.z >= -6);
  assert.equal(p.speed, 0);
});
