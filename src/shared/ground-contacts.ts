import { vehicleFootprint } from './vehicle-footprint';
import { parkingRules } from './parking-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from './types';
import type { Point } from './town';
import { vehicleDef } from './vehicle-config';
import { travelHeight } from './dock';
import { obstacleRules } from './obstacle-rules';
import { finishRoadWork, type RoadWork } from './road-work';
import { sceneryObstaclesNear, sceneryObstaclesNearSteps } from './scenery-obstacles';

const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z;
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, z: a.z - b.z });
type Contact = { t: number; normal: Point };
/** Continuous circle sweep, including an outward escape from a saved overlap. */
export function circleContact(
  a: Point,
  b: Point,
  centre: Point,
  radius: number,
): Contact | undefined {
  const d = subtract(b, a),
    q = subtract(a, centre),
    length2 = dot(d, d),
    distance2 = dot(q, q);
  if (length2 < 1e-12) return;
  if (distance2 < radius * radius) {
    if (dot(q, d) >= 0) return;
    const length = Math.sqrt(distance2);
    return { t: 0, normal: { x: q.x / length, z: q.z / length } };
  }
  const approach = dot(q, d),
    discriminant = approach * approach - length2 * (distance2 - radius * radius);
  if (approach >= 0 || discriminant < 0) return;
  const t = (-approach - Math.sqrt(discriminant)) / length2;
  if (t < 0 || t > 1) return;
  return { t, normal: { x: (q.x + d.x * t) / radius, z: (q.z + d.z * t) / radius } };
}
export function sceneryBlocksSegment(w: World, a: Point, b: Point, radius: number, escape = false) {
  return finishRoadWork(sceneryBlocksSegmentSteps(w, a, b, radius, escape));
}
export function* sceneryBlocksSegmentSteps(
  w: World,
  a: Point,
  b: Point,
  radius: number,
  escape = false,
): RoadWork<boolean> {
  return (yield* sceneryObstaclesNearSteps(w, a, b, radius)).some(
    (o) =>
      (!escape && Math.hypot(a.x - o.x, a.z - o.z) < o.radius + radius) ||
      !!circleContact(a, b, o, o.radius + radius),
  );
}
function slide(a: Point, b: Point, hit: Contact): Point {
  const d = subtract(b, a),
    t = Math.max(0, hit.t - 1e-5),
    inward = Math.min(0, dot(d, hit.normal));
  return { x: b.x - hit.normal.x * inward * (1 - t), z: b.z - hit.normal.z * inward * (1 - t) };
}
export function sceneryContact(w: World, p: Player, to: Point): { point: Point; stopped: boolean } {
  const v = vehicleDef(w, p.vehicle),
    walking = v.mode === 8,
    radius = v.collisionRadius ?? (walking ? 0.25 : 1.3);
  const saved = p.sceneryStop;
  const locked =
    !walking && saved && saved.x === p.x && saved.z === p.z && saved.vehicle === p.vehicle;
  const distance = Math.hypot(to.x - p.x, to.z - p.z);
  const reach = locked ? Math.max(distance, saved.reach) : distance;
  const probe =
    distance > 0
      ? { x: p.x + ((to.x - p.x) * reach) / distance, z: p.z + ((to.z - p.z) * reach) / distance }
      : to;
  const objects = sceneryObstaclesNear(w, p, probe, radius);
  if (
    locked &&
    objects.some((o) => o.id === saved.id && circleContact(p, probe, o, o.radius + radius))
  )
    return { point: p, stopped: true };
  delete p.sceneryStop;
  let point = to;
  for (let attempt = 0; attempt < 4; attempt++) {
    const hits = objects
      .map((o) => ({ o, hit: circleContact(p, point, o, o.radius + radius) }))
      .filter((h): h is { o: (typeof objects)[number]; hit: Contact } => !!h.hit);
    const first = hits.sort((a, b) => a.hit.t - b.hit.t)[0];
    if (!first) return { point, stopped: false };
    const { o, hit } = first;
    if (!walking) {
      // Retain the blocked reach across shorter ticks, while allowing a new direction or layout.
      p.sceneryStop = {
        id: o.id,
        x: p.x,
        z: p.z,
        vehicle: p.vehicle,
        reach: distance * hit.t + 1e-5,
      };
      return { point: p, stopped: true };
    }
    point = slide(p, point, hit);
  }
  return { point: p, stopped: true };
}

export function onSolidGround(w: World, p: Player) {
  const mode = vehicleDef(w, p.vehicle).mode;
  return (
    !p.atHome &&
    !p.inside &&
    !p.hitch &&
    mode !== 3 &&
    (mode === 2
      ? (p.flight?.grounded ?? p.y <= travelHeight(w, p.x, p.z) + 0.25)
      : p.y <= travelHeight(w, p.x, p.z) + 1)
  );
}
/** Keep signed-off obstacles visible for exactly as long as the authority blocks them. */
export function offlineGroundObstacle(w: World, p: Player) {
  const parking = parkingRules(w.settings);
  if (parking.vehiclesPersist && (!p.npc || parking.parkingNpcs)) return false;
  const rules = obstacleRules(w.settings);
  return (
    !p.online &&
    rules.vehicleCollision !== 'off' &&
    rules.offlineVehicleObstacleSeconds > 0 &&
    w.time - p.lastSeen < rules.offlineVehicleObstacleSeconds &&
    (rules.pedestrianBlocking || vehicleDef(w, p.vehicle).mode !== 8) &&
    onSolidGround(w, p)
  );
}
type ContactBody = Pick<Player, 'x' | 'z' | 'heading' | 'vehicle' | 'id' | 'speed' | 'flight'>;
function footprint(w: World, p: ContactBody) {
  const v = vehicleDef(w, p.vehicle),
    radius = v.collisionRadius ?? (v.mode === 8 ? 0.25 : 1.3);
  return {
    ...vehicleFootprint(w, p.vehicle, p),
    circle: v.mode === 8 ? radius : 0,
  };
}
/** Swept separating axes: both oriented footprints contribute their full extent. */
function hullContact(w: World, p: ContactBody, q: ContactBody, to: Point): Contact | undefined {
  const a = footprint(w, p),
    b = footprint(w, q),
    delta = subtract(p, q),
    d = subtract(to, p);
  if (a.circle && b.circle) return circleContact(p, to, q, a.circle + b.circle);
  const axes = [...(!a.circle ? a.axes : []), ...(!b.circle ? b.axes : [])];
  const projection = (f: typeof a, axis: Point) =>
    f.circle || f.hx * Math.abs(dot(f.axes[0], axis)) + f.hz * Math.abs(dot(f.axes[1], axis));
  let enter = -Infinity,
    leave = Infinity,
    normal: Point = { x: 0, z: 0 },
    overlap = Infinity,
    overlapNormal = normal;
  for (const axis of axes) {
    const extent = projection(a, axis) + projection(b, axis),
      start = dot(delta, axis),
      velocity = dot(d, axis),
      depth = extent - Math.abs(start);
    if (depth < overlap) {
      overlap = depth;
      overlapNormal = { x: axis.x * (start < 0 ? -1 : 1), z: axis.z * (start < 0 ? -1 : 1) };
    }
    if (Math.abs(velocity) < 1e-12) {
      if (Math.abs(start) >= extent) return;
      continue;
    }
    const t1 = (-extent - start) / velocity,
      t2 = (extent - start) / velocity,
      near = Math.min(t1, t2);
    if (near > enter) {
      enter = near;
      const sign = velocity > 0 ? -1 : 1;
      normal = { x: axis.x * sign, z: axis.z * sign };
    }
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return;
  }
  if (overlap > 0)
    return dot(d, overlapNormal) < -1e-9 ? { t: 0, normal: overlapNormal } : undefined;
  if (enter < 0 || enter > 1 || leave < 0) return;
  return { t: enter, normal };
}
export function stopGroundVehicle(p: Pick<Player, 'speed' | 'flight'>) {
  p.speed = 0;
  if (p.flight) p.flight = { ...p.flight, vx: 0, vz: 0, airspeed: 0 };
}
export function playerContact(
  w: World,
  p: Player,
  to: Point,
  prediction: boolean,
): { point: Point; stopped: boolean } {
  const rules = obstacleRules(w.settings);
  if (rules.vehicleCollision === 'off') return { point: to, stopped: false };
  const walking = vehicleDef(w, p.vehicle).mode === 8;
  const slidingPast = new Set<string>();
  let point = to,
    reduced = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    let first: { hit: Contact; other: ContactBody } | undefined;
    for (const q of Object.values(w.players)) {
      if (
        q.id === p.id ||
        slidingPast.has(q.id) ||
        !onSolidGround(w, q) ||
        (!rules.pedestrianBlocking && (walking || vehicleDef(w, q.vehicle).mode === 8))
      )
        continue;
      if (!q.online && !offlineGroundObstacle(w, q)) continue;
      const hit = hullContact(w, p, q, point);
      if (hit && (!first || hit.t < first.hit.t)) first = { hit, other: q };
    }
    for (const [key, v] of Object.entries(w.parkedVehicles ?? {})) {
      const id = `parked:${key}`;
      if (v.inside || slidingPast.has(id)) continue;
      const body = { ...v, id, vehicle: v.slot, speed: 0 };
      const hit = hullContact(w, p, body, point);
      if (hit && (!first || hit.t < first.hit.t)) first = { hit, other: body };
    }
    if (!first) {
      if (reduced) p.speed *= rules.vehicleGlancingSpeed;
      return { point, stopped: false };
    }
    const { hit, other } = first,
      d = subtract(point, p),
      length = Math.hypot(d.x, d.z);
    const side = footprint(w, other).axes[0];
    const lateral = dot(subtract(p, other), side);
    const shallow =
      length > 0 &&
      Math.abs(dot(d, side)) / length <= Math.sin((rules.vehicleGlancingDegrees * Math.PI) / 180) &&
      Math.abs(lateral) >= footprint(w, other).hx + footprint(w, p).hx * 0.5;
    if (
      walking ||
      (rules.vehicleCollision === 'glancing' && shallow && rules.vehicleGlancingSpeed > 0)
    ) {
      const normal = walking
        ? hit.normal
        : { x: side.x * Math.sign(lateral), z: side.z * Math.sign(lateral) };
      const tangent = { x: d.x - normal.x * dot(d, normal), z: d.z - normal.z * dot(d, normal) };
      if (Math.hypot(tangent.x, tangent.z) > 1e-5) {
        point = slide(p, point, { ...hit, normal, t: shallow ? 0 : hit.t });
        if (!walking) {
          const own = footprint(w, p),
            target = footprint(w, other);
          const clearance =
            target.hx +
            own.hx * Math.abs(dot(own.axes[0], side)) +
            own.hz * Math.abs(dot(own.axes[1], side));
          const offset = Math.max(
            0,
            clearance + 1e-5 - Math.abs(dot(subtract(point, other), side)),
          );
          point = { x: point.x + normal.x * offset, z: point.z + normal.z * offset };
          slidingPast.add(other.id);
        }
        reduced ||= !walking;
        continue;
      }
    }
    const targetVelocity = {
      x: Math.sin(other.heading) * other.speed,
      z: Math.cos(other.heading) * other.speed,
    };
    // Only the authority can stop a closing opposing driver. Never move the target.
    if (
      !prediction &&
      Math.abs(other.speed) > 0.1 &&
      dot(d, targetVelocity) < 0 &&
      dot(targetVelocity, hit.normal) > 0
    )
      stopGroundVehicle(other);
    return { point: p, stopped: true };
  }
  return { point: p, stopped: true };
}
