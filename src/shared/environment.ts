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
    intensity: wet ? 0.4 + roll : 0,
    clouds: wet ? 0.85 : 0.2 + roll * 0.35,
    wind: 0.3 + roll,
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
