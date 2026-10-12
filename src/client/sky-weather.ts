// SPDX-License-Identifier: GPL-3.0-or-later
import { noiseValues } from './noise';
import type { Direction, celestialAt } from '../shared/astronomy';
export function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** Smooth golden-hour envelope; full night/day and dense weather stay unaffected. */
export function twilightAt(height: number, clouds: number) {
  const envelope = smooth(-0.2, -0.035, height) * (1 - smooth(0.035, 0.28, height));
  const transmission = 1 - Math.max(0, Math.min(1, clouds)) * 0.65;
  return {
    glow: envelope * transmission,
    ambient: envelope * transmission * 0.16,
    warmth: 1 - smooth(0.025, 0.32, height),
  };
}
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(0, 1, x - ix),
    fy = smooth(0, 1, y - iy);
  const data = noiseValues();
  const at = (x: number, y: number) =>
    data[(((y % 128) + 128) % 128) * 128 + (((x % 128) + 128) % 128)] / 255;
  return (
    (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) +
    (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy
  );
}
/** Intersect the view ray with a curved cloud layer. Unlike a clamped plane,
 * this remains finite while retaining perspective all the way to the horizon. */
export function cloudCoordinates(direction: Direction, drift: number): [number, number] {
  const [x, h, z] = direction,
    elevation = Math.max(0, h),
    scale = 4.8 / (elevation + Math.sqrt(elevation * elevation + 0.04));
  return [x * scale + drift, z * scale];
}
export function cloudOpacity(direction: Direction, coverage: number, drift: number) {
  const [u, v] = cloudCoordinates(direction, drift),
    h = direction[1];
  const f =
    noise(u, v) * 0.55 +
    noise(u * 2.03, v * 2.03) * 0.27 +
    noise(u * 4.01, v * 4.01) * 0.12 +
    noise(u * 8.02, v * 8.02) * 0.06;
  const patch = smooth(0.66 - coverage * 0.5, 0.84 - coverage * 0.5, f);
  return (patch + (1 - patch) * smooth(0.65, 0.9, coverage)) * smooth(0, 0.16, h);
}
// Keep the coverage equation identical to cloudOpacity; both use noiseValues.
export const cloudShader = `
vec2 cloudUV(vec3 d, float drift){
  float h=max(0.,d.y);
  return d.xz*(4.8/(h+sqrt(h*h+.04)))+vec2(drift,0.);
}
float cloudAt(vec3 d, float coverage, float drift){
  vec2 p=cloudUV(d,drift);
  float density=smoothstep(.66-coverage*.5,.84-coverage*.5,fbm(p));
  return mix(density,1.,smoothstep(.65,.9,coverage))*smoothstep(0.,.16,d.y);
}`;
const probes: Direction[] = Array.from({ length: 16 }, (_, i) => {
  const y = (i + 0.5) / 16,
    a = i * 2.39996323,
    r = Math.sqrt(1 - y * y);
  return [Math.sin(a) * r, y, Math.cos(a) * r];
});
export function nightIllumination(
  sky: ReturnType<typeof celestialAt>,
  clouds: number,
  drift: number,
) {
  const night = 1 - smooth(-0.18, 0.06, sky.sun[1]);
  const transmission = (direction: Direction) =>
    Math.pow(1 - cloudOpacity(direction, clouds, drift), 3);
  const clearSky = probes.reduce((sum, p) => sum + transmission(p), 0) / probes.length;
  const moonlight = sky.moons.map(
    (moon, i) =>
      (i === 0 ? 0.95 : 0.32) *
      moon.illuminated ** 1.5 *
      smooth(0, 0.25, moon.direction[1]) *
      transmission(moon.direction) *
      night,
  );
  const total = moonlight[0] + moonlight[1];
  const direction = [0, 1, 2].map((i) =>
    total > 0
      ? sky.moons.reduce((sum, moon, j) => sum + moon.direction[i] * moonlight[j], 0) / total
      : i === 1
        ? 1
        : 0,
  ) as Direction;
  // Tune for a dark-adapted view on a normal display: stars reveal outlines,
  // while full moons reveal grass texture and leave readable, darker shadows.
  // Both contributions still disappear with daylight or opaque cloud cover.
  return { night, moonlight: total, direction, ambient: night * clearSky * 0.4 + total * 0.16 };
}
