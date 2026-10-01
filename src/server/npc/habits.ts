// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
export const habitSchema = z.object({
  hour: z.number().min(0).max(23.99).default(14),
  spreadHours: z.number().min(0.25).max(10).default(2),
  randomChance: z.number().min(0).max(1).default(0.15),
  minutes: z.number().min(15).max(60).default(35),
  variation: z.number().min(0.05).max(0.6).default(0.25),
  longChance: z.number().min(0).max(1).default(0.22),
  multiplier: z.number().min(1).max(3).default(1),
});
export type Habit = z.infer<typeof habitSchema>;
export interface Presence {
  phase: 'offline' | 'playing' | 'preparing';
  sessions: number;
  nextAt: number;
  startedAt?: number;
  endsAt: number;
  nextRegularAt: number;
  preparationUntil: number;
  shortVisit?: boolean;
  reason?: string;
}
export const timeZoneSchema = z
  .string()
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Use an IANA time zone such as America/New_York')
  .default('America/New_York');
export function randomFor(seed: string) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const formatters = new Map<string, Intl.DateTimeFormat>();
function localParts(at: number, zone: string) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(zone, formatter);
  }
  return Object.fromEntries(
    formatter
      .formatToParts(at)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
}
/** Approximate preferred local hours, including DST, with a different draw each date. */
export function nextVisit(id: string, habit: Habit, zone: string, after: number) {
  const p = localParts(after, zone);
  const midnight = Date.UTC(p.year, p.month - 1, p.day);
  for (let day = 0; day < 4; day++) {
    const date = midnight + day * 86400000;
    const rng = randomFor(`${id}:${date}:habit`);
    const hour =
      rng() < habit.randomChance ? rng() * 24 : habit.hour + (rng() * 2 - 1) * habit.spreadHours;
    const wall = date + Math.round(Math.max(0, Math.min(23.99, hour)) * 3600000);
    let at = wall;
    for (let i = 0; i < 3; i++) {
      const q = localParts(at, zone);
      at += wall - Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second);
    }
    if (at > after) return at;
  }
  return after + 86400000;
}
export function initialPresence(id: string, habit: Habit, zone: string, now: number): Presence {
  return {
    phase: 'offline',
    sessions: 0,
    nextAt: nextVisit(id, habit, zone, now),
    endsAt: 0,
    nextRegularAt: 0,
    preparationUntil: 0,
    reason: 'Waiting for first visit',
  };
}
export function beginVisit(s: Presence, id: string, habit: Habit, zone: string, now: number) {
  const rng = randomFor(`${id}:${s.sessions}:${s.nextAt}:duration`);
  const extended = s.sessions === 0 || (!s.shortVisit && rng() < habit.longChance);
  const minutes = s.shortVisit
    ? 10 + rng() * 10
    : (extended ? 120 + rng() * 60 : habit.minutes * (1 + (rng() * 2 - 1) * habit.variation)) *
      habit.multiplier;
  s.sessions++;
  s.phase = 'playing';
  s.startedAt = now;
  s.endsAt = now + Math.round(minutes * 60000);
  s.preparationUntil = s.endsAt + 10 * 60000;
  // A welfare check does not erase the next ordinary daily visit.
  if (!s.shortVisit || s.nextRegularAt <= s.endsAt)
    s.nextRegularAt = nextVisit(id, habit, zone, s.endsAt + 6 * 3600000);
  s.reason = s.shortVisit
    ? 'Short food and shelter check'
    : extended
      ? 'Long visit'
      : 'Daily visit';
  s.shortVisit = false;
}
