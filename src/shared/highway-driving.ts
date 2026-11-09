// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Input } from './types';
import { automotiveConfig } from './automotive-config';
import { HIGHWAY_TRACTOR, isSemitrailer, semitrailerDefinition } from './highway-definitions';
import { vehicleDef } from './vehicle-config';
import { movementTrailer, trailerLoad } from './trailers';
import { effectivePavement } from './city-paving';
import { roadDistance, townRoads, type Road } from './town';
import {
  bodySamples,
  rectAt,
  semitrailerPose,
  angleDifference,
  clearHighwayBody,
  highwayCabRect,
  type RoadPose,
} from './highway-geometry';
import { roadConditions } from './environment';
import { rectanglesOverlap } from './vehicle-footprint';
import { slopeSpeed } from './driving-surface';

/** One nearby-road selection per classification, never a full-road scan per footprint sample. */
function nearby(roads: readonly Road[], p: RoadPose, reach: number) {
  return roads.filter(
    (r) =>
      p.x + reach >= Math.min(r.a.x, r.b.x) - r.width / 2 &&
      p.x - reach <= Math.max(r.a.x, r.b.x) + r.width / 2 &&
      p.z + reach >= Math.min(r.a.z, r.b.z) - r.width / 2 &&
      p.z - reach <= Math.max(r.a.z, r.b.z) + r.width / 2,
  );
}
export function highwaySurface(w: World, p: Player, to?: RoadPose, prediction = false) {
  const v = vehicleDef(w, HIGHWAY_TRACTOR),
    r = automotiveConfig(w).driving,
    t = movementTrailer(w, p, prediction);
  const trailer = t && isSemitrailer(t.kind) ? t : undefined;
  const d =
    trailer && semitrailerDefinition(trailer.kind as import('./highway-definitions').SemiKind, w);
  const distance = to ? Math.hypot(to.x - p.x, to.z - p.z) : 0,
    reach = (v.length ?? 0) + (d?.length ?? 0) + distance;
  const paved = nearby(effectivePavement(w), p, reach),
    dirt = nearby(townRoads(w), p, reach);
  let onPaved = true,
    onRoad = true;
  const steps = to
    ? Math.max(
        1,
        Math.ceil((distance + Math.abs(angleDifference(to.heading, p.heading)) * reach) / 0.5),
      )
    : 0;
  for (let i = 0; i <= steps; i++) {
    const f = steps ? i / steps : 0,
      pose = to
        ? {
            x: p.x + (to.x - p.x) * f,
            z: p.z + (to.z - p.z) * f,
            heading: p.heading + angleDifference(to.heading, p.heading) * f,
          }
        : p;
    const bodies = [rectAt(pose, v.length!, v.width!)];
    if (trailer && d)
      bodies.push(
        rectAt(i === 0 ? trailer : semitrailerPose(w, trailer, p, pose), d.length, d.width),
      );
    for (const body of bodies)
      for (const point of bodySamples(body)) {
        if (onPaved && roadDistance(paved, point.x, point.z) > 1e-6) onPaved = false;
        if (onRoad && roadDistance(dirt, point.x, point.z) > 1e-6) onRoad = false;
        if (!onPaved && !onRoad)
          return { kind: 'field' as const, speed: Math.min(v.speed, r.offRoadSpeed) };
      }
  }
  return onPaved
    ? { kind: 'paved' as const, speed: v.speed }
    : { kind: 'dirt' as const, speed: Math.min(v.speed, r.dirtSpeed) };
}
export function highwayControls(
  w: World,
  p: Player,
  input: Input,
  dt: number,
  grade: number,
  condition: number,
  powered: boolean,
  prediction = false,
) {
  const v = vehicleDef(w, HIGHWAY_TRACTOR),
    r = automotiveConfig(w).driving,
    weather = roadConditions(w);
  const throttle = Math.max(-1, Math.min(1, input.throttle)),
    load = Math.min(1, Math.max(0, trailerLoad(w, p)));
  const sign = Math.sign(p.speed),
    braking = !!input.brake || (sign !== 0 && throttle !== 0 && Math.sign(throttle) !== sign);
  if (braking) p.speed = sign * Math.max(0, Math.abs(p.speed) - r.braking * weather.grip * dt);
  else if (!throttle || !powered)
    p.speed =
      sign * Math.max(0, Math.abs(p.speed) - (r.coasting + Math.abs(p.speed) * r.rollingDrag) * dt);
  else
    p.speed +=
      (throttle *
        v.acceleration *
        (1 - load * (1 - r.loadedAcceleration)) *
        weather.grip *
        slopeSpeed(grade * Math.sign(throttle)) -
        p.speed * r.rollingDrag) *
      dt;
  const cap =
    highwaySurface(w, p, undefined, prediction).speed *
    weather.speed *
    (0.7 + condition * 0.003) *
    Math.min(1, slopeSpeed(grade * Math.sign(p.speed)));
  p.speed = Math.max(-Math.min(cap, r.reverseSpeed), Math.min(cap, p.speed));
  const steer = Math.max(-1, Math.min(1, input.steer)),
    yaw = Math.min(
      Math.abs(p.speed) / r.minimumTurnRadius,
      r.lateralAcceleration / Math.max(0.1, Math.abs(p.speed)),
      v.turn,
    );
  p.heading += steer * Math.sign(p.speed) * yaw * weather.grip * dt;
}
export function clearHighwayRig(
  w: World,
  p: Player,
  from: RoadPose,
  to: RoadPose,
  prediction = false,
) {
  const v = vehicleDef(w, HIGHWAY_TRACTOR),
    t = movementTrailer(w, p, prediction);
  if (!clearHighwayBody(w, from, to, v.length!, v.width!, v.height!, p.id, t?.id, p)) return false;
  if (t && isSemitrailer(t.kind)) {
    const next = semitrailerPose(w, t, from, to),
      d = semitrailerDefinition(t.kind, w);
    if (
      Math.abs(angleDifference(next.heading, to.heading)) >
      (automotiveConfig(w).driving.maximumArticulation * Math.PI) / 180
    )
      return false;
    // Check the joint's swept motion too: a legal world coupling position can
    // bring the trailer nose into the cab before reaching the articulation limit.
    const turn = angleDifference(to.heading, from.heading);
    const steps = Math.max(
      1,
      Math.ceil((Math.hypot(to.x - from.x, to.z - from.z) + Math.abs(turn) * d.length) / 0.35),
    );
    if (steps > 256) return false;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps,
        pose = {
          x: from.x + (to.x - from.x) * f,
          z: from.z + (to.z - from.z) * f,
          heading: from.heading + turn * f,
        };
      const semi = i === steps ? next : semitrailerPose(w, t, from, pose);
      if (rectanglesOverlap(highwayCabRect(w, pose), rectAt(semi, d.length, d.width))) return false;
    }
    if (!clearHighwayBody(w, t, next, d.length, d.width, d.height, p.id, t.id)) return false;
  }
  return true;
}
