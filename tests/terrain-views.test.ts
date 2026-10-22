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
  assert.ok(clear.far < 950 && clear.near >= 250);
  assert.ok(clear.far > rain.far && rain.far > storm.far);
});
