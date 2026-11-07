// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { growRoads } from '../src/shared/roads';
import type { World } from '../src/shared/types';
/** Await scheduled construction without advancing the clock or adding allowances. */
export function finishPendingRoadWork(w: World) {
  for (let i = 0; i < 10000 && w.roadGrowthDue !== undefined; i++) growRoads(w, w.time, w.time);
  assert.equal(w.roadGrowthDue, undefined, 'road survey must finish');
}
