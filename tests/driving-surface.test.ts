// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move } from '../src/shared/simulation.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import { drivingSurface } from '../src/shared/driving-surface.ts';
import { roadConditions } from '../src/shared/environment.ts';
import { townRoads } from '../src/shared/town.ts';

function setup() {
  const w = createWorld('road-driving', 'Driving', 'owner');
  w.creator = creatorSchema.parse({ roads: false });
  w.buildings = [];
  w.roads = [{ a: { x: 0, z: -200 }, b: { x: 0, z: 130 }, width: 6 }];
  w.climate = { snow: 0, wetness: 0 };
  return w;
}
test('road advantage grows from dry ground to mud to snow without boosting road speeds', () => {
  const w = setup();
  const ratios: number[] = [];
  for (const climate of [
    { snow: 0, wetness: 0 },
    { snow: 0, wetness: 1 },
    { snow: 1, wetness: 0 },
    { snow: 1, wetness: 1 },
  ]) {
    w.climate = climate;
    const road = drivingSurface(w, 0, 0),
      field = drivingSurface(w, 20, 0);
    assert.deepEqual(road, roadConditions(w));
    assert.ok(field.speed > 0 && field.speed < road.speed);
    ratios.push(field.speed / road.speed);
  }
  assert.deepEqual(
    ratios.map((n) => Math.round(n * 100)),
    [90, 80, 60, 50],
  );
});
test('road edges blend smoothly and road changes take effect immediately', () => {
  const w = setup();
  const samples = Array.from({ length: 41 }, (_, i) => drivingSurface(w, 2 + i * 0.1, 0).speed);
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] <= samples[i - 1]);
    assert.ok(samples[i - 1] - samples[i] < 0.01);
  }
  w.roads = [];
  assert.equal(drivingSurface(w, 0, 0).speed, 0.9);
  w.creator!.roads = true;
  const r = townRoads(w)[0];
  assert.equal(drivingSurface(w, (r.a.x + r.b.x) / 2, (r.a.z + r.b.z) / 2).speed, 1);
  w.creator!.roads = false;
  w.landscape = {
    paths: [
      {
        id: 'lane',
        points: [
          { x: -10, z: 0 },
          { x: 10, z: 0 },
        ],
        width: 4,
        curved: false,
      },
    ],
    surfaces: [],
    barriers: [],
    scatter: [],
  };
  assert.equal(drivingSurface(w, 0, 0).speed, 1, 'creator paths also carry traffic');
});
test('real driving obeys road limits forward, reversing and boosted; walking and flying do not', () => {
  function speed(
    x: number,
    snow: number,
    wetness: number,
    vehicle = 0,
    throttle = 1,
    boost = false,
  ) {
    const w = setup(),
      p = addPlayer(w, 'driver', 'Driver');
    w.climate = { snow, wetness };
    p.vehicle = vehicle;
    p.x = x;
    p.z = 0;
    p.y = 0.15;
    p.heading = 0;
    p.speed = 100 * throttle;
    p.engine = true;
    p.fuel = 100;
    move(w, p, { throttle, steer: 0, boost }, 0.05);
    return Math.abs(p.speed);
  }
  for (const [snow, wet] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]) {
    for (const throttle of [-1, 1])
      for (const boost of [false, true]) {
        const road = speed(0, snow, wet, 0, throttle, boost);
        assert.ok(speed(20, snow, wet, 0, throttle, boost) < road);
      }
  }
  for (const vehicle of [5, 7]) assert.equal(speed(0, 1, 1, vehicle), speed(20, 1, 1, vehicle));
});
