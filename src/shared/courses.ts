import { log } from './simulation';
// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World, Player, Action } from './types';
import { mapHalf } from './terrain';
const point = z.object({
  x: z.number().finite(),
  z: z.number().finite(),
  radius: z.number().min(2).max(20).default(6),
  holdSeconds: z.number().min(0).max(60).default(0),
});
export const courseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    name: z.string().min(1).max(60),
    starts: z.number().min(0),
    ends: z.number().min(0),
    limit: z.number().min(10).max(3600).default(600),
    reward: z.number().int().min(0).max(100000).default(0),
    points: z.array(point).min(2).max(32),
  })
  .refine((c) => c.ends > c.starts, 'End must follow start');
export type Course = z.infer<typeof courseSchema>;
export type CourseRun = {
  id: string;
  definition: string;
  start: number;
  next: number;
  last: { x: number; z: number };
  hold: number;
  vehicle: number;
  deaths: number;
};
export type CourseState = {
  definition: Course;
  sponsor: string;
  pot: number;
  allTime: Record<string, { name: string; seconds: number }>;
  week: number;
  weekly: Record<string, { name: string; seconds: number }>;
  paid: Record<string, boolean>;
};
const week = (w: World) => Math.floor(w.time / (7 * 86400));
const near = (p: { x: number; z: number }, q: { x: number; z: number }, r: number) =>
  Math.hypot(p.x - q.x, p.z - q.z) <= r;
const stamp = (c: Course) => JSON.stringify(c);
export function validateCourse(w: World, def: Course) {
  if (def.points.some((pt) => Math.abs(pt.x) > mapHalf(w) || Math.abs(pt.z) > mapHalf(w)))
    throw Error('Course points must be inside this world');
  for (let i = 1; i < def.points.length; i++)
    if (near(def.points[i - 1], def.points[i], def.points[i - 1].radius + def.points[i].radius))
      throw Error('Consecutive checkpoints must not overlap');
}
export function courseAction(w: World, p: Player, a: Action) {
  w.courses ??= [];
  if (a.operation === 'configure') {
    if (p.id !== w.owner && p.authority < 20) throw Error('World caretaker required');
    const def = courseSchema.parse(a.course);
    validateCourse(w, def);
    const old = w.courses.find((c) => c.definition.id === def.id);
    if (old && old.pot > 0 && old.sponsor !== p.id)
      throw Error('Only the funding sponsor can edit a funded course');
    if (!old && w.courses.length >= 16) throw Error('At most sixteen courses');
    if (old) {
      old.definition = def;
      old.allTime = {};
      old.weekly = {};
    } else
      w.courses.push({
        definition: def,
        sponsor: p.id,
        pot: 0,
        allTime: {},
        weekly: {},
        week: week(w),
        paid: {},
      });
    return 'Course saved. Editing a route cancels current runs; past weekly prize claims remain.';
  }
  const c = w.courses.find((c) => c.definition.id === a.course);
  if (!c) throw Error('Unknown course');
  if (a.operation === 'fund') {
    const n = Number(a.amount);
    if (!Number.isSafeInteger(n) || n < 1 || n > 10_000_000 || p.cash < n)
      throw Error('Choose an affordable whole amount in hundredths of a denarius');
    if (p.id !== c.sponsor) throw Error('Only the sponsor can fund this course');
    p.cash -= n;
    c.pot += n;
    log(w, 'transfer', n, p.id, 'course:' + c.definition.id, 'course prize deposit');
    return 'Prize escrow funded.';
  }
  if (a.operation === 'refund') {
    if (p.id !== c.sponsor || w.time < c.definition.ends)
      throw Error('Only the sponsor can collect unused escrow after closing');
    log(w, 'transfer', c.pot, 'course:' + c.definition.id, p.id, 'course escrow refund');
    p.cash += c.pot;
    c.pot = 0;
    return 'Unused prize escrow returned.';
  }
  if (a.operation === 'stop') {
    delete p.courseRun;
    return 'Course stopped.';
  }
  if (a.operation !== 'start') throw Error('Unknown course operation');
  const d = c.definition;
  if (w.time < d.starts || w.time >= d.ends) throw Error('Course is not open');
  if (!p.online || p.task || p.game || p.atHome || p.hitch || p.crowBody || p.vehicle !== 0)
    throw Error('Start outside in your tractor without another activity');
  if (!near(p, d.points[0], d.points[0].radius)) throw Error('Drive to the first checkpoint');
  p.courseRun = {
    id: d.id,
    definition: stamp(d),
    start: w.time,
    next: 1,
    last: { x: p.x, z: p.z },
    hold: 0,
    vehicle: p.vehicle,
    deaths: p.deaths,
  };
  return 'Course started. Follow checkpoints in order; portals, respawns and changing vehicle invalidate the run.';
}
export function tickCourses(w: World, dt: number) {
  for (const c of w.courses ?? []) {
    if (c.week !== week(w)) {
      c.week = week(w);
      c.weekly = {};
      c.paid = {};
    }
  }
  for (const p of Object.values(w.players)) {
    const run = p.courseRun;
    if (!run) continue;
    const c = w.courses?.find((c) => c.definition.id === run.id),
      d = c?.definition;
    if (
      !c ||
      !d ||
      run.definition !== stamp(d) ||
      !p.online ||
      dt > 1 ||
      p.vehicle !== run.vehicle ||
      p.deaths !== run.deaths ||
      p.task ||
      p.game ||
      p.hitch ||
      p.atHome ||
      p.crowBody ||
      w.time >= d.ends ||
      w.time - run.start > d.limit ||
      !near(p, run.last, 60 * dt + 1)
    ) {
      delete p.courseRun;
      continue;
    }
    run.last = { x: p.x, z: p.z };
    const target = d.points[run.next];
    if (!near(p, target, target.radius)) {
      run.hold = 0;
      continue;
    }
    run.hold += dt;
    if (run.hold < target.holdSeconds) continue;
    run.hold = 0;
    run.next++;
    if (run.next < d.points.length) continue;
    delete p.courseRun;
    const seconds = w.time - run.start;
    const result = { name: p.name, seconds };
    for (const board of [c.allTime, c.weekly]) {
      if (!board[p.id] || seconds < board[p.id].seconds) board[p.id] = result;
      const entries = Object.entries(board).sort((a, b) => a[1].seconds - b[1].seconds);
      for (const [id] of entries.slice(1000)) delete board[id];
    }
    // One prize per pilot per real-speed week, only from explicitly deposited money.
    if (!c.paid[p.id] && d.reward > 0 && c.pot >= d.reward && Object.keys(c.paid).length < 10000) {
      c.pot -= d.reward;
      p.cash += d.reward;
      c.paid[p.id] = true;
      log(w, 'transfer', d.reward, 'course:' + d.id, p.id, 'course prize');
    }
  }
}
export function exampleCourse(w: World): Course {
  return {
    id: 'island-trial',
    name: 'Island tractor trial',
    starts: w.time,
    ends: w.time + 7 * 86400,
    limit: 600,
    reward: 0,
    points: [
      { x: 0, z: 20, radius: 6, holdSeconds: 0 },
      { x: 55, z: 20, radius: 6, holdSeconds: 0 },
      { x: 55, z: 75, radius: 6, holdSeconds: 5 },
      { x: 0, z: 20, radius: 6, holdSeconds: 0 },
    ],
  };
}
