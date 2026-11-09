// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types';
import type { Trailer } from './trailers';
import { automotiveConfig } from './automotive-config';
import { HIGHWAY_TRACTOR, semitrailerDefinition, isSemitrailer } from './highway-definitions';
import {
  rectanglesOverlap,
  vehicleFootprint,
  trailerFootprint,
  type GroundRect,
} from './vehicle-footprint';
import { bridgeRectBlocked } from './bridge-geometry';
import { buildingPlan } from './building-shapes';
import { sceneryObstaclesNear } from './scenery-obstacles';
import { obstacleRules } from './obstacle-rules';
import { offlineGroundObstacle, onSolidGround } from './ground-contacts';
import { vehicleDef } from './vehicle-config';
import { travelHeight } from './dock';
import { surfaceWaterLevel } from './ocean';
import { roadRules } from './road-rules';
import { mapHalf, terrainHeight } from './terrain';
import { barrierSegments, scatterObjects } from './landscape';
import { pastureFences } from './pasture-land';
import { spaceportFences, spaceportStructureFences } from './spaceport-site';
export type RoadPose = { x: number; z: number; heading: number };
export const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function fifthWheel(w: World, p: RoadPose) {
  const z = automotiveConfig(w).coupling.fifthWheelZ;
  return { x: p.x + Math.sin(p.heading) * z, z: p.z + Math.cos(p.heading) * z };
}
export function kingpin(w: World, t: Trailer) {
  if (!isSemitrailer(t.kind)) throw Error('Choose a semitrailer');
  const z = semitrailerDefinition(t.kind, w).length / 2 - automotiveConfig(w).coupling.kingpinInset;
  return { x: t.x + Math.sin(t.heading) * z, z: t.z + Math.cos(t.heading) * z };
}
export function semitrailerPose(w: World, t: Trailer, from: RoadPose, to: RoadPose): RoadPose {
  if (!isSemitrailer(t.kind)) return t;
  const d = semitrailerDefinition(t.kind, w),
    rules = automotiveConfig(w).coupling;
  const arm = d.length / 2 - rules.kingpinInset,
    wheelbase = d.length - rules.kingpinInset - rules.axleRearInset;
  const turn = angleDifference(to.heading, from.heading),
    distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(
    1,
    Math.ceil((distance + Math.abs(turn) * Math.abs(rules.fifthWheelZ)) / 0.2),
  );
  let heading = t.heading,
    previous = fifthWheel(w, from);
  for (let i = 1; i <= steps; i++) {
    const f = i / steps,
      hitch = fifthWheel(w, {
        x: from.x + (to.x - from.x) * f,
        z: from.z + (to.z - from.z) * f,
        heading: from.heading + turn * f,
      });
    const dx = hitch.x - previous.x,
      dz = hitch.z - previous.z;
    const rate = (h: number) => (dx * Math.cos(h) - dz * Math.sin(h)) / wheelbase;
    heading += rate(heading + rate(heading) / 2);
    previous = hitch;
  }
  return {
    x: previous.x - Math.sin(heading) * arm,
    z: previous.z - Math.cos(heading) * arm,
    heading,
  };
}
export function rectAt(at: RoadPose, length: number, width: number): GroundRect {
  return {
    x: at.x,
    z: at.z,
    hx: width / 2,
    hz: length / 2,
    axes: [
      { x: Math.cos(at.heading), z: -Math.sin(at.heading) },
      { x: Math.sin(at.heading), z: Math.cos(at.heading) },
    ],
  };
}
/** Cab shell includes the grille ahead of the bumper, not the low rear chassis. */
export function highwayCabRect(w: World, pose: RoadPose) {
  const v = vehicleDef(w, HIGHWAY_TRACTOR),
    rear = v.length! * 0.06 - 0.06,
    front = v.length! / 2 + 0.05,
    centre = (front + rear) / 2;
  return rectAt(
    {
      x: pose.x + Math.sin(pose.heading) * centre,
      z: pose.z + Math.cos(pose.heading) * centre,
      heading: pose.heading,
    },
    front - rear,
    v.width!,
  );
}
export function* bodySamples(rect: GroundRect, spacing = 1) {
  const count = Math.ceil((rect.hz * 2) / spacing);
  for (let i = 0; i <= count; i++)
    for (const x of [-rect.hx, 0, rect.hx]) {
      const z = -rect.hz + (rect.hz * 2 * i) / count;
      yield {
        x: rect.x + x * rect.axes[0].x + z * rect.axes[1].x,
        z: rect.z + x * rect.axes[0].z + z * rect.axes[1].z,
      };
    }
}
const circleTouches = (rect: GroundRect, o: { x: number; z: number; radius: number }) => {
  const dx = o.x - rect.x,
    dz = o.z - rect.z;
  return (
    Math.hypot(
      Math.max(0, Math.abs(dx * rect.axes[0].x + dz * rect.axes[0].z) - rect.hx),
      Math.max(0, Math.abs(dx * rect.axes[1].x + dz * rect.axes[1].z) - rect.hz),
    ) < o.radius
  );
};
/** Bound rotational and translational advances by 0.35 m; test the entire body at every step. */
export function clearHighwayBody(
  w: World,
  from: RoadPose,
  to: RoadPose,
  length: number,
  width: number,
  height: number,
  driver: string,
  exceptTrailer?: string,
  player?: Player,
) {
  const a = rectAt(from, length, width),
    b = rectAt(to, length, width),
    radius = Math.hypot(length, width) / 2;
  if (bridgeRectBlocked(w, a, b, player)) return false;
  const turn = angleDifference(to.heading, from.heading),
    distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil((distance + Math.abs(turn) * radius) / 0.35));
  if (steps > 256) return false;
  const driving = automotiveConfig(w).driving;
  const rules = obstacleRules(w.settings),
    trees = sceneryObstaclesNear(w, from, to, radius);
  const props = [...(w.creator?.objects ?? []), ...scatterObjects(w)]
    .filter((o) => o.visible && o.solid)
    .map((o) => ({
      ...o,
      radius: o.radius * o.scale,
      y: terrainHeight(w, o.x, o.z) + o.y,
      height: (w.creator?.models.find((m) => m.id === o.model)?.height ?? 4) * o.scale,
    }));
  const fences = [
    ...barrierSegments(w),
    ...pastureFences(w.buildings),
    ...spaceportFences(w, from, to, radius),
    ...spaceportStructureFences(w, from, to, radius),
  ]
    .filter(
      (f) =>
        Math.max(from.x, to.x) + radius + f.width >= Math.min(f.a.x, f.b.x) &&
        Math.min(from.x, to.x) - radius - f.width <= Math.max(f.a.x, f.b.x) &&
        Math.max(from.z, to.z) + radius + f.width >= Math.min(f.a.z, f.b.z) &&
        Math.min(from.z, to.z) - radius - f.width <= Math.max(f.a.z, f.b.z),
    )
    .map((f) => {
      const x = (f.a.x + f.b.x) / 2,
        z = (f.a.z + f.b.z) / 2;
      return {
        rect: rectAt(
          { x, z, heading: Math.atan2(f.b.x - f.a.x, f.b.z - f.a.z) },
          Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z),
          f.width,
        ),
        y: terrainHeight(w, x, z),
        height: f.height,
      };
    });
  const otherVehicles =
    rules.vehicleCollision === 'off'
      ? []
      : [
          ...Object.values(w.players)
            .filter(
              (p) =>
                p.id !== driver &&
                onSolidGround(w, p) &&
                (p.online || offlineGroundObstacle(w, p)) &&
                (rules.pedestrianBlocking || vehicleDef(w, p.vehicle).mode !== 8),
            )
            .map((p) => vehicleFootprint(w, p.vehicle, p)),
          ...Object.entries(w.parkedVehicles ?? {})
            .filter(([key, v]) => !v.inside && key !== `${driver}:${HIGHWAY_TRACTOR}`)
            .map(([, v]) => vehicleFootprint(w, v.slot, v)),
        ];
  const otherTrailers = Object.values(w.trailers ?? {})
    .filter(
      (t) => t.id !== exceptTrailer && !(t.parkedWith && w.parkedVehicles?.[t.parkedWith]?.inside),
    )
    .map((t) => ({ trailer: t, rect: trailerFootprint(t, w) }));
  const buildings = w.buildings
    .filter((site) => Math.hypot(site.x - from.x, site.z - from.z) < radius + distance + 100)
    .flatMap((site) => {
      const c = Math.cos(site.rotation),
        s = Math.sin(site.rotation),
        plan = buildingPlan(site);
      return [...plan.volumes, ...(plan.fixtures ?? [])].map((v) => ({
        x: site.x + v.x * c + v.z * s,
        z: site.z - v.x * s + v.z * c,
        hx: v.width / 2,
        hz: v.depth / 2,
        axes: [
          { x: c, z: -s },
          { x: s, z: c },
        ],
      }));
    });
  for (let i = 1; i <= steps; i++) {
    const f = i / steps,
      pose = {
        x: from.x + (to.x - from.x) * f,
        z: from.z + (to.z - from.z) * f,
        heading: from.heading + turn * f,
      },
      rect = rectAt(pose, length, width);
    if ([...buildings, ...otherVehicles].some((o) => rectanglesOverlap(rect, o))) return false;
    for (const { trailer, rect: trailerRect } of otherTrailers) {
      if (!rectanglesOverlap(rect, trailerRect)) continue;
      // A compatible rear chassis can slide under the raised nose. The cab and
      // the trailer behind its landing supports retain their solid footprints.
      if (
        !player ||
        player.vehicle !== HIGHWAY_TRACTOR ||
        trailer.owner !== driver ||
        trailer.attached ||
        !isSemitrailer(trailer.kind) ||
        Math.abs(angleDifference(pose.heading, trailer.heading)) >
          (automotiveConfig(w).driving.hitchAlignment * Math.PI) / 180
      )
        return false;
      const cab = highwayCabRect(w, pose);
      const d = semitrailerDefinition(trailer.kind, w);
      const supportFront = d.length * 0.22 + 0.2;
      const solidLength = d.length / 2 + supportFront;
      const solidCentre = (supportFront - d.length / 2) / 2;
      const solidRear = rectAt(
        {
          x: trailer.x + Math.sin(trailer.heading) * solidCentre,
          z: trailer.z + Math.cos(trailer.heading) * solidCentre,
          heading: trailer.heading,
        },
        solidLength,
        d.width,
      );
      if (rectanglesOverlap(cab, trailerRect) || rectanglesOverlap(rect, solidRear)) return false;
    }
    const centre = travelHeight(w, pose.x, pose.z);
    if (
      [...trees, ...props].some(
        (o) => centre + height > o.y && centre < o.y + o.height && circleTouches(rect, o),
      )
    )
      return false;
    if (
      fences.some(
        (f) => centre + height > f.y && centre < f.y + f.height && rectanglesOverlap(rect, f.rect),
      )
    )
      return false;
    for (const q of bodySamples(rect)) {
      if (Math.abs(q.x) >= mapHalf(w) || Math.abs(q.z) >= mapHalf(w)) return false;
      const y = travelHeight(w, q.x, q.z);
      if (surfaceWaterLevel(w, q.x, q.z) - y > roadRules(w.settings).groundWaterDepth) return false;
      if (
        Math.abs(y - centre) >
        Math.hypot(q.x - pose.x, q.z - pose.z) * driving.maximumTerrainGrade +
          driving.suspensionTravel
      )
        return false;
    }
  }
  return true;
}
