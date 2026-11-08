// SPDX-License-Identifier: GPL-3.0-or-later
import { riverCities } from './city-river';
import { riverBanks } from '../../src/shared/inland-water';
export function bridgeSite() {
  const { w } = riverCities();
  const r = w.northernIsland!.rivers[0],
    p = r.points[220],
    bank = riverBanks(r.points)[220];
  const dx = (bank.right.x - bank.left.x) / p.width,
    dz = (bank.right.z - bank.left.z) / p.width;
  const point = (distance: number, side = 0) => ({
    x: p.x + dx * distance - dz * side,
    z: p.z + dz * distance + dx * side,
  });
  return { w, point, a: point(-20), b: point(20), level: p.level };
}

import { finishRoadWork } from '../../src/shared/road-work';
import { surveyBridgeSteps } from '../../src/shared/bridge-survey';
import type { Bridge } from '../../src/shared/bridge-types';
export function completedBridgeSite() {
  const fixture = bridgeSite(),
    { w, a, b } = fixture;
  const plan = finishRoadWork(surveyBridgeSteps(w, 'owner', a, b, 'wide'));
  const bridge: Bridge = {
    ...plan,
    id: 'bridge:1',
    owner: 'owner',
    foundedAt: w.time,
    completedAt: w.time,
    condition: 100,
    wearAt: w.time,
    revision: 1,
    paid: structuredClone(plan.bill),
    contributors: { owner: structuredClone(plan.bill) },
  };
  w.bridges = [bridge];
  return { ...fixture, bridge };
}
