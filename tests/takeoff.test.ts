// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move } from '../src/shared/simulation.ts';
import { ensurePuddlewickAirfield } from '../src/server/puddlewick-airfield.ts';
import { aircraftInput } from '../src/client/flight-controls.ts';
import { terrainHeight } from '../src/shared/terrain.ts';
import { flightState } from '../src/shared/flight.ts';

const idle = { throttle: 0, steer: 0, boost: false };
function runway(length = 400, reverse = false, load = 0) {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 310;
  w.settings.runwayLength = length;
  assert.equal(ensurePuddlewickAirfield(w), true);
  const a = w.airfield!;
  const p = addPlayer(w, 'pilot', 'Pilot');
  Object.assign(p, {
    vehicle: 2,
    fleet: [0, 5, 2],
    skills: ['pilot'],
    engine: true,
    fuel: 50,
    x: a.x,
    z: a.z + (reverse ? 1 : -1) * (a.length / 2 - 2),
    heading: reverse ? Math.PI : 0,
    speed: 0,
    inventory: { fuel: load },
  });
  p.y = terrainHeight(w, p.x, p.z);
  flightState(p, p.y);
  return { w, p, a, direction: reverse ? -1 : 1 };
}
function roll(length: number, reverse: boolean, load: number, rotate: boolean) {
  const { w, p, a, direction } = runway(length, reverse, load);
  const start = p.z;
  for (let t = 0; t < 40 && direction * (p.z - start) < a.length - 4; t += 0.05) {
    const keys = new Set(['w']);
    if (rotate && p.speed >= 19) keys.add('ArrowDown');
    move(w, p, aircraftInput(keys, idle, idle, false, w.settings), 0.05);
    assert.equal(p.vehicle, 2, p.lastFlightCrash?.cause);
    if (!p.flight!.grounded) break;
  }
  return { w, p, a, travelled: direction * (p.z - start) };
}

test('keyboard takeoff fits the real public strip in both directions, empty and moderately loaded', () => {
  for (const length of [220, 400])
    for (const reverse of [false, true])
      for (const load of [0, 45]) {
        const { p, a, travelled } = roll(length, reverse, load, true);
        assert.equal(
          p.flight!.grounded,
          false,
          JSON.stringify({
            length: a.length,
            reverse,
            load,
            travelled,
            speed: p.speed,
            pitch: p.flight!.pitch,
          }),
        );
        assert.ok(travelled < a.length - 4);
        assert.ok(p.y > a.height);
      }
});

test('full throttle with neutral stick stays on the real public runway', () => {
  const { p, a } = roll(220, false, 0, false);
  assert.equal(p.flight!.grounded, true);
  assert.equal(p.y, a.height);
});

test('takeoff gates are validated, portable world rules and changed gates control lift-off', async () => {
  const { act } = await import('../src/shared/simulation.ts');
  const { flightRules } = await import('../src/shared/flight-rules.ts');
  const { exportDesign, applyDesign } = await import('../src/server/world-design.ts');
  const { rulesSummary } = await import('../src/shared/rulesets.ts');
  const { Store } = await import('../src/server/store.ts');
  const { fly } = await import('../src/shared/flight.ts');
  for (const [key, value] of Object.entries({
    flightRotationSpeed: 30,
    flightTakeoffPitch: 16,
    flightTakeoffLift: 5,
  })) {
    const { w, p } = runway();
    w.owner = p.id;
    p.authority = 20;
    act(w, p.id, { type: 'settings', patch: { [key]: value } });
    const base = structuredClone(p);
    for (const pilot of [p, base]) {
      pilot.speed = 24;
      Object.assign(pilot.flight!, {
        grounded: true,
        vz: 24,
        vx: 0,
        vy: 0,
        pitch: 0.15,
        throttle: 1,
      });
    }
    const env = {
      ground: () => p.y,
      blocked: () => false,
      seaLevel: -10,
      half: 20000,
      grip: 1,
      fuelRate: 0,
      condition: 100,
    };
    fly(base, idle, 0.05, env);
    fly(p, idle, 0.05, { ...env, settings: w.settings });
    assert.equal(base.flight!.grounded, false, 'default gate accepts this rotation');
    assert.equal(p.flight!.grounded, true, key + ' must hold it on the ground');
    const store = new Store(':memory:');
    try {
      store.saveWorld(w);
      const saved = store.loadWorlds()[0].world;
      assert.equal((flightRules(saved.settings) as any)[key], value);
      const imported = createWorld('imported', 'Imported', 'builder');
      applyDesign(imported, exportDesign(w));
      assert.equal((flightRules(imported.settings) as any)[key], value);
    } finally {
      store.close();
    }
    assert.match(rulesSummary(w), /[Tt]akeoff/);
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { [key]: -1 } }));
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { [key]: 1000 } }));
    delete (w.settings as any)[key];
    assert.equal((flightRules(w.settings) as any)[key], (flightRules() as any)[key]);
  }
});

test('a genuinely short graded strip does not grant a premature takeoff', () => {
  const { w, p, a } = runway(220);
  a.length = 40;
  p.z = a.z - a.length / 2 + 2;
  p.y = terrainHeight(w, p.x, p.z);
  const start = p.z;
  while (p.z - start < a.length - 4) {
    move(w, p, aircraftInput(new Set(['w', 'ArrowDown']), idle, idle, false, w.settings), 0.05);
    assert.equal(p.vehicle, 2);
    assert.equal(p.flight!.grounded, true);
  }
});
