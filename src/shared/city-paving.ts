import { growPavedTrunkSteps } from './city-trunks';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { townRoads, roadKey, roadDistance, type Road, type Point } from './town';
import { roadRules } from './road-rules';
import { occupiedCityBuildings } from './city-development';
import { roadProjection, roadJourneyGraphSteps } from './road-journeys';
import { pointDistance, roadComponentSteps, roadSite } from './road-routing';
import { roadGeometryKey, roadGeometryStamp, type RoadWork } from './road-work';
export interface PavedRoad extends Road {
  town: string;
  /** Existing dirt geometry is retained; retirement/editing removes its overlay. */
  source?: string;
  kind: 'urban' | 'trunk';
}
const emptyPavement: readonly PavedRoad[] = [];
const pavementQueries = new WeakMap<
  PavedRoad[],
  {
    roads: readonly Road[];
    stamp: number | undefined;
    sources: (string | undefined)[];
    result: readonly PavedRoad[];
  }
>();
export function effectivePavement(w: World): readonly PavedRoad[] {
  if (!w.pavedRoads?.length) return emptyPavement;
  const roads = townRoads(w),
    stamp = roadGeometryStamp(w.pavedRoads),
    old = pavementQueries.get(w.pavedRoads);
  if (
    old &&
    old.roads === roads &&
    old.stamp === stamp &&
    w.pavedRoads.every((r, i) => r.source === old.sources[i])
  )
    return old.result;
  const sources = new Set(roads.map(roadKey)),
    result = w.pavedRoads.filter((r) => !r.source || sources.has(r.source));
  pavementQueries.set(w.pavedRoads, {
    roads,
    stamp,
    sources: w.pavedRoads.map((r) => r.source),
    result,
  });
  return result;
}
const at = (r: Road, t: number): Point => ({
  x: r.a.x + (r.b.x - r.a.x) * t,
  z: r.a.z + (r.b.z - r.a.z) * t,
});
/** A paved survey never treats a shallow ford as dry land. */
export function pavedWorld(w: World): World {
  return { ...w, settings: { ...w.settings, roadFords: false } };
}
type Candidate = { road: Road; source: string; key: string; town: string; score: number };
function* pavingDay(live: World): RoadWork<void> {
  const w: World = {
    ...live,
    roads: live.roads?.map((r) => ({ ...r, a: { ...r.a }, b: { ...r.b } })),
    pavingProjects: structuredClone(live.pavingProjects),
    pavingFeeders: structuredClone(live.pavingFeeders),
    pavedRoads: live.pavedRoads?.map((r) => ({ ...r, a: { ...r.a }, b: { ...r.b } })),
  };
  const rules = roadRules(w.settings),
    roads = townRoads(w),
    buildings = occupiedCityBuildings(w);
  const eligibility: Record<string, number> = {},
    previous = w.pavingEligibility ?? {};
  const policy = JSON.stringify([
    rules.cityDensityRadius,
    rules.cityDensityBuildings,
    rules.cityDensityDays,
    rules.cityDensitySampleSpacing,
  ]);
  const samePolicy = w.pavingPolicy === policy;
  const sites = new Map<number, ReturnType<typeof roadSite>>();
  const siteFor = (width: number) => {
    if (!sites.has(width)) sites.set(width, roadSite(pavedWorld(w), width));
    return sites.get(width)!;
  };
  // Keep old surface history, but only dry, unobstructed pavement may connect
  // new construction. Cache each geometry within this yielding daily survey.
  const clearance = new Map<string, boolean>();
  function* usablePavement(): RoadWork<PavedRoad[]> {
    const usable: PavedRoad[] = [];
    for (const road of effectivePavement(w)) {
      yield;
      const key = roadKey(road);
      let clear = clearance.get(key);
      if (clear === undefined) {
        clear = yield* siteFor(road.width).segmentSteps(road.a, road.b);
        clearance.set(key, clear);
      }
      if (clear) usable.push(road);
    }
    return usable;
  }
  const density = (p: Point) =>
    buildings.reduce((n, b) => n + (pointDistance(p, b) <= rules.cityDensityRadius ? 1 : 0), 0);
  for (const town of w.towns) {
    yield;
    const city = w.cityDevelopment?.[town.id];
    if (!city || (!city.qualified && !city.eligibleDays)) continue;
    const local = roads.filter((r) => roadDistance([r], town.x, town.z) <= town.radius);
    if (!local.length) continue;
    const seed = local
      .map((r) => ({ r, p: roadProjection(r, town) }))
      .sort((a, b) => pointDistance(a.p, town) - pointDistance(b.p, town))[0];
    const junctions = yield* roadJourneyGraphSteps(local, [town], true);
    const candidates: Candidate[] = [];
    for (const [roadIndex, original] of local.entries()) {
      yield;
      const source = roadKey(original),
        length = pointDistance(original.a, original.b);
      if (length < 1e-6) continue;
      const n = Math.ceil(length / rules.cityDensitySampleSpacing);
      const cuts = [
        ...Array.from({ length: n + 1 }, (_, i) => i / n),
        ...junctions.roadCuts![roadIndex],
      ];
      if (original === seed.r && seed.p.t > 0 && seed.p.t < 1) cuts.push(seed.p.t);
      const dx = original.b.x - original.a.x,
        dz = original.b.z - original.a.z;
      const ox = original.a.x - town.x,
        oz = original.a.z - town.z;
      const aa = dx * dx + dz * dz,
        bb = 2 * (ox * dx + oz * dz),
        cc = ox * ox + oz * oz - town.radius * town.radius;
      const discriminant = bb * bb - 4 * aa * cc;
      if (discriminant >= 0)
        for (const t of [
          (-bb - Math.sqrt(discriminant)) / (2 * aa),
          (-bb + Math.sqrt(discriminant)) / (2 * aa),
        ])
          if (t > 0 && t < 1) cuts.push(t);
      cuts.sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) {
        yield;
        const road = {
          a: at(original, cuts[i - 1]),
          b: at(original, cuts[i]),
          width: original.width,
        };
        if (pointDistance(road.a, road.b) < 1e-6) continue;
        if ([road.a, road.b].some((p) => pointDistance(p, town) > town.radius + 1e-6)) continue;
        const counts = [road.a, at(road, 0.5), road.b].map(density),
          score = Math.min(...counts);
        if (score < rules.cityDensityBuildings) continue;
        const key = `${town.id}:${source}:${cuts[i - 1]}:${cuts[i]}`;
        eligibility[key] = (samePolicy ? (previous[key] ?? 0) : 0) + 1;
        if (eligibility[key] < rules.cityDensityDays) continue;
        candidates.push({
          road,
          source,
          key,
          town: town.id,
          score: score + counts.reduce((a, b) => a + b, 0) / counts.length,
        });
      }
    }
    if (!rules.cityPaving || !city.qualified || rules.cityPavingPerDay <= 0) continue;
    let allowance = rules.cityPavingPerDay;
    const before = yield* roadComponentSteps(yield* usablePavement());
    const urban = before.find((g) => roadDistance(g, seed.p.x, seed.p.z) <= 0) ?? [];
    allowance -= yield* growPavedTrunkSteps(w, town, urban, allowance);
    while (allowance > 1e-6) {
      yield;
      const own = effectivePavement(w);
      const groups = yield* roadComponentSteps(yield* usablePavement());
      const connected = groups.find((g) => roadDistance(g, seed.p.x, seed.p.z) <= 0) ?? [];
      const starts = (p: Point) =>
        pointDistance(p, seed.p) < 1e-6 || roadDistance(connected, p.x, p.z) <= 0;
      const options: { candidate: Candidate; a: Point; b: Point; distance: number }[] = [];
      for (const candidate of candidates) {
        yield;
        const r = candidate.road,
          length = pointDistance(r.a, r.b);
        let intervals: [number, number][] = [[0, 1]];
        for (const paved of own) {
          if (paved.source !== candidate.source) continue;
          const lo = Math.min(roadProjection(r, paved.a).t, roadProjection(r, paved.b).t),
            hi = Math.max(roadProjection(r, paved.a).t, roadProjection(r, paved.b).t);
          if (hi - lo < 1e-9) continue;
          intervals = intervals.flatMap(([a, b]) =>
            hi <= a || lo >= b
              ? [[a, b]]
              : ([...(lo > a ? [[a, lo]] : []), ...(hi < b ? [[hi, b]] : [])] as [
                  number,
                  number,
                ][]),
          );
        }
        for (const [lo, hi] of intervals) {
          const a = at(r, lo),
            b = at(r, hi);
          if (starts(a)) options.push({ candidate, a, b, distance: (hi - lo) * length });
          else if (starts(b)) options.push({ candidate, a: b, b: a, distance: (hi - lo) * length });
        }
      }
      options.sort(
        (a, b) =>
          b.candidate.score - a.candidate.score ||
          pointDistance(a.b, town) - pointDistance(b.b, town),
      );
      let placed = false;
      for (const option of options) {
        const { candidate, a, b, distance } = option,
          used = Math.min(allowance, distance);
        if (used < 1e-6) continue;
        const to = {
          x: a.x + ((b.x - a.x) * used) / distance,
          z: a.z + ((b.z - a.z) * used) / distance,
        };
        if (!(yield* siteFor(candidate.road.width).segmentSteps(a, to))) continue;
        const row: PavedRoad = {
          a,
          b: to,
          width: candidate.road.width,
          source: candidate.source,
          town: town.id,
          kind: 'urban',
        };
        const list = (w.pavedRoads ??= []);
        const old = list.find(
          (r) =>
            r.source === row.source &&
            r.town === row.town &&
            pointDistance(r.b, a) < 1e-6 &&
            Math.abs((r.b.x - r.a.x) * (to.z - a.z) - (r.b.z - r.a.z) * (to.x - a.x)) < 1e-6 &&
            (r.b.x - r.a.x) * (to.x - a.x) + (r.b.z - r.a.z) * (to.z - a.z) > 0,
        );
        if (old) old.b = to;
        else list.push(row);
        allowance -= used;
        placed = true;
        break;
      }
      if (!placed) break;
    }
  }
  live.pavingEligibility = eligibility;
  live.pavingPolicy = policy;
  live.pavedRoads = w.pavedRoads;
  const published = w.roads?.map((road, i) => {
    const old = live.roads?.[i];
    return old &&
      old.width === road.width &&
      old.a.x === road.a.x &&
      old.a.z === road.a.z &&
      old.b.x === road.b.x &&
      old.b.z === road.b.z
      ? old
      : road;
  });
  if (published?.length !== live.roads?.length || published?.some((r, i) => r !== live.roads?.[i]))
    live.roads = published;
  live.pavingProjects = w.pavingProjects;
  live.pavingFeeders = w.pavingFeeders;
}
const jobs = new WeakMap<World, { key: string; work: RoadWork<void> }>();
/** Separate bounded work from dirt-road growth, including worlds that pause dirt. */
export function growCityPavement(w: World, start: number, end: number) {
  if (!(w.settings.dayLength > 0)) return;
  const due = Math.floor(end / w.settings.dayLength);
  if (w.pavingDayLength !== w.settings.dayLength) {
    w.pavingDay = Math.max(Math.floor(start / w.settings.dayLength), due - 1);
    w.pavingDayLength = w.settings.dayLength;
    jobs.delete(w);
  }
  w.pavingDay ??= Math.max(Math.floor(start / w.settings.dayLength), due - 1);
  if (due <= w.pavingDay) {
    delete w.pavingDue;
    return;
  }
  w.pavingDue = due;
  const key =
    roadGeometryKey(w) +
    JSON.stringify([
      w.cityDevelopment,
      w.pavedRoads,
      w.pavingProjects,
      w.pavingFeeders,
      occupiedCityBuildings(w).map((b) => b.id),
    ]);
  let job = jobs.get(w);
  if (job?.key !== key) {
    jobs.delete(w);
    job = undefined;
  }
  const deadline = performance.now() + 4;
  do {
    if (!job) {
      job = { key, work: pavingDay(w) };
      jobs.set(w, job);
    }
    if (job.work.next().done) {
      w.pavingDay++;
      jobs.delete(w);
      job = undefined;
      if (w.pavingDay >= due) {
        delete w.pavingDue;
        break;
      }
    }
  } while (performance.now() < deadline);
}
