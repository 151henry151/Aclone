// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, terrainHeight } from '../src/shared/simulation.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import { drivingSurface, drivingGrade } from '../src/shared/driving-surface.ts';
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
test('roads stay clear while snow slows off-road travel more than mud', () => {
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
  assert.ok(ratios[0] > ratios[1] && ratios[1] > ratios[2]);
  assert.ok(Math.abs(ratios[2] - ratios[3]) < 0.05);
  w.climate = { snow: 1, wetness: 1, snowDepth: 0.04 };
  const base = drivingSurface(w, 20, 0).speed;
  assert.ok(base > 0.33 && base < 0.68, 'base snow is faster than old snow but slower than mud');
  const depths = [0.04, 0.16, 0.4, 1, 2, 5];
  const speeds = depths.map((depth) => {
    w.climate!.snowDepth = depth;
    assert.equal(drivingSurface(w, 0, 0).speed, 0.85, 'road does not inherit drift depth');
    return drivingSurface(w, 20, 0).speed;
  });
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] < speeds[i - 1]);
  assert.ok(speeds.at(-1)! >= 0.06 && speeds.at(-1)! < 0.08);
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

test('hill driving changes acceleration and speed in the direction of travel, including reverse', () => {
  function run(grade: number, throttle: number, boost = false, vehicle = 0) {
    const w = setup();
    w.settings.mapSize = 500;
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array.from(
        { length: 1089 },
        (_, i) => 100 + (Math.floor(i / 33) - 16) * (500 / 32) * grade,
      ),
    };
    const p = addPlayer(w, 'hill-driver', 'Hill driver');
    Object.assign(p, {
      x: 0,
      z: 0,
      y: 100,
      heading: 0,
      speed: 0,
      engine: true,
      fuel: 100,
      vehicle,
    });
    let early = 0;
    for (let i = 0; i < 100; i++) {
      move(w, p, { throttle, steer: 0, boost }, 0.05);
      if (i === 9) early = Math.abs(p.speed);
      if (vehicle === 0)
        assert.ok(Math.abs(p.y - terrainHeight(w, p.x, p.z)) < 1e-6, 'wheels follow the hillside');
    }
    return { speed: Math.abs(p.speed), early, z: p.z };
  }
  for (const boost of [false, true])
    for (const direction of [-1, 1]) {
      const up = run(0.25 * direction, direction, boost),
        flat = run(0, direction, boost),
        down = run(-0.25 * direction, direction, boost);
      assert.ok(up.speed < flat.speed && flat.speed < down.speed);
      assert.ok(up.early < flat.early && flat.early < down.early);
      assert.ok(up.speed > 2, 'steep rolling hills remain climbable');
      assert.ok(down.speed <= flat.speed * 1.31, 'downhill speed remains controlled');
    }
  assert.equal(run(0.25, 1, false, 5).speed, run(-0.25, 1, false, 5).speed, 'walking is unchanged');
});

test('dock support is flat despite the seabed and airborne tractors receive no hill bonus', () => {
  const w = setup();
  assert.ok(Math.abs(drivingGrade(w, 20, 150, 0)) < 1e-8);
  const p = addPlayer(w, 'air', 'Air');
  w.terrain = [{ x: 0, z: 0, radius: 100, height: 40 }];
  Object.assign(p, { x: 0, z: -50, y: 100, heading: 0, speed: 100, engine: true, fuel: 100 });
  move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
  assert.equal(p.speed, 13, 'airborne speed has no ground modifiers');
});
