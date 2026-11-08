// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { growRoads } from '../src/shared/roads';
import type { World } from '../src/shared/types';
/** Await scheduled construction without advancing the clock or adding allowances. */
export function finishPendingRoadWork(w: World) {
  for (let i = 0; i < 10000 && w.roadGrowthDue !== undefined; i++) growRoads(w, w.time, w.time);
  assert.equal(w.roadGrowthDue, undefined, 'road survey must finish');
}

/** Finish queued work without advancing game time or granting another day's budget. */
export function finishRoadGrowth(w: World, end = w.time) {
  const due = Math.max(w.roadGrowthDue ?? 0, Math.floor(end / w.settings.dayLength));
  const deadline = performance.now() + 90000;
  while ((w.roadGrowth ?? 0) < due && performance.now() < deadline) growRoads(w, end, end);
  assert.equal(w.roadGrowth, due, 'queued road work finishes at the unchanged game clock');
}
