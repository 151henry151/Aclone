// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { calendar, worldWeather, DAY_SECONDS } from './environment';
import { defaults } from './catalog';
import { terrainHeight } from './terrain';
import { lunarElongation, LUNAR_SYNODIC_DAYS } from './astronomy';
export const LUNAR_DAYS = LUNAR_SYNODIC_DAYS;
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Continuous economic/lunar date, including across midnight and year boundaries. */
export function oceanDate(time: number) {
  return time / DAY_SECONDS + 59 + defaults.time / 86400;
}
/** Semidiurnal lunar + solar constituents: spring range is the configured maximum. */
export function tideOffset(date: number, range: number) {
  if (range <= 0) return 0;
  const solar = TAU * (date - 0.5);
  const elongation = lunarElongation(date);
  return (
    Math.max(0, range) *
    0.5 *
    (0.72 * Math.cos(2 * (solar - elongation)) + 0.28 * Math.cos(2 * solar))
  );
}
export function waterLevel(w: Pick<World, 'time' | 'settings'>, time = w.time) {
  return w.settings.seaLevel + tideOffset(oceanDate(time), w.settings.tidalRange ?? 0);
}
export function highWater(w: Pick<World, 'settings'>) {
  return w.settings.seaLevel + (w.settings.tidalRange ?? 0) / 2;
}
export function lowWater(w: Pick<World, 'settings'>) {
  return w.settings.seaLevel - (w.settings.tidalRange ?? 0) / 2;
}
/** Metres of component amplitude. Clear, low-wind spells can be almost glassy. */
export function waveAmplitude(wind: number, storm: boolean, strength = 1) {
  return (
    clamp(strength, 0, 2) *
    (storm ? 1.35 + clamp(wind - 2, 0, 3) * 0.25 : 0.006 + Math.max(0, wind - 0.6) ** 2 * 0.28)
  );
}
const weatherCache = new WeakMap<
  World,
  { time: number; mode: unknown; strength: unknown; value: { amplitude: number; storm: boolean } }
>();
export function oceanWeather(w: World) {
  const cached = weatherCache.get(w);
  if (
    cached?.time === w.time &&
    cached.mode === w.creator?.weather &&
    cached.strength === w.settings.oceanWaves
  )
    return cached.value;
  const c = worldWeather(w, calendar(w).absoluteDay);
  // Wind seas build and subside over time instead of jumping at a weather boundary.
  let amplitude = 0;
  for (const [age, weight] of [
    [0, 0.15],
    [5, 0.2],
    [15, 0.25],
    [30, 0.2],
    [60, 0.15],
    [90, 0.05],
  ]) {
    const at = { ...w, time: Math.max(0, w.time - age) };
    const prior = worldWeather(at, calendar(at).absoluteDay);
    amplitude += waveAmplitude(prior.wind, prior.storm, w.settings.oceanWaves ?? 1) * weight;
  }
  const value = { amplitude, storm: c.storm };
  weatherCache.set(w, {
    time: w.time,
    mode: w.creator?.weather,
    strength: w.settings.oceanWaves,
    value,
  });
  return value;
}
// Identical spectral components are used in the surface shader and hull sampling.
// direction X/Z, wavelength, period (real seconds), relative amplitude, phase.
export const SWELLS = [
  [0.38, -0.925, 48, 5.55, 0.62, 0],
  [0.8, -0.6, 27, 4.16, 0.25, 1.7],
  [-0.25, -0.968, 13, 2.89, 0.13, 3.1],
] as const;
export function swell(x: number, z: number, time: number, amplitude: number, depth = 100) {
  const shoal = clamp(depth / 3);
  let height = 0,
    dx = 0,
    dz = 0,
    velocity = 0;
  for (const [vx, vz, length, period, weight, phase] of SWELLS) {
    const k = TAU / length,
      omega = TAU / period;
    const a = amplitude * weight * shoal;
    const p = k * (x * vx + z * vz) - omega * time + phase;
    height += a * Math.sin(p);
    dx += a * k * vx * Math.cos(p);
    dz += a * k * vz * Math.cos(p);
    velocity -= a * omega * Math.cos(p);
  }
  return { height, dx, dz, velocity };
}
export function boatSeaPose(
  w: World,
  x: number,
  z: number,
  heading: number,
  length: number,
  beam: number,
  time = w.time,
  amplitude = oceanWeather(w).amplitude,
) {
  const level = waterLevel(w, time),
    ground = terrainHeight(w, x, z);
  const sample = (side: number, along: number) => {
    const px = x + Math.cos(heading) * side + Math.sin(heading) * along;
    const pz = z - Math.sin(heading) * side + Math.cos(heading) * along;
    return swell(px, pz, time, amplitude, level - terrainHeight(w, px, pz)).height;
  };
  const fore = sample(0, length / 2),
    aft = sample(0, -length / 2),
    left = sample(-beam / 2, 0),
    right = sample(beam / 2, 0);
  return {
    y: Math.max(ground, level + (fore + aft + left + right) / 4),
    pitch: -Math.atan2(fore - aft, length),
    roll: Math.atan2(right - left, beam),
  };
}
/** Extra resistance from meeting a rising face; no random damage or vessel loss. */
export function waveImpact(
  x: number,
  z: number,
  time: number,
  heading: number,
  speed: number,
  amplitude: number,
  depth: number,
) {
  const s = swell(x, z, time, amplitude, depth);
  const encounter = s.velocity + speed * (Math.sin(heading) * s.dx + Math.cos(heading) * s.dz);
  return clamp((encounter - 0.6) * Math.max(0, Math.abs(speed) - 2) * 0.12, 0, 2.5);
}
