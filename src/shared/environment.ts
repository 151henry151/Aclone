// SPDX-License-Identifier: GPL-3.0-or-later
import { defaults } from './catalog.ts';
import { solarDirectionAt } from './astronomy';
import type { World } from './types.ts';
export const DAY_SECONDS = 600;
export type Season = 'Winter' | 'Spring' | 'Summer' | 'Autumn';
export function seasonAt(day: number): Season {
  day = ((day % 365) + 365) % 365;
  return day < 59 || day >= 334 ? 'Winter' : day < 151 ? 'Spring' : day < 243 ? 'Summer' : 'Autumn';
}
/** Economic calendar is independent of the owner's decorative clock controls. */
export function calendar(w: Pick<World, 'time'>) {
  const absoluteDay = Math.floor(w.time / DAY_SECONDS + 59 + defaults.time / 86400 + 1e-10);
  const dayOfYear = absoluteDay % 365;
  return {
    absoluteDay,
    dayOfYear,
    year: Math.floor(absoluteDay / 365) + 1,
    season: seasonAt(dayOfYear),
  };
}
/** Metres of settled snow. A normal storm's extra 12 cm thaws over one sunny day. */
export const WINTER_BASE_SNOW = 0.04;
export const NORMAL_STORM_SNOW = 0.12;
const calendarOffset = 59 + defaults.time / 86400;
const clamp = (x: number, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const mod = (x: number, period: number) => ((x % period) + period) % period;

/** Independent, avalanched 32-bit streams: no shared mutable RNG or restart rerolls. */
function weatherRoll(world: string, period: number, stream: string) {
  let seed = 2166136261;
  for (const c of `${world}:${period}:${stream}`)
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
  seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}
/** Two-day opportunities, with variable onset and duration; long storms cross midnight.
 * A winter spans December and the following January/February, sharing one wetness bias. */
function weatherEvent(world: string, date: number) {
  const slot = Math.floor(date / 2);
  const start = slot * 2 + 0.03 + weatherRoll(world, slot, 'onset') * 0.25;
  const season = seasonAt(Math.floor(date));
  const durationRoll = weatherRoll(world, slot, 'duration');
  // Retain roughly the old wet-weather share for crops outside winter. Snow
  // instead favours brief showers, with much rarer prolonged accumulation.
  const duration = season === 'Winter' ? 0.2 + 1.5 * durationRoll ** 2 : 0.7 + durationRoll;
  const winter = Math.floor((Math.floor(date) + 31) / 365);
  const chance =
    season === 'Winter'
      ? 0.25 + weatherRoll(world, winter, 'winter-wetness') * 0.5
      : season === 'Autumn'
        ? 0.9
        : 0.64;
  return {
    start,
    end: start + duration,
    next: (slot + 1) * 2,
    active:
      weatherRoll(world, slot, 'occurrence') < chance && date >= start && date < start + duration,
    // A cubic distribution makes heavy snowfall substantially rarer than light snowfall.
    strength: 0.35 + 2.65 * weatherRoll(world, slot, 'strength') ** 3,
    duration,
  };
}
/** Weather at an absolute date plus a fraction of its day (noon for daily forecasts). */
export function weatherAt(world: string, absoluteDay: number, fraction = 0.5) {
  const date = absoluteDay + fraction,
    day = mod(Math.floor(date), 365);
  const event = weatherEvent(world, date);
  const warmth = Math.cos(((day - 190) / 365) * Math.PI * 2);
  const temperature = Math.round(
    10 + 14 * warmth + (weatherRoll(world, Math.floor(date), 'temperature') - 0.5) * 6,
  );
  const wet = event.active;
  const precipitation = wet
    ? seasonAt(day) === 'Winter' || temperature < 2
      ? 'snow'
      : 'rain'
    : 'clear';
  const storm = wet && (event.strength >= 1.1 || (precipitation === 'snow' && event.duration >= 1));
  const cloudRoll = weatherRoll(world, Math.floor(date), 'clouds');
  return {
    season: seasonAt(day),
    temperature,
    precipitation,
    storm,
    intensity: wet ? clamp(0.3 + event.strength * 0.24) : 0,
    clouds: wet ? (storm ? 0.97 : 0.85) : cloudRoll < 0.28 ? 0.82 : 0.08 + cloudRoll * 0.28,
    wind: storm ? 2 + event.strength : wet ? 0.9 : 0.3 + cloudRoll,
    snowfallPerDay: precipitation === 'snow' ? 0.24 * event.strength : 0,
  };
}
/** Weather follows economic time; the decorative sky clock controls when snow can melt. */
export function worldWeather(
  w: Pick<World, 'id' | 'creator'> & Partial<Pick<World, 'time'>>,
  day: number,
  fraction?: number,
) {
  const at =
    fraction ??
    (w.time !== undefined && calendar({ time: w.time }).absoluteDay === day
      ? Math.max(0, w.time / DAY_SECONDS + calendarOffset - day)
      : 0.5);
  const natural = weatherAt(w.id, day, at),
    mode = w.creator?.weather ?? 'natural';
  if (mode === 'natural') return natural;
  const snow = mode === 'snow' || mode === 'snowstorm',
    wet = mode !== 'clear',
    storm = mode.endsWith('storm');
  return {
    ...natural,
    precipitation: snow ? 'snow' : wet ? 'rain' : 'clear',
    temperature: snow ? -5 : Math.max(6, natural.temperature),
    storm,
    intensity: wet ? (storm ? 1 : 0.6) : 0,
    clouds: wet ? 0.95 : 0.05,
    wind: storm ? 3 : wet ? 1 : 0.3,
    snowfallPerDay: snow ? (storm ? 0.48 : 0.12) : 0,
  };
}
/** Compatibility with saved coverage-only worlds: existing snow becomes a thin base,
 * never a fabricated deep drift. Missing climate is bare ground, even in winter. */
export function snowDepth(climate: World['climate']) {
  return Math.max(0, climate?.snowDepth ?? clamp(climate?.snow ?? 0) * WINTER_BASE_SNOW);
}
export function snowDescription(climate: World['climate']) {
  const depth = snowDepth(climate);
  if (depth < 0.001) return '';
  const amount = depth < 1 ? `${Math.max(1, Math.round(depth * 100))} cm` : `${depth.toFixed(1)} m`;
  return `${depth >= 0.5 ? 'Deep snow' : 'Snow'} ${amount} · roads clear`;
}
export function sunAt(seconds: number, day: number) {
  const direction = solarDirectionAt(day, seconds),
    height = direction[1];
  return {
    direction,
    daylight: Math.max(0, Math.min(1, height * 3)),
    twilight: Math.max(0, 1 - Math.abs(height) * 5),
  };
}

/** Integral of positive solar elevation, using a fixed declination per calendar day.
 * This analytic primitive is additive across ticks, restarts and offline catch-up. */
function solarExposure(w: World, day: number, start: number, end: number) {
  const noon = solarDirectionAt(day, 43200)[1],
    midnight = solarDirectionAt(day, 0)[1];
  const a = (noon - midnight) / 2,
    b = (noon + midnight) / 2;
  const halfDay = Math.acos(clamp(-b / a, -1, 1)) / (2 * Math.PI);
  const rise = 0.5 - halfDay,
    set = 0.5 + halfDay;
  const integral = (x: number) => b * x + (a * Math.sin(2 * Math.PI * (x - 0.5))) / (2 * Math.PI);
  const full = integral(set) - integral(rise);
  const primitive = (x: number) =>
    Math.floor(x) * full + integral(clamp(mod(x, 1), rise, set)) - integral(rise);
  const clock = (time: number) =>
    w.settings.time / 86400 +
    (w.settings.dayLength > 0 ? (time - w.time) / w.settings.dayLength : 0);
  if (w.settings.dayLength <= 0)
    return (
      ((Math.max(0, b + a * Math.cos(2 * Math.PI * (clock(start) - 0.5))) / full) * (end - start)) /
      DAY_SECONDS
    );
  return (
    ((primitive(clock(end)) - primitive(clock(start))) * w.settings.dayLength) /
    (full * DAY_SECONDS)
  );
}
/** Saved snowpack, integrated at midnight and each storm's start/end. */
export function advanceClimate(w: World, start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  w.climate ??= { snow: 0, wetness: 0 };
  const climate = w.climate;
  climate.snowDepth = snowDepth(climate);
  climate.winterBase ??=
    seasonAt(calendar({ time: start }).dayOfYear) === 'Winter'
      ? Math.min(WINTER_BASE_SNOW, climate.snowDepth)
      : 0;
  let at = start;
  while (at < end) {
    const date = at / DAY_SECONDS + calendarOffset;
    const day = Math.floor(date + 1e-10);
    const event = weatherEvent(w.id, date + 1e-10);
    const boundaries = [day + 1, event.start, event.end, event.next]
      .map((d) => (d - calendarOffset) * DAY_SECONDS)
      .filter((t) => t > at + 1e-7);
    const next = Math.min(end, ...boundaries);
    const dt = next - at;
    const weather = worldWeather(w, day, (at + next) / 2 / DAY_SECONDS + calendarOffset - day);
    const beforeDepth = climate.snowDepth;
    let wetSeconds = weather.precipitation !== 'clear' || beforeDepth > 0 ? dt : 0;
    if (weather.season !== 'Winter') climate.winterBase = 0;
    if (weather.precipitation === 'snow') {
      climate.snowDepth += (dt / DAY_SECONDS) * weather.snowfallPerDay;
      if (weather.season === 'Winter')
        climate.winterBase = Math.min(WINTER_BASE_SNOW, climate.snowDepth);
    } else if (!weather.storm && weather.precipitation === 'clear' && weather.clouds < 0.6) {
      climate.snowDepth = Math.max(
        climate.winterBase,
        climate.snowDepth - NORMAL_STORM_SNOW * solarExposure(w, day, at, next),
      );
    }
    // When the last snow melts partway through a sunny interval, dry only the
    // remainder. Otherwise long offline steps dry earlier than live simulation.
    if (beforeDepth > 0 && climate.snowDepth === 0 && weather.precipitation === 'clear') {
      let low = at,
        high = next;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (NORMAL_STORM_SNOW * solarExposure(w, day, at, mid) < beforeDepth) low = mid;
        else high = mid;
      }
      wetSeconds = (low + high) / 2 - at;
    }
    climate.snow = clamp(climate.snowDepth / WINTER_BASE_SNOW);
    climate.wetness =
      (1 - (1 - climate.wetness) * Math.exp(-wetSeconds / 90)) * Math.exp(-(dt - wetSeconds) / 600);
    at = next;
  }
}
/** Cleared roads remain wet/slippery, but never inherit deep off-road snow drag. */
export function roadConditions(w: World) {
  const wet = Math.max(clamp(w.climate?.wetness ?? 0), snowDepth(w.climate) > 0 ? 0.7 : 0);
  return { speed: 1 - wet * 0.15, grip: 1 - wet * 0.2 };
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
