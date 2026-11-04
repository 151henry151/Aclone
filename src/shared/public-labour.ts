// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import { survivalRules } from './survival-rules';
import { DAY_SECONDS } from './environment.ts';
import type { World, Player } from './types.ts';
/** Named default retained for callers inspecting the ordinary world's relief allowance. */
export const RELIEF_PAY = defaults.labourReliefPay;
/** Eight full shifts, then two thirds, one half, one third and one quarter. */
export const LABOUR_FULL_SHIFTS = 8;
/** A gap this long, or any other work, restores full ordinary pay. */
export const LABOUR_BREAK_SECONDS = 600;

export function labourShiftPay(w: World) {
  return w.settings.labourShiftPay ?? 100;
}
export function labourDailyCap(w: World) {
  return w.settings.labourDailyCap ?? 20000;
}
export function labourStreakNow(w: World, p: Player) {
  if (!p.labourStreak || p.labourStreakAt === undefined) return 0;
  return w.time - p.labourStreakAt >= LABOUR_BREAK_SECONDS ? 0 : p.labourStreak;
}
function earnedToday(w: World, p: Player) {
  return p.labourDay === Math.floor(w.time / DAY_SECONDS) ? (p.labourEarned ?? 0) : 0;
}
function scaled(base: number, streak: number) {
  if (streak < LABOUR_FULL_SHIFTS) return base;
  const fraction = streak === 8 ? 2 / 3 : streak === 9 ? 1 / 2 : streak === 10 ? 1 / 3 : 1 / 4;
  return Math.floor(base * fraction);
}

export interface LabourQuote {
  pay: number;
  relief: boolean;
  reason?: string;
}
/** What the next public labour shift pays, and why it is less than the full rate. */
export function labourQuote(w: World, p: Player): LabourQuote {
  const rules = survivalRules(w.settings);
  if (
    p.cash + p.bank < rules.labourReliefMeans &&
    w.time >= (p.reliefAt ?? -Infinity) + rules.labourReliefCooldown
  )
    return { pay: rules.labourReliefPay, relief: true };
  const room = labourDailyCap(w) - earnedToday(w, p);
  if (room <= 0) return { pay: 0, relief: false, reason: 'daily labour cap reached' };
  const full = labourShiftPay(w);
  const pay = Math.min(room, scaled(full, labourStreakNow(w, p)));
  const reduced = pay < full;
  return {
    pay,
    relief: false,
    reason: reduced
      ? room < full
        ? 'daily labour cap'
        : `pay reduced after ${LABOUR_FULL_SHIFTS} shifts in a row; a ${LABOUR_BREAK_SECONDS / 60}-minute break restores full pay`
      : undefined,
  };
}
export function labourReward(w: World, p: Player) {
  return labourQuote(w, p).pay;
}
/** Record an ordinary payment. Relief is means-tested separately and does not count. */
export function noteLabourPaid(w: World, p: Player, amount: number, relief: boolean) {
  if (relief) return;
  const day = Math.floor(w.time / DAY_SECONDS);
  if (p.labourDay !== day) {
    p.labourDay = day;
    p.labourEarned = 0;
  }
  p.labourEarned = (p.labourEarned ?? 0) + amount;
  p.labourStreak = labourStreakNow(w, p) + 1;
  p.labourStreakAt = w.time;
}
export function breakLabourStreak(p: Player) {
  p.labourStreak = 0;
  delete p.labourStreakAt;
}
