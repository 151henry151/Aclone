// SPDX-License-Identifier: GPL-3.0-or-later
export interface GrazingPoint {
  x: number;
  y: number;
  z: number;
}
export interface GrazingRoute {
  points: GrazingPoint[];
  heights?: number[][];
  seed: number;
  kind: string;
}
const smooth = (n: number) => n * n * (3 - 2 * n);
/** Analytic paths avoid per-frame random choices and stay inside the convex fenced parcel. */
export function grazingPose(site: GrazingRoute, time: number) {
  const duration = 34 + (site.seed % 7),
    t = time + site.seed * 7;
  const phase = (((t % duration) + duration) % duration) / duration;
  const step = Math.floor(t / duration),
    n = site.points.length;
  const a = site.points[((step % n) + n) % n],
    b = site.points[(((step + 1) % n) + n) % n];
  const previous = site.points[(((step - 1) % n) + n) % n];
  // Turn while standing, then walk, decelerate and graze. Never backslide or teleport.
  const move = Math.max(0, Math.min(1, (phase - 0.12) / 0.58));
  const u = smooth(move),
    target = Math.atan2(b.x - a.x, b.z - a.z);
  const before = Math.atan2(a.x - previous.x, a.z - previous.z);
  const turn = Math.atan2(Math.sin(target - before), Math.cos(target - before));
  const walk = move > 0 && move < 1 ? Math.sin(move * Math.PI) : 0;
  const path = site.heights?.[((step % n) + n) % n];
  const sample = u * ((path?.length ?? 1) - 1),
    index = Math.floor(sample);
  const y = path
    ? path[index] + (path[Math.min(index + 1, path.length - 1)] - path[index]) * (sample - index)
    : a.y + (b.y - a.y) * u;
  return {
    x: a.x + (b.x - a.x) * u,
    y,
    z: a.z + (b.z - a.z) * u,
    heading: before + turn * smooth(Math.min(1, phase / 0.12)),
    walk,
    stride: time * (site.kind === 'chickens' ? 10 : 5) + site.seed,
    graze:
      phase < 0.12
        ? 1 - smooth(Math.min(1, phase / 0.1))
        : smooth(Math.max(0, Math.min(1, (phase - 0.73) / 0.1))),
  };
}
