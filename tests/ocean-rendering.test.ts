// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Ocean } from '../src/client/ocean';
import { createWorld } from '../src/shared/simulation';
import { defaultCreator } from '../src/shared/creator';
import { SWELLS, swell } from '../src/shared/ocean';

function fixture(low = false) {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.creator = { ...defaultCreator(), weather: 'thunderstorm' };
  const ocean = new Ocean();
  ocean.create(w, low);
  return { w, ocean };
}
function settle(ocean: Ocean, w: ReturnType<typeof createWorld>, x: number, time: number) {
  for (let i = 0; i < 100; i++) {
    ocean.update(w, x, 6500, time, 1 / 60);
    if (ocean.mesh!.position.x === Math.round(x / 16) * 16) return;
  }
  assert.fail('Ocean survey did not finish');
}
function renderedHeight(ocean: Ocean, time: number, x: number, z: number) {
  const mesh = ocean.mesh!;
  const geometry = mesh.geometry.clone();
  const p = geometry.attributes.position,
    ground = geometry.attributes.seaGround;
  for (let i = 0; i < p.count; i++)
    p.setY(
      i,
      swell(
        p.getX(i) + mesh.position.x,
        p.getZ(i) + mesh.position.z,
        time,
        ocean.amplitude.value,
        ocean.level.value - ground.getX(i),
      ).height,
    );
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const surface = new T.Mesh(geometry, material);
  surface.position.copy(mesh.position);
  surface.updateMatrixWorld();
  const hit = new T.Raycaster(new T.Vector3(x, 100, z), new T.Vector3(0, -1, 0)).intersectObject(
    surface,
  )[0];
  geometry.dispose();
  material.dispose();
  assert.ok(hit);
  return hit.point.y;
}

test('old-world shader waves retain frame precision and agree with hull samples', () => {
  const { w, ocean } = fixture();
  const f = Math.fround;
  for (const age of [2611787.444, 20000000]) {
    let largestError = 0,
      largestOldError = 0;
    for (let frame = 0; frame < 120; frame++) {
      const time = age + frame / 60;
      ocean.update(w, 0, 6500, time, 1 / 60);
      let gpu = 0,
        old = 0;
      SWELLS.forEach(([vx, vz, length, period, weight, phase], i) => {
        const spatial = f(f(f(8.37) * f(vx) + f(6500.71) * f(vz)) * f((2 * Math.PI) / length));
        const a = ocean.amplitude.value * weight;
        gpu += a * Math.sin(f(f(spatial + f(ocean.wavePhase.value.getComponent(i))) + f(phase)));
        old += a * Math.sin(f(f(spatial - f(f(time) * f((2 * Math.PI) / period))) + f(phase)));
      });
      const cpu = swell(8.37, 6500.71, time, ocean.amplitude.value).height;
      largestError = Math.max(largestError, Math.abs(gpu - cpu));
      largestOldError = Math.max(largestOldError, Math.abs(old - cpu));
    }
    assert.ok(largestOldError > 0.1, 'Fixture must expose the former clock precision failure');
    assert.ok(largestError < 0.002, `GPU/hull mismatch ${largestError} at age ${age}`);
  }
});

test('storm surface beneath a small boat does not pop when the ocean grid recentres', () => {
  for (const low of [false, true]) {
    const { w, ocean } = fixture(low);
    for (let time = 0; time < 6; time += 0.3) {
      settle(ocean, w, 7.99, time);
      const before = renderedHeight(ocean, time, 8.37, 6500.71);
      settle(ocean, w, 8.01, time);
      const after = renderedHeight(ocean, time, 8.37, 6500.71);
      assert.ok(Math.abs(before - after) < 0.00001, `Grid jump: ${before - after}`);
      assert.ok(Math.abs(after - ocean.height(8.37, 6500.71)) < 0.04, 'Hull and water must agree');
    }
    assert.ok(ocean.mesh!.geometry.attributes.position.count <= (low ? 4225 : 9409));
  }
});

test('travel spreads depth surveys across frames and publishes a complete surface atomically', () => {
  const { w, ocean } = fixture();
  ocean.update(w, 0, 6500, 0, 1 / 60);
  const initial = ocean.mesh!.geometry.attributes.seaGround.array.slice();
  let calls = 0;
  // Instrument expensive terrain sampling, independently of machine speed.
  const survey = ocean as unknown as {
    bathymetry: (world: ReturnType<typeof createWorld>, x: number, z: number) => number;
  };
  survey.bathymetry = () => {
    calls++;
    return -999;
  };
  let frames = 0;
  do {
    calls = 0;
    ocean.update(w, 16, 6500, frames / 60, 1 / 60);
    assert.ok(calls <= 512, `Unbounded survey of ${calls} samples`);
    if (ocean.mesh!.position.x === 0)
      assert.deepEqual(ocean.mesh!.geometry.attributes.seaGround.array, initial);
    assert.ok(++frames < 100);
  } while (ocean.mesh!.position.x === 0);
  assert.ok(frames >= 19);
  assert.ok(ocean.mesh!.geometry.attributes.seaGround.array.every((v) => v === -999));
});

test('teleporting repositions a complete ocean surface immediately', () => {
  const { w, ocean } = fixture();
  ocean.update(w, 0, 6500, 0, 1 / 60);
  ocean.update(w, 16, 6500, 1, 1 / 60); // unfinished travel survey
  ocean.update(w, 4000, 6500, 2, 1 / 60);
  assert.equal(ocean.mesh!.position.x, 4000);
  assert.ok(ocean.mesh!.geometry.attributes.seaGround.array.every(Number.isFinite));
});
