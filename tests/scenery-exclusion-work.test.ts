// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { sceneryChunk } from '../src/shared/scenery-obstacles';
import { farmPlotCount, farmPlotLocal, onFarmLand } from '../src/shared/farm-land';
import { inPasture } from '../src/shared/pasture-land';
import { creatorSchema } from '../src/shared/creator';

test('cold scenery generation resolves spawn reservations once per region, not per tree', () => {
  const w = createWorld('exclusion-work', 'Exclusions', 'owner');
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: true });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, { mapSize: 4000, seaLevel: -10 });
  let reads = 0;
  w.settings = new Proxy(w.settings, {
    get(target, key, receiver) {
      if (key === 'spawnClearance') reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const objects = sceneryChunk(w, 2, 2);
  assert.ok(objects.length > 10, 'exercise a populated cold chunk');
  assert.ok(reads < 20, `spawn rule read ${reads} times for one chunk`);
});

test('farm exclusions retain exact plot, pasture, rotation and slice semantics', () => {
  const w = createWorld('exclusion-parity', 'Exclusions', 'owner');
  const farm = makeBuilding('farm', 'farm', 100, 200);
  const pasture = makeBuilding('dairy', 'dairy', -100, -200);
  pasture.pasture = { x: 10, z: 20, parcels: 3, parcelSize: 25 };
  w.buildings = [farm, pasture];
  const reference = (
    x: number,
    z: number,
    padding: number,
    except: string | undefined,
    first: number,
  ) =>
    w.buildings.some((b) => {
      if (b.id === except) return false;
      if (inPasture(b, x, z, padding)) return true;
      if (b.kind !== 'farm') return false;
      const c = Math.cos(b.rotation),
        s = Math.sin(b.rotation);
      const lx = (x - b.x) * c - (z - b.z) * s,
        lz = (x - b.x) * s + (z - b.z) * c;
      return Array.from({ length: farmPlotCount(b) }, (_, i) => farmPlotLocal(i))
        .slice(first)
        .some((p) => Math.abs(lx - p.x) < 4 + padding && Math.abs(lz - p.z) < 4 + padding);
    });
  for (const count of [4, 16, 64]) {
    farm.farmPlots = count;
    for (const rotation of [0, Math.PI / 2, 0.7]) {
      farm.rotation = pasture.rotation = rotation;
      for (const first of [0, 4, -4, 1.9, -1.9, Infinity, -Infinity, NaN]) {
        for (const padding of [-5, 0, 4]) {
          for (const b of w.buildings)
            for (const lx of [-100, 6, 10, 14, 18, 250])
              for (const lz of [-100, 5, 9, 13, 17, 21]) {
                const x = b.x + lx * Math.cos(rotation) + lz * Math.sin(rotation),
                  z = b.z - lx * Math.sin(rotation) + lz * Math.cos(rotation);
                for (const except of [undefined, 'farm', 'dairy'])
                  assert.equal(
                    onFarmLand(w, x, z, padding, except, first),
                    reference(x, z, padding, except, first),
                  );
              }
        }
      }
    }
  }
});
