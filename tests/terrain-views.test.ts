// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { groundGeometry } from '../src/client/ground-geometry.ts';
import { townCentreGround } from '../src/client/town-centre-ground.ts';
import { snowTrackHeight } from '../src/client/snow-surface.ts';
import { viewFog } from '../src/client/view-distance.ts';

test('coarse terrain meets detailed terrain at every shared edge vertex', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const a = groundGeometry(w, 448, -704, true),
    b = groundGeometry(w, 576, -704, false);
  const edge = (g: typeof a, x: number) => {
    const p = g.attributes.position;
    return new Map(
      Array.from({ length: p.count }, (_, i) => i)
        .filter((i) => p.getX(i) === x)
        .map((i) => [p.getZ(i), p.getY(i)]),
    );
  };
  assert.deepEqual(edge(a, 64), edge(b, -64));
  assert.equal(edge(b, -64).size, 33);
  assert.ok(b.index!.count < a.index!.count / 4, 'distant ground has a smaller geometry budget');
  // Front faces must point up, including stitched edge fans.
  const p = b.attributes.position;
  for (let i = 0; i < b.index!.count; i += 3) {
    const [ia, ib, ic] = [0, 1, 2].map((j) => b.index!.getX(i + j));
    assert.ok(
      (p.getZ(ib) - p.getZ(ia)) * (p.getX(ic) - p.getX(ia)) -
        (p.getX(ib) - p.getX(ia)) * (p.getZ(ic) - p.getZ(ia)) >
        0,
    );
  }
  a.dispose();
  b.dispose();
});

test('rotated town-centre benches stand on the slope, independently of snow and foundation height', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const b = makeBuilding('hilltown', 'town', 560, -480);
  b.rotation = 0.7;
  b.foundationY = 80;
  const site = townCentreGround(w, b),
    sample = snowTrackHeight({ ...w, climate: undefined });
  assert.notEqual(site.benches[0].seat, site.benches[1].seat);
  for (const bench of site.benches)
    for (const foot of bench.feet) {
      const x = b.x + 0.6 * (foot.x * Math.cos(b.rotation) + foot.z * Math.sin(b.rotation));
      const z = b.z + 0.6 * (foot.z * Math.cos(b.rotation) - foot.x * Math.sin(b.rotation));
      assert.ok(Math.abs(80 + foot.ground * 0.6 - sample(x, z)) < 1e-6);
      assert.ok(bench.seat - foot.ground >= 0.85 - 1e-8);
    }
  assert.ok(site.fountain.high > site.fountain.low);
  w.climate = { snow: 1, snowDepth: 0.3, wetness: 0 };
  assert.deepEqual(townCentreGround(w, b), site);
});

test('ordinary haze reveals neighbouring towns while storms retain reduced visibility', () => {
  const clear = viewFog({ precipitation: 'clear', storm: false });
  const rain = viewFog({ precipitation: 'rain', storm: false });
  const storm = viewFog({ precipitation: 'snow', storm: true });
  assert.ok(clear.far >= 30000 && clear.near >= 250);
  assert.ok(clear.far > rain.far && rain.far > storm.far);
});

test('intermediate terrain softens the grid step while sharing every fine and coarse edge sample', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const near = groundGeometry(w, 448, -704, true);
  const middle = groundGeometry(w, 576, -704, 'medium');
  const far = groundGeometry(w, 704, -704, false);
  const edge = (g: typeof near, x: number) => {
    const p = g.attributes.position;
    return new Map(
      Array.from({ length: p.count }, (_, i) => i)
        .filter((i) => p.getX(i) === x)
        .map((i) => [p.getZ(i), p.getY(i)]),
    );
  };
  assert.deepEqual(edge(near, 64), edge(middle, -64));
  assert.deepEqual(edge(middle, 64), edge(far, -64));
  assert.ok(
    middle.index!.count > far.index!.count,
    'middle ring needs more shape than the distant mesh',
  );
  assert.ok(middle.index!.count < near.index!.count, 'middle ring must not rebuild the fine mesh');
  for (const g of [near, middle, far]) g.dispose();
});

test('high flight uses coarse cliff interiors while retaining every dense edge and surface attribute', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.coastalBluffs = [
    { id: 'flight-cliff', x: 576, z: 576, angle: 0, width: 100, inland: 140, height: 35, seed: 3 },
  ];
  const fine = groundGeometry(w, 576, 576, true);
  const high = groundGeometry(w, 576, 576, false, true);
  assert.ok(
    high.attributes.position.count < fine.attributes.position.count / 4,
    'high flight must not keep the dense cliff interior',
  );
  for (const axis of ['x', 'z'] as const)
    for (const sign of [-64, 64]) {
      const edge = (g: typeof fine) => {
        const p = g.attributes.position;
        return new Map(
          Array.from({ length: p.count }, (_, i) => i)
            .filter((i) => (axis === 'x' ? p.getX(i) : p.getZ(i)) === sign)
            .map((i) => [axis === 'x' ? p.getZ(i) : p.getX(i), p.getY(i)]),
        );
      };
      assert.deepEqual(edge(high), edge(fine));
    }
  assert.equal(high.attributes.coastalRock.count, high.attributes.position.count);
  assert.equal(high.attributes.riverSediment.count, high.attributes.position.count);
  fine.dispose();
  high.dispose();
});
