import {
  BRIDGE_RAIL_WIDTH,
  bridgeReservedFootprint,
  bridgeSiteVehicleBlocked,
} from './bridge-geometry';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Settings, World } from './types';
import type { Point } from './town';
import type { BridgeBill, BridgePlan, BridgeRamp } from './bridge-types';
import { bridgeRules } from './bridge-rules';
import { inlandLevel, inlandWaterAt } from './inland-water';
import { terrainHeight, mapHalf } from './terrain';
import { highWater } from './ocean';
import { pointDistance, roadSite } from './road-routing';
import type { RoadWork } from './road-work';
import { townRefusal } from './town-charter';
import { spawnReserved } from './spawn-reserve';
import { spaceportReserved } from './spaceport-site';
import { rectanglesOverlap } from './vehicle-footprint';

type BillShape = Pick<BridgePlan, 'a' | 'b' | 'approachA' | 'approachB' | 'width'>;
/** Tolerate coordinate subtraction roundoff at exact metre boundaries. */
const up = (v: number) => Math.max(0, Math.ceil(v - 1e-7));
const metres = (a: Point, b: Point) => Math.round(pointDistance(a, b) * 1e9) / 1e9;
export function bridgeBill(settings: Partial<Settings>, plan: BillShape): BridgeBill {
  const r = bridgeRules(settings),
    area = metres(plan.a, plan.b) * plan.width;
  const approaches = metres(plan.a, plan.approachA) + metres(plan.b, plan.approachB);
  return {
    cash: up(area * r.bridgeCashPerSquareMetre + approaches * r.bridgeApproachCashPerMetre),
    materials: {
      steel: up(area * r.bridgeSteelPerSquareMetre),
      wood: up(area * r.bridgeWoodPerSquareMetre),
      gravel: up(area * r.bridgeGravelPerSquareMetre + approaches * r.bridgeApproachGravelPerMetre),
      stone: up(area * r.bridgeStonePerSquareMetre + approaches * r.bridgeApproachStonePerMetre),
    },
  };
}

/** Exhaustive strip survey is yielded so a multiplayer tick never performs it all at once. */
export function* surveyBridgeSteps(
  w: World,
  player: string,
  a: Point,
  b: Point,
  design: 'narrow' | 'wide',
): RoadWork<BridgePlan> {
  const r = bridgeRules(w.settings);
  if (!r.bridgeBuilding) throw Error('Bridge construction is disabled in this world');
  if (![a?.x, a?.z, b?.x, b?.z].every(Number.isFinite))
    throw Error('Choose two finite bank positions');
  if (design !== 'narrow' && design !== 'wide') throw Error('Choose a single- or two-lane bridge');
  const length = pointDistance(a, b),
    width = design === 'narrow' ? r.bridgeNarrowWidth : r.bridgeWidth;
  if (length < r.bridgeFoundationLength * 2 || length > r.bridgeMaximumSpan)
    throw Error('Bridge span is outside the allowed length');
  const dx = (b.x - a.x) / length,
    dz = (b.z - a.z) / length;
  const point = (along: number, side = 0): Point => ({
    x: a.x + dx * along + dz * side,
    z: a.z + dz * along - dx * side,
  });
  const surveyedWidth = width + BRIDGE_RAIL_WIDTH * 2;
  const columns = Math.ceil(surveyedWidth / 2) * 2,
    sides = Array.from({ length: columns + 1 }, (_, i) => (i / columns - 0.5) * surveyedWidth);
  const site = roadSite(w, surveyedWidth),
    sea = highWater(w),
    half = mapHalf(w);
  const height = (p: Point) => terrainHeight(w, p.x, p.z);
  const dry = (p: Point) => height(p) > inlandLevel(w, p.x, p.z, sea);
  const permitted = (p: Point) => {
    if (Math.abs(p.x) > half || Math.abs(p.z) > half)
      throw Error('Bridge footprint crosses the world boundary');
    const refusal =
      townRefusal(w, player, p.x, p.z, 'build') ?? townRefusal(w, player, p.x, p.z, 'roads');
    if (refusal) throw Error(refusal);
    if (w.zones.some((z) => z.kind === 'noBuild' && Math.hypot(p.x - z.x, p.z - z.z) <= z.radius))
      throw Error('Bridge construction is prohibited in this zone');
    if (spawnReserved(w, p.x, p.z) || spaceportReserved(w, p.x, p.z))
      throw Error('Bridge footprint obstructs a protected public site');
  };
  let bankHigh = -Infinity;
  const foundations: number[] = [];
  for (const bank of [0, length]) {
    let low = Infinity,
      high = -Infinity;
    const n = Math.ceil(r.bridgeFoundationLength);
    for (let i = 0; i <= n; i++) {
      yield;
      const along = bank + ((bank === 0 ? -1 : 1) * r.bridgeFoundationLength * i) / n;
      for (const side of sides) {
        const p = point(along, side);
        permitted(p);
        if (!dry(p)) throw Error('Both full-width bank foundations must be dry at high water');
        const h = height(p);
        low = Math.min(low, h);
        high = Math.max(high, h);
      }
    }
    if (high - low > r.bridgeFoundationRise)
      throw Error('Bank foundation rises too steeply across its seat');
    bankHigh = Math.max(bankHigh, high);
    foundations.push(low);
  }
  let river: string | undefined,
    waterHigh = -Infinity;
  const n = Math.ceil(length);
  for (let i = 0; i <= n; i++) {
    yield;
    for (const side of sides) {
      const p = point((length * i) / n, side);
      permitted(p);
      const water = inlandWaterAt(w, p.x, p.z);
      if (water) {
        if (!water.river || (river && river !== water.river))
          throw Error('Survey one river crossing at a time');
        river = water.river;
        waterHigh = Math.max(waterHigh, inlandLevel(w, p.x, p.z, sea));
      }
    }
  }
  if (!river) throw Error('Choose opposite banks of a river');
  const deckY = Math.max(bankHigh, waterHigh + r.bridgeClearance + r.bridgeDeckThickness);
  const approaches: Point[] = [];
  const ramps: BridgeRamp[] = [];
  for (const bank of [0, length]) {
    const direction = bank === 0 ? -1 : 1;
    const rows: BridgeRamp['rows'] = [{ distance: 0, heights: sides.map(() => deckY) }];
    let toe: Point | undefined,
      previous = sides.map(() => deckY);
    for (let distance = 1; distance <= r.bridgeApproachLength; distance++) {
      yield;
      let joined = true;
      for (let j = 0; j < sides.length; j++) {
        const p = point(bank + direction * distance, sides[j]);
        permitted(p);
        if (!dry(p)) throw Error('Bridge approaches must remain on dry land');
        const h = height(p),
          ramp = deckY - r.bridgeMaximumGrade * distance,
          top = Math.max(h, ramp);
        if (Math.abs(top - previous[j]) > r.bridgeMaximumGrade + 1e-6)
          throw Error('Bridge approach exceeds the safe grade');
        previous[j] = top;
        joined &&= h >= ramp;
      }
      rows.push({ distance, heights: previous.slice() });
      if (joined && distance >= r.bridgeFoundationLength) {
        toe = point(bank + direction * distance);
        break;
      }
    }
    if (!toe) throw Error('No safe approach fits within the maximum approach length');
    approaches.push(toe);
    // Long planar sections need only endpoints; retain every terrain-shaped row.
    ramps.push({
      rows: rows.filter(
        (row, i) =>
          i === 0 ||
          i === rows.length - 1 ||
          row.heights.some(
            (h, j) => Math.abs(h - (rows[i - 1].heights[j] + rows[i + 1].heights[j]) / 2) > 1e-8,
          ),
      ),
    });
  }
  const [approachA, approachB] = approaches;
  if (!(yield* site.unobstructedSteps(approachA, approachB)))
    throw Error('Bridge footprint or approach is obstructed');
  const plan = {
    a: { ...a },
    b: { ...b },
    approachA,
    approachB,
    width,
    deckY,
    thickness: r.bridgeDeckThickness,
    grade: r.bridgeMaximumGrade,
    ramps: ramps as [BridgeRamp, BridgeRamp],
    foundationLength: r.bridgeFoundationLength,
    foundations: foundations as [number, number],
    river,
    highWater: waterHigh,
  };
  const result = { ...plan, bill: bridgeBill(w.settings, plan) };
  if (bridgeSiteVehicleBlocked(w, result))
    throw Error('Move parked vehicles, trailers and moored boats clear of the bridge footprint');
  const permission = bridgePermissionReason(w, player, result);
  if (permission) throw Error(permission);
  const footprint = bridgeReservedFootprint(result);
  for (const zone of w.zones.filter((z) => z.kind === 'noBuild')) {
    const x = zone.x - footprint.x,
      z = zone.z - footprint.z;
    const across = Math.max(0, Math.abs(x * dz - z * dx) - footprint.hx);
    const along = Math.max(0, Math.abs(x * dx + z * dz) - footprint.hz);
    if (Math.hypot(across, along) <= zone.radius)
      throw Error('Bridge construction is prohibited in this zone');
  }
  for (const road of w.roads ?? []) {
    yield;
    const length = pointDistance(road.a, road.b);
    if (!length) continue;
    const x = (road.b.x - road.a.x) / length,
      z = (road.b.z - road.a.z) / length;
    if (
      rectanglesOverlap(
        { ...footprint, hz: Math.max(0, footprint.hz - 1e-6) },
        {
          x: (road.a.x + road.b.x) / 2,
          z: (road.a.z + road.b.z) / 2,
          hx: road.width / 2,
          hz: length / 2,
          axes: [
            { x: z, z: -x },
            { x, z },
          ],
        },
      )
    )
      throw Error('Keep the bridge and ramps clear of established roads, including ford routes');
  }
  return result;
}

export function bridgePermissionReason(w: World, player: string, plan: BridgePlan) {
  const rect = bridgeReservedFootprint(plan);
  for (const town of w.towns) {
    const dx = town.x - rect.x,
      dz = town.z - rect.z;
    const x = Math.max(0, Math.abs(dx * rect.axes[0].x + dz * rect.axes[0].z) - rect.hx);
    const z = Math.max(0, Math.abs(dx * rect.axes[1].x + dz * rect.axes[1].z) - rect.hz);
    if (Math.hypot(x, z) > town.radius) continue;
    const reason =
      townRefusal(w, player, town.x, town.z, 'build', town) ??
      townRefusal(w, player, town.x, town.z, 'roads', town);
    if (reason) return reason;
  }
}
