// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tideOffset,
  waterLevel,
  swell,
  waveAmplitude,
  boatSeaPose,
  waveImpact,
  oceanDate,
} from '../src/shared/ocean';
import { createWorld, addPlayer, move } from '../src/shared/simulation';
import { defaultCreator } from '../src/shared/creator';
import { preparePuddlewickOcean } from '../src/server/puddlewick-ocean';
import { dockHeight } from '../src/shared/dock';

test('tides are continuous, lunar-timed, with larger spring than neap ranges', () => {
  const range = (start: number) => {
    const samples = Array.from({ length: 1200 }, (_, i) => tideOffset(start + i / 1200, 2));
    return Math.max(...samples) - Math.min(...samples);
  };
  assert.ok(range(23) > range(30) * 1.6);
  const highs: number[] = [];
  for (let i = 1; i < 4000; i++) {
    const d = 23 + i / 1000;
    if (tideOffset(d, 2) > tideOffset(d - 0.001, 2) && tideOffset(d, 2) > tideOffset(d + 0.001, 2))
      highs.push(d);
  }
  assert.ok(highs.length >= 7 && highs.length <= 8);
  const period = ((highs.at(-1)! - highs[0]) / (highs.length - 1)) * 24;
  assert.ok(period > 12.1 && period < 12.8);
  assert.ok(Math.abs(tideOffset(365 - 1e-6, 2) - tideOffset(365 + 1e-6, 2)) < 0.001);
  assert.equal(tideOffset(100, 0), 0);
  assert.equal(oceanDate(600) - oceanDate(0), 1);
});
test('storm waves are much larger than calm, continuous and depth-limited', () => {
  const calm = waveAmplitude(0.3, false),
    storm = waveAmplitude(3, true);
  assert.ok(calm < 0.01 && storm > 1.5);
  assert.equal(waveAmplitude(3, true, 0), 0);
  for (let t = 0; t < 50; t += 0.1) {
    const deep = swell(10, 20, t, storm),
      shallow = swell(10, 20, t, storm, 0.3);
    assert.ok(Math.abs(shallow.height) <= Math.abs(deep.height) * 0.101 + 1e-8);
    assert.ok(Math.abs(swell(10, 20, t + 0.001, storm).height - deep.height) < 0.01);
  }
});
test('hulls follow swells with pitch and roll; fast crest encounters resist more than slow ones', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.settings.tidalRange = 0.6;
  w.creator = { ...defaultCreator(), weather: 'thunderstorm' };
  let range: number[] = [],
    tilted = false,
    strong = 0,
    slow = 0;
  for (let t = 0; t < 30; t += 0.1) {
    const p = boatSeaPose(w, 0, 6500, 0, 21, 6, t);
    range.push(p.y);
    tilted ||= Math.abs(p.pitch) > 0.02 && Math.abs(p.roll) > 0.01;
    strong += waveImpact(0, 6500, t, 0, 9, 1.6, 100);
    slow += waveImpact(0, 6500, t, 0, 2, 1.6, 100);
  }
  assert.ok(Math.max(...range) - Math.min(...range) > 1);
  assert.ok(tilted);
  assert.ok(strong > slow);
  const p = addPlayer(w, 's', 'Skipper');
  Object.assign(p, {
    vehicle: 30,
    x: 0,
    z: 6500,
    y: waterLevel(w),
    engine: true,
    fuel: 200,
    boatThrottle: 1,
    speed: 6,
  });
  move(w, p, { throttle: 0, steer: 0, boost: false }, 0.05);
  assert.ok(Number.isFinite(p.y) && p.speed < 6.1);
});
test('Puddlewick tide opt-in is one-time; fixed pier remains above high tide', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(preparePuddlewickOcean(w), true);
  assert.equal(w.settings.tidalRange, 0.6);
  assert.ok(dockHeight(w) > w.settings.seaLevel + 0.3);
  w.settings.tidalRange = 0;
  assert.equal(preparePuddlewickOcean(w), false);
  assert.equal(w.settings.tidalRange, 0);
  const other = createWorld('other', 'Other', 'p');
  assert.equal(preparePuddlewickOcean(other), false);
});

test('an existing public boatyard remains usable throughout the tide cycle', async () => {
  const { ensurePuddlewickBoatyard } = await import('../src/server/puddlewick-boatyard');
  const { boatLandings, boatLanding } = await import('../src/shared/boathouse');
  const { act } = await import('../src/shared/simulation');
  const { travelHeight } = await import('../src/shared/dock');
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.ok(ensurePuddlewickBoatyard(w));
  preparePuddlewickOcean(w);
  const p = addPlayer(w, 'tide', 'Skipper');
  p.fleet = [0, 5, 3];
  w.settings.vehicleLicences = false;
  for (let time = 0; time < 600; time += 10) {
    w.time = time;
    const d = boatLandings(w).find((d) => d.building)!;
    assert.ok(d);
    Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z), vehicle: 0, engine: false });
    act(w, p.id, { type: 'vehicle', slot: 3, building: d.id });
    assert.equal(p.y, waterLevel(w));
    assert.ok(boatLanding(w, p, true, d.id));
    act(w, p.id, { type: 'vehicle', slot: 0, building: d.id });
    assert.equal(p.vehicle, 0);
  }
});
