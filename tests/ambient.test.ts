// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation.ts';
import { creatorSchema, validateCreator } from '../src/shared/creator.ts';
import { ambientSchema, ambientZones } from '../src/shared/ambient.ts';
import { synthesize } from '../src/client/sound-synthesis.ts';
import { exportDesign } from '../src/server/world-design.ts';
test('ambience follows authored radius, night intervals, weather and visible object anchors', () => {
  const w = createWorld('ambience', 'Ambience', 'owner');
  w.settings.time = 23 * 3600;
  w.creator = creatorSchema.parse({
    weather: 'clear',
    models: [{ id: 'tree', name: 'Tree', parts: [{ shape: 'cone' }] }],
    objects: [{ id: 'oak', model: 'tree', name: 'Oak', x: 50, z: 0 }],
    ambience: [
      {
        id: 'birds',
        name: 'Birds',
        object: 'oak',
        radius: 20,
        startHour: 22,
        endHour: 5,
        weather: 'clear',
      },
    ],
  });
  assert.equal(ambientZones(w, { x: 0, z: 0 }).length, 0);
  assert.equal(ambientZones(w, { x: 50, z: 0 }).length, 1);
  assert.ok(ambientZones(w, { x: 55, z: 0 })[0].gain < 0.35);
  w.settings.time = 12 * 3600;
  assert.equal(ambientZones(w, { x: 50, z: 0 }).length, 0);
  w.settings.time = 3600;
  w.creator.weather = 'rain';
  assert.equal(ambientZones(w, { x: 50, z: 0 }).length, 0);
  w.creator.weather = 'clear';
  w.creator.objects[0].visible = false;
  assert.equal(ambientZones(w, { x: 50, z: 0 }).length, 0);
  w.creator.ambience = Array.from({ length: 12 }, (_, i) =>
    ambientSchema.parse({ id: 'a' + i, name: 'Shore', x: i, source: 'shore' }),
  );
  assert.equal(ambientZones(w, { x: 0, z: 0 }).length, 4);
  assert.throws(() =>
    validateCreator(w, {
      ...w.creator,
      ambience: [{ id: 'bad', name: 'Bad', source: 'asset', asset: '0'.repeat(64) }],
    }),
  );
  w.creator.ambience.push(
    ambientSchema.parse({ id: 'custom', name: 'Custom', source: 'asset', asset: '0'.repeat(64) }),
  );
  assert.ok(exportDesign(w).creator.ambience.every((a) => a.source !== 'asset'));
});
test('original ambience and chat synthesis are finite, bounded and audible', () => {
  for (const kind of ['woodland', 'shore', 'storm', 'chat'] as const) {
    const samples = synthesize(kind, 24000);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.some((v) => Math.abs(v) > 0.02));
    assert.ok(samples.every((v) => Math.abs(v) <= 0.91));
  }
});
