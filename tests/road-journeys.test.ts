// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadJourneyGraphSteps, roadJourneyDistances } from '../src/shared/road-journeys';
import { finishRoadWork } from '../src/shared/road-work';
import type { Road } from '../src/shared/town';
test('journeys split intersections and T junctions instead of charging whole segments', () => {
  const roads: Road[] = [
    { a: { x: -100, z: 0 }, b: { x: 100, z: 0 }, width: 5 },
    { a: { x: 0, z: -100 }, b: { x: 0, z: 100 }, width: 5 },
    { a: { x: 70, z: 0 }, b: { x: 70, z: 100 }, width: 5 },
  ];
  const graph = finishRoadWork(
    roadJourneyGraphSteps(roads, [
      { x: -50, z: 0 },
      { x: 0, z: 50 },
      { x: 70, z: 60 },
    ]),
  );
  const distances = finishRoadWork(roadJourneyDistances(graph, graph.anchors[0]));
  assert.equal(distances[graph.anchors[1]], 100);
  assert.equal(distances[graph.anchors[2]], 180);
});
test('overlapping lane ends connect with physical distance, while separated roads remain disconnected', () => {
  const roads: Road[] = [
    { a: { x: 0, z: 0 }, b: { x: 50, z: 0 }, width: 5 },
    { a: { x: 53, z: 0 }, b: { x: 100, z: 0 }, width: 5 },
    { a: { x: 110, z: 0 }, b: { x: 150, z: 0 }, width: 5 },
  ];
  const graph = finishRoadWork(roadJourneyGraphSteps(roads, [roads[0].a, roads[1].b, roads[2].b]));
  const distances = finishRoadWork(roadJourneyDistances(graph, graph.anchors[0]));
  assert.equal(distances[graph.anchors[1]], 100);
  assert.equal(distances[graph.anchors[2]], Infinity);
});
test('mature graph construction bounds exact distance work and yields within the survey', () => {
  const roads: Road[] = Array.from({ length: 2000 }, (_, i) => ({
    a: { x: i * 30, z: 0 },
    b: { x: i * 30 + 6, z: 0 },
    width: 5,
  }));
  const hypot = Math.hypot;
  let count = 0,
    yields = 0;
  Math.hypot = (...values: number[]) => {
    count++;
    return hypot(...values);
  };
  try {
    const work = roadJourneyGraphSteps(roads, [roads[0].a, roads.at(-1)!.b]);
    let step = work.next();
    while (!step.done) {
      yields++;
      step = work.next();
    }
    assert.ok(yields >= roads.length, 'server can interleave movement during construction');
    assert.ok(count < roads.length * 20, `avoid all-pairs distance checks (${count})`);
    assert.equal(
      finishRoadWork(roadJourneyDistances(step.value, step.value.anchors[0]))[
        step.value.anchors[1]
      ],
      Infinity,
    );
  } finally {
    Math.hypot = hypot;
  }
});
