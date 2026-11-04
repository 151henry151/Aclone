// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, act } from '../src/shared/simulation';
import { airfieldHeight } from '../src/shared/airfield';
import { rulesSummary } from '../src/shared/rulesets';
import { Store } from '../src/server/store';
import { applyDesign, exportDesign, configureRules } from '../src/server/world-design';
import { flightRules, flightRuleFields } from '../src/shared/flight-rules';
import { flightState, fly, type FlightEnvironment } from '../src/shared/flight';
import { ensurePuddlewickAirfield } from '../src/server/puddlewick-airfield';
import { terrainHeight } from '../src/shared/terrain';
import { aircraftInput } from '../src/client/flight-controls';
import type { Input } from '../src/shared/types';

const idle: Input = { throttle: 0, steer: 0, boost: false };
const radians = (degrees: number) => (degrees * Math.PI) / 180;
function approach(height = 0.01, speed = 26, sink = -5) {
  const w = createWorld('landing', 'Landing', 'pilot');
  const p = addPlayer(w, 'pilot', 'Pilot');
  Object.assign(p, {
    x: 0,
    z: 0,
    y: height,
    heading: 0,
    vehicle: 2,
    fleet: [0, 5, 2],
    engine: true,
    fuel: 50,
    speed,
  });
  Object.assign(flightState(p, 0), {
    grounded: false,
    vz: speed,
    vy: sink,
    throttle: 0.2,
    pitch: radians(-8),
    bank: radians(15),
  });
  const env: FlightEnvironment = {
    ground: () => 0,
    blocked: () => false,
    seaLevel: -10,
    half: 20000,
    grip: 1,
    fuelRate: 0.03,
    condition: 100,
    ...{ settings: w.settings },
  };
  return { w, p, env };
}
test('firm crooked arrivals survive default limits, while dives, steep bank, water and obstacles still crash', () => {
  const normal = approach();
  assert.equal(fly(normal.p, { ...idle, brake: true }, 0.05, normal.env), undefined);
  assert.equal(normal.p.flight!.grounded, true);
  for (const [cause, patch, environment] of [
    ['hard landing', { vy: -10 }, {}],
    ['wing strike', { bank: radians(45) }, {}],
    ['nose or tail strike', { pitch: radians(-20) }, {}],
    ['too fast', { vz: 48 }, {}],
    ['sideways', { vx: 22, vz: 20 }, {}],
    ['water impact', {}, { ground: () => -5, seaLevel: 0 }],
    ['collision with an obstacle', {}, { blocked: () => true }],
  ] as const) {
    const { p, env } = approach();
    Object.assign(p.flight!, patch);
    assert.equal(fly(p, idle, 0.05, { ...env, ...environment }), cause);
  }
});
test('airbrake bleeds a fast approach, supports a stable descent and does not stall a level slow aircraft', () => {
  for (const initialSpeed of [24, 38]) {
    const a = approach(200, initialSpeed, 0);
    Object.assign(a.p.flight!, { pitch: 0.08, bank: 0 });
    const b = structuredClone(a.p);
    let stalled = false;
    for (let t = 0; t < 12; t += 0.05) {
      assert.equal(fly(a.p, { ...idle, brake: true }, 0.05, a.env), undefined);
      assert.equal(fly(b, idle, 0.05, a.env), undefined);
      stalled ||= a.p.flight!.stalled;
    }
    assert.ok(a.p.y < b.y - 2, 'B must increase descent');
    assert.ok(a.p.speed < b.speed - 1, 'B must reduce speed');
    assert.equal(stalled, false, 'B cannot stall a level approach');
    if (initialSpeed === 24)
      assert.ok(a.p.flight!.vy >= -4.5 && a.p.flight!.vy <= -1.8, `descent ${a.p.flight!.vy}`);
  }
});
test('full key presses with a late flare land on the actual graded runway and stop on the paint', () => {
  for (const releaseDelay of [0, 0.3]) {
    const w = createWorld('puddlewick', 'Puddlewick', 'server');
    w.towns[0].radius = 310;
    assert.equal(ensurePuddlewickAirfield(w), true);
    const a = w.airfield!;
    const p = addPlayer(w, 'pilot', 'Pilot');
    Object.assign(p, {
      vehicle: 2,
      fleet: [0, 5, 2],
      x: a.x,
      z: a.z - a.length / 2 - 20,
      y: a.height + 10,
      heading: 0,
      speed: 30,
      fuel: 50,
      engine: true,
    });
    Object.assign(flightState(p, a.height), {
      grounded: false,
      vz: 30,
      vy: -3,
      pitch: radians(-6),
      bank: radians(8),
      throttle: 0.25,
    });
    let landed = false;
    for (let t = 0; t < 25; t += 0.05) {
      const keys = new Set(['b']);
      if (t < 1.05) keys.add('s');
      if (t >= 1.4 && t < 1.65 + releaseDelay) keys.add('ArrowDown');
      move(w, p, aircraftInput(keys, idle, idle), 0.05);
      assert.equal(p.vehicle, 2, `arrival failed: ${p.lastFlightCrash?.cause}`);
      landed ||= !!p.flight!.grounded;
      if (landed && Math.abs(p.speed) < 0.01) break;
    }
    assert.equal(landed, true);
    assert.ok(Math.abs(p.speed) < 0.01);
    assert.ok(Math.abs(p.x - a.x) < a.width / 2, `lateral position ${p.x - a.x}`);
    assert.ok(Math.abs(p.z - a.z) < a.length / 2, `longitudinal position ${p.z - a.z}`);
    assert.equal(p.y, terrainHeight(w, p.x, p.z));
  }
});
test('strict contacts remain selectable and world landing limits validate, save and reach the summary', () => {
  const { w, p, env } = approach();
  act(w, p.id, { type: 'settings', patch: { flightStrictLanding: true } });
  assert.equal(fly(p, idle, 0.05, env), 'hard landing');
  assert.match(rulesSummary(w), /strict.*3\.5/i);
  act(w, p.id, { type: 'settings', patch: { flightStrictLanding: false, flightLandingSink: 6 } });
  for (const patch of [
    { flightLandingSink: -1 },
    { flightLandingBank: 100 },
    { runwayWidth: 1 },
    { flightAirbrake: 1 },
  ])
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    assert.equal((saved.settings as any).flightLandingSink, 6);
    assert.match(rulesSummary(saved), /6 m\/s/);
  } finally {
    store.close();
  }
});
test('flight settings survive portable designs, creation overrides and missing legacy keys', () => {
  const { w } = approach();
  configureRules(w, { flightLandingSink: 6, flightAirbrake: false, runwayWidth: 34 });
  const target = createWorld('imported', 'Imported', 'builder');
  applyDesign(target, exportDesign(w));
  assert.equal(target.settings.flightLandingSink, 6);
  assert.equal(target.settings.flightAirbrake, false);
  assert.equal(target.settings.runwayWidth, 34);
  const legacy = approach();
  for (const key of Object.keys(flightRuleFields)) delete (legacy.w.settings as any)[key];
  assert.deepEqual(flightRules(legacy.w.settings), flightRules());
  assert.equal(fly(legacy.p, idle, 0.05, legacy.env), undefined);
  const off = approach(200, 30, 0);
  Object.assign(off.w.settings, { flightAirbrake: false });
  const plain = structuredClone(off.p);
  for (let t = 0; t < 3; t += 0.05) {
    fly(off.p, { ...idle, brake: true }, 0.05, off.env);
    fly(plain, idle, 0.05, off.env);
  }
  assert.deepEqual(off.p.flight, plain.flight, 'disabled airbrake has no airborne effect');
});
test('released controls settle bank and pitch, and keyboard taps retain less authority than analog', () => {
  const { p, env } = approach(150, 24, 0);
  Object.assign(p.flight!, { pitch: 0.2, bank: radians(20) });
  for (let t = 0; t < 5; t += 0.05) fly(p, idle, 0.05, env);
  assert.ok(Math.abs(p.flight!.bank) < radians(5));
  const keyboard = approach(150, 24, 0);
  Object.assign(keyboard.p.flight!, { pitch: 0.08, bank: 0 });
  const analog = structuredClone(keyboard.p);
  for (let t = 0; t < 0.25; t += 0.05) {
    fly(keyboard.p, aircraftInput(new Set(['ArrowLeft']), idle, idle), 0.05, keyboard.env);
    fly(analog, { ...idle, roll: 1 }, 0.05, keyboard.env);
  }
  assert.ok(keyboard.p.flight!.bank > radians(0.5) && keyboard.p.flight!.bank < radians(4));
  assert.ok(analog.flight!.bank > keyboard.p.flight!.bank * 1.5);
});
test('ground wing clearance and abrupt-drop tolerances are world rules too', () => {
  for (const patch of [
    {},
    { flightWingClearance: 2 },
    { flightGroundWingSpeed: 30 },
    { flightWingHalfSpan: 2 },
  ]) {
    const { w, p, env } = approach(0, 24, 0);
    act(w, p.id, { type: 'settings', patch });
    Object.assign(p.flight!, { grounded: true, pitch: 0, bank: 0 });
    assert.equal(
      fly(p, idle, 0.05, { ...env, ground: (x) => Math.abs(x) * 0.4 }),
      Object.keys(patch).length ? undefined : 'wing strike on terrain',
    );
  }
  for (const drop of [0.15, 0.3]) {
    const { w, p, env } = approach(0, 24, 0);
    act(w, p.id, { type: 'settings', patch: { flightGroundDrop: drop, flightWheelbase: 4 } });
    Object.assign(p.flight!, { grounded: true, pitch: 0, bank: 0 });
    assert.equal(
      fly(p, idle, 0.05, { ...env, ground: (_x, z) => (z > 0.3 ? -0.2 : 0) }),
      undefined,
    );
    assert.equal(p.flight!.grounded, drop > 0.2);
  }
});
test('the graded shoulder is gentle and rollable while a sudden terrain step remains an impact', () => {
  const { p, env } = approach(0, 24, 0);
  const a = { x: 0, z: 0, length: 400, width: 30, height: 0, hangar: 'h', apronX: 40, apronZ: 0 };
  const ground = (x: number, z: number) => airfieldHeight(a, x, z, -2);
  assert.ok(
    ground(0, 216) > -1,
    'six metres past the level grade remains inside the soft shoulder',
  );
  Object.assign(p, { z: 209, y: 0 });
  Object.assign(p.flight!, { grounded: true, pitch: 0, bank: 0, throttle: 0 });
  for (let t = 0; t < 2; t += 0.05) {
    assert.equal(fly(p, idle, 0.05, { ...env, ground }), undefined);
    assert.equal(
      p.flight!.grounded,
      true,
      'a rollable grade does not drop the wheels into another landing',
    );
  }
  const step = approach(0, 24, 0);
  Object.assign(step.p.flight!, { grounded: true, pitch: 0, bank: 0 });
  assert.equal(
    fly(step.p, idle, 0.05, { ...step.env, ground: (_x, z) => (z > 0.3 ? 3 : 0) }),
    'hard landing',
  );
});
