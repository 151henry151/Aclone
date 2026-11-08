// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Bridge } from './bridge-types';
import { roadGeometryKey, type RoadWork } from './road-work';
import { roadSite } from './road-routing';
import { bridgeRampHeight, BRIDGE_RAIL_WIDTH, bridgeReservedFootprint } from './bridge-geometry';
import { terrainHeight } from './terrain';
import { inlandLevel } from './inland-water';
import { highWater } from './ocean';

/** Recheck the saved surface, never replace it using today's design prices or dimensions. */
export function* inspectBridgeSteps(w: World, b: Bridge): RoadWork<void> {
  const rect = bridgeReservedFootprint(b),
    span = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
  const axis = rect.axes[1],
    cross = rect.axes[0],
    sea = highWater(w);
  const columns = Math.ceil((b.width + 2 * BRIDGE_RAIL_WIDTH) / 2) * 2;
  const sample = (along: number, side: number) => ({
    x: b.a.x + axis.x * along + cross.x * side,
    z: b.a.z + axis.z * along + cross.z * side,
  });
  for (let i = 0; i <= Math.ceil(span); i++) {
    yield;
    for (let j = 0; j <= columns; j++) {
      const p = sample((span * i) / Math.ceil(span), (j / columns - 0.5) * rect.hx * 2);
      if (inlandLevel(w, p.x, p.z, sea) > b.highWater + 1e-6)
        throw Error('High water exceeds the surveyed bridge level');
      if (terrainHeight(w, p.x, p.z) > b.deckY + 1e-6)
        throw Error('Changed ground obstructs the bridge deck');
    }
  }
  for (const end of [0, 1] as const) {
    const seats = Math.ceil(b.foundationLength);
    for (let i = 0; i <= seats; i++) {
      yield;
      const distance = (b.foundationLength * i) / seats;
      for (let j = 0; j <= columns; j++) {
        const p = sample(
          end === 0 ? -distance : span + distance,
          (j / columns - 0.5) * rect.hx * 2,
        );
        if (terrainHeight(w, p.x, p.z) < b.foundations[end] - 1e-6)
          throw Error('Changed ground undercuts the saved bridge foundation');
      }
    }
    const length = b.ramps[end].rows.at(-1)!.distance;
    for (let distance = 0; distance <= length; distance++) {
      yield;
      for (let j = 0; j <= columns; j++) {
        const side = (j / columns - 0.5) * rect.hx * 2,
          p = sample(end === 0 ? -distance : span + distance, side);
        const ground = terrainHeight(w, p.x, p.z),
          top = bridgeRampHeight(b, end, distance, side);
        if (ground <= inlandLevel(w, p.x, p.z, sea))
          throw Error('Bridge approach is no longer dry at high water');
        if (ground > top + 1e-6 || (distance === length && Math.abs(ground - top) > 1e-6))
          throw Error('Changed ground no longer meets the saved bridge approach');
      }
    }
  }
  if (
    !(yield* roadSite(w, b.width + 2 * BRIDGE_RAIL_WIDTH).unobstructedSteps(
      b.approachA,
      b.approachB,
    ))
  )
    throw Error('The bridge footprint or approach is obstructed');
}
type Job = { bridge: Bridge; steps: RoadWork<void> };
const inspections = new WeakMap<World, { key: string; jobs: Job[]; known: Set<Bridge> }>();
function close(b: Bridge, reason?: string) {
  if (b.closure === reason) return;
  b.closure = reason;
  b.revision++;
}
/** Geometry edits and restarts close entry while bounded background work checks safety. */
export function advanceBridgeInspections(w: World, surveyed?: Bridge) {
  if (!w.bridges?.length) {
    inspections.delete(w);
    return;
  }
  // Access/condition/inspection state do not alter the physical safety of a saved deck.
  const key = roadGeometryKey({ ...w, bridges: undefined });
  let state = inspections.get(w);
  if (!state || state.key !== key) {
    state = { key, jobs: [], known: new Set() };
    inspections.set(w, state);
  }
  state.jobs = state.jobs.filter((job) => w.bridges!.includes(job.bridge));
  for (const bridge of w.bridges) {
    if (state.known.has(bridge)) continue;
    state.known.add(bridge);
    if (bridge === surveyed) continue;
    close(bridge, 'Checking bridge safety');
    state.jobs.push({ bridge, steps: inspectBridgeSteps(w, bridge) });
  }
  const deadline = performance.now() + 4;
  while (state.jobs.length && performance.now() < deadline) {
    const job = state.jobs.shift()!;
    try {
      if (job.steps.next().done) close(job.bridge);
      else state.jobs.push(job);
    } catch (error) {
      close(job.bridge, error instanceof Error ? error.message : 'Bridge safety check failed');
    }
  }
}
