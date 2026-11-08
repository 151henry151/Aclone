// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadSite, roadRoute, pointDistance } from '../src/shared/road-routing';
import { finishRoadWork } from '../src/shared/road-work';
import { growPavedTrunkSteps } from '../src/shared/city-trunks';
import { pavedWorld, growCityPavement } from '../src/shared/city-paving';
import { inlandBlocksGround } from '../src/shared/inland-travel';

import { riverCities } from './fixtures/city-river';
test('paved approaches stop on safe banks without claiming the existing ford as paved', () => {
  const { w, a, b } = riverCities();
  const dirt = roadRoute(w, a, b);
  assert.ok(dirt, 'the actual terrain has a traversable ford route');
  const old = dirt.slice(1).map((b, i) => ({ a: dirt[i], b, width: 5 }));
  w.roads!.push(...old);
  w.settings.cityPavingPerDay = 1000;
  const end = w.settings.dayLength;
  growCityPavement(w, 0, end);
  let maximum = 0,
    slices = 0;
  while (w.pavingDue !== undefined && slices++ < 30000) {
    const start = performance.now();
    growCityPavement(w, end, end);
    maximum = Math.max(maximum, performance.now() - start);
  }
  assert.equal(w.pavingDue, undefined, 'bounded daily survey eventually completes');
  assert.ok(maximum < 100, `city planning slice ${maximum.toFixed(1)} ms`);
  console.log(`City bank survey: ${slices} slices, maximum ${maximum.toFixed(1)} ms`);
  const project = w.pavingProjects?.['west-city'];
  assert.ok(project?.waitingForBridge, 'survey an approach and explicit missing bridge');
  const { near, far } = project.waitingForBridge;
  const site = roadSite(pavedWorld(w));
  assert.ok(site.clear(near) && site.clear(far), 'both waiting points are safely on land');
  assert.ok(pointDistance(near, far) > 0);
  for (const r of w.pavedRoads!.filter((r) => r.kind === 'trunk'))
    assert.ok(site.segment(r.a, r.b), 'never pave water');
  assert.ok(!w.pavedRoads!.some((r) => inlandBlocksGround(w, r.a, r.b, r.width / 2)));
  for (const r of old) assert.ok(w.roads!.includes(r), 'preserve original ford road');
  assert.ok(
    w.pavingFeeders?.length,
    'queue a separate dirt feeder with the existing dirt-road budget',
  );
  const feeder = w.pavingFeeders![0];
  const dirtSite = roadSite(w);
  for (let i = 1; i < feeder.path.length; i++)
    assert.ok(dirtSite.segment(feeder.path[i - 1], feeder.path[i]));
});

// Reuse the real river terrain, but prevent ford construction through the
// existing policy. Approaches must still finish without inventing a crossing.
test('disabled fords leave a dry approach and no feeder; edited banks invalidate waiting work', () => {
  const { w } = riverCities();
  w.settings.roadFords = false;
  finishRoadWork(growPavedTrunkSteps(w, w.towns[0], [w.pavedRoads![0]], 10000));
  const project = w.pavingProjects?.[w.towns[0].id];
  assert.ok(project?.waitingForBridge);
  assert.equal(project.path.length, 1);
  assert.equal(w.pavingFeeders?.length ?? 0, 0);
  const before = JSON.stringify(w.pavedRoads);
  w.settings.seaLevel = 10000;
  finishRoadWork(growPavedTrunkSteps(w, w.towns[0], w.pavedRoads!, 100));
  assert.equal(w.pavingProjects?.[w.towns[0].id], undefined);
  assert.equal(JSON.stringify(w.pavedRoads), before);
});

test('a river without any usable ford keeps its paved approach waiting without a false feeder', () => {
  const { w } = riverCities();
  w.settings.groundWaterDepth = 0.01;
  finishRoadWork(growPavedTrunkSteps(w, w.towns[0], [w.pavedRoads![0]], 10000));
  assert.ok(w.pavingProjects?.[w.towns[0].id]?.waitingForBridge);
  assert.equal(w.pavingFeeders?.length ?? 0, 0);
  const site = roadSite(pavedWorld(w));
  for (const r of w.pavedRoads!) assert.ok(site.segment(r.a, r.b));
});
