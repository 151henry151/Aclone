// SPDX-License-Identifier: GPL-3.0-or-later
/** Fictional sky at 45° north, with a tilted axis and a nearby binary moon pair.
 * Absolute dates are never wrapped at year end: lunar phases keep advancing.
 * Local axes match driving: +X east, +Y up, +Z south. Angles are radians. */
export type Direction = [number, number, number];
const TAU = Math.PI * 2,
  tilt = (23.4 * Math.PI) / 180,
  latitude = Math.PI / 4;
const dot = (a: Direction, b: Direction) => a.reduce((sum, x, i) => sum + x * b[i], 0);
function frame(day: number, seconds: number) {
  const date = day + seconds / 86400;
  const longitude = (TAU * (date - 80)) / 365;
  const sunRA = Math.atan2(Math.sin(longitude) * Math.cos(tilt), Math.cos(longitude));
  const sidereal = sunRA + TAU * (seconds / 86400 - 0.5);
  const s = Math.sin(sidereal),
    c = Math.cos(sidereal),
    sl = Math.sin(latitude),
    cl = Math.cos(latitude);
  // Row-major equatorial-to-local matrix; also column-major inverse for GLSL.
  const skyRotation = [-s, 0, c, cl * c, sl, cl * s, sl * c, -cl, sl * s];
  const project = (lon: number, lat = 0): Direction => {
    const v: Direction = [
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat) * Math.cos(tilt) + Math.cos(lat) * Math.sin(lon) * Math.sin(tilt),
      Math.cos(lat) * Math.sin(lon) * Math.cos(tilt) - Math.sin(lat) * Math.sin(tilt),
    ];
    return [0, 1, 2].map((row) =>
      dot(skyRotation.slice(row * 3, row * 3 + 3) as Direction, v),
    ) as Direction;
  };
  return { date, longitude, skyRotation, project };
}
export function solarDirectionAt(day: number, seconds: number): Direction {
  const f = frame(day, seconds);
  return f.project(f.longitude);
}
export function celestialAt(day: number, seconds: number) {
  const f = frame(day, seconds),
    sun = f.project(f.longitude);
  const elongation = (TAU * (f.date + 5)) / 28;
  const longitude = f.longitude + elongation;
  const latitude = Math.sin(longitude + 0.7) * 0.065;
  const binary = (TAU * f.date) / 5;
  const moons = [-0.012, 0.065].map((offset, i) => {
    const direction = f.project(
      longitude + Math.cos(binary) * offset,
      latitude + Math.sin(binary) * offset,
    );
    return {
      direction,
      radius: ((i === 0 ? 1.1 : 0.56) * Math.PI) / 180,
      illuminated: Math.max(0, Math.min(1, (1 - dot(direction, sun)) / 2)),
    };
  });
  return { sun, skyRotation: f.skyRotation, moons };
}
