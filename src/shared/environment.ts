// SPDX-License-Identifier: GPL-3.0-or-later
import { defaults } from './catalog.ts';
import type { World } from './types.ts';
export const DAY_SECONDS = 600;
export type Season = 'Winter' | 'Spring' | 'Summer' | 'Autumn';
export function seasonAt(day: number): Season {
  day = ((day % 365) + 365) % 365;
  return day < 59 || day >= 334 ? 'Winter' : day < 151 ? 'Spring' : day < 243 ? 'Summer' : 'Autumn';
}
/** Economic calendar is independent of the owner's decorative clock controls. */
export function calendar(w: Pick<World, 'time'>) {
  const absoluteDay = Math.floor(w.time / DAY_SECONDS + 59 + defaults.time / 86400);
  const dayOfYear = absoluteDay % 365;
  return {
    absoluteDay,
    dayOfYear,
    year: Math.floor(absoluteDay / 365) + 1,
    season: seasonAt(dayOfYear),
  };
}
export function weatherAt(world: string, absoluteDay: number) {
  const day = ((absoluteDay % 365) + 365) % 365;
  let seed = Math.floor(absoluteDay / 3) + 12345;
  for (const c of world) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const roll = ((Math.imul(seed ^ (seed >>> 16), 2246822519) >>> 0) % 10000) / 10000;
  const warmth = Math.cos(((day - 190) / 365) * Math.PI * 2);
  const temperature = Math.round(10 + 14 * warmth + (roll - 0.5) * 6);
  const wet = roll < (seasonAt(day) === 'Autumn' ? 0.55 : 0.38);
  const precipitation = wet ? (temperature < 2 ? 'snow' : 'rain') : 'clear';
  return {
    season: seasonAt(day),
    temperature,
    precipitation,
    storm: wet && roll < 0.14,
    intensity: wet ? (roll < 0.14 ? 1 : 0.4 + roll) : 0,
    clouds: wet ? 0.85 : 0.2 + roll * 0.35,
    wind: wet && roll < 0.14 ? 3 + roll : 0.3 + roll,
    snowCover: Math.max(0, Math.min(1, (-warmth - 0.45) * 2)),
  };
}
export function sunAt(seconds: number, day: number) {
  const hour = seconds / 3600;
  const length = 12 + 4 * Math.cos(((day - 172) / 365) * Math.PI * 2);
  const angle = ((hour - 12) / 12) * Math.PI;
  const height = Math.cos(angle) - Math.cos((length * Math.PI) / 24);
  return {
    direction: [-Math.sin(angle), height, 0.3] as [number, number, number],
    daylight: Math.max(0, Math.min(1, height * 3)),
    twilight: Math.max(0, 1 - Math.abs(height) * 5),
  };
}

/** Saved surface conditions, integrated at weather boundaries for identical offline catch-up. */
export function advanceClimate(w: World, start: number, end: number) {
  w.climate ??= { snow: 0, wetness: 0 };
  let at = start;
  while (at < end) {
    const day = calendar({ time: at + 1e-7 }).absoluteDay;
    const boundary = (day + 1 - 59 - defaults.time / 86400) * DAY_SECONDS;
    const next = Math.min(end, Math.max(at + 1e-6, boundary));
    const dt = next - at,
      weather = weatherAt(w.id, day);
    const snowing = weather.precipitation === 'snow';
    const melt = Math.max(0, weather.temperature) / 90000;
    w.climate.snow = Math.max(
      0,
      Math.min(1, w.climate.snow + dt * (snowing ? weather.intensity / 3600 : -melt)),
    );
    const wet = weather.precipitation === 'rain';
    w.climate.wetness = wet
      ? 1 - (1 - w.climate.wetness) * Math.exp(-dt / 90)
      : w.climate.wetness * Math.exp(-dt / 600);
    at = next;
  }
}
export function roadConditions(w: World) {
  const snow = w.climate?.snow ?? 0,
    wet = w.climate?.wetness ?? 0;
  return { speed: 1 - snow * 0.45 - wet * 0.15, grip: 1 - snow * 0.4 - wet * 0.2 };
}
export function eveningLights(b: { id: string; smoking?: boolean }, seconds: number, day: number) {
  if (!b.smoking || sunAt(seconds, day).daylight > 0.1) return false;
  let seed = day;
  for (const c of b.id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const bedtime = 21 + ((seed >>> 0) % 350) / 100;
  let hour = seconds / 3600;
  if (hour < 6) hour += 24;
  return hour >= 15 && hour < bedtime;
}
/** Two brief cloud-to-ground pulses; synchronized across observers, not every frame. */
export function lightningAt(time: number, storm: boolean) {
  if (!storm) return 0;
  const phase = time % 37;
  return phase < 0.08 ? 1 : phase > 0.22 && phase < 0.34 ? 0.65 : 0;
}
