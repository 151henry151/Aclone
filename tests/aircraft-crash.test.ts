// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move } from '../src/shared/simulation';
import { flightState } from '../src/shared/flight';
import { terrainHeight } from '../src/shared/terrain';
import { prepareFrame } from '../src/server/snapshots';
import { AircraftCrashes } from '../src/client/aircraft-crash';
test('crash particles are bounded, expire, do not replay snapshots, and reset between worlds', () => {
  const fx = new AircraftCrashes(),
    w = createWorld('crash', 'Crash test', 'server'),
    p = addPlayer(w, 'p', 'Pilot');
  p.lastFlightCrash = { at: w.time, cause: 'impact', slot: 2, x: 0, y: 0, z: 0 };
  fx.receive(w);
  assert.equal(fx.mesh.visible, true);
  assert.equal(fx.mesh.geometry.attributes.position.count, 256);
  for (let i = 0; i < 100; i++) fx.update(0.1);
  assert.equal(fx.mesh.visible, false);
  fx.receive(w);
  assert.equal(fx.mesh.visible, false);
  w.id = 'another';
  w.time += 100;
  fx.receive(w);
  assert.equal(fx.mesh.visible, false);
  fx.mesh.geometry.dispose();
  (fx.mesh.material as any).dispose();
});

test('a server-confirmed crash publishes its impact position for other clients', () => {
  const w = createWorld('crash', 'Crash test', 'server'),
    p = addPlayer(w, 'pilot', 'Pilot');
  Object.assign(p, { online: true, vehicle: 2, fleet: [0, 5, 2], speed: 30 });
  p.y = terrainHeight(w, p.x, p.z) + 0.01;
  Object.assign(flightState(p, terrainHeight(w, p.x, p.z)), {
    grounded: false,
    vy: -20,
    vz: 30,
    airspeed: 30,
  });
  move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.equal(p.vehicle, 5);
  const crash = p.lastFlightCrash!;
  assert.ok(Number.isFinite(crash.x) && Number.isFinite(crash.y) && Number.isFinite(crash.z));
  assert.deepEqual(JSON.parse(prepareFrame(w).players[p.id]).lastFlightCrash, crash);
});
