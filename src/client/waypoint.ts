// SPDX-License-Identifier: GPL-3.0-or-later
export interface Waypoint {
  x: number;
  z: number;
  name: string;
}
/** `half` is the world's map half-size; the old 250 m square remains the default. */
export function readWaypoint(raw: string | null, half = 250): Waypoint | undefined {
  try {
    const p = JSON.parse(raw ?? 'null');
    if (
      p &&
      typeof p.x === 'number' &&
      typeof p.z === 'number' &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.z) &&
      Math.abs(p.x) <= half &&
      Math.abs(p.z) <= half &&
      typeof p.name === 'string'
    )
      return { x: p.x, z: p.z, name: p.name.slice(0, 80) };
  } catch {
    /* Invalid or unavailable browser storage is harmless. */
  }
}
export function waypointGuidance(p: { x: number; z: number; heading: number }, goal: Waypoint) {
  const dx = goal.x - p.x,
    dz = goal.z - p.z;
  // Heading zero faces +z; CSS rotation is clockwise from screen up.
  const angle = Math.atan2(dx, dz) - p.heading;
  return {
    metres: Math.hypot(dx, dz),
    degrees: (Math.atan2(Math.sin(angle), Math.cos(angle)) * 180) / Math.PI,
  };
}
export class Waypoints {
  private world = '';
  private half = 250;
  point: Waypoint | undefined;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {}
  selectWorld(id: string, half = 250) {
    if (id === this.world && half === this.half) return;
    this.world = id;
    this.half = half;
    this.point = undefined;
    try {
      this.point = readWaypoint(this.storage.getItem(this.key()), half);
    } catch {
      /* Private browsing. */
    }
  }
  set(point?: Waypoint) {
    this.point = point && readWaypoint(JSON.stringify(point), this.half);
    try {
      if (this.point) this.storage.setItem(this.key(), JSON.stringify(this.point));
      else this.storage.removeItem(this.key());
    } catch {
      /* The waypoint still works for this session. */
    }
  }
  private key() {
    return 'aclone.waypoint.' + this.world;
  }
}
