// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World, Player } from './types.ts';
import { catalogueItemId } from './world-catalogue.ts';
import { DAY_SECONDS } from './environment.ts';
import { say } from './messages.ts';
import { questEvent } from './quests.ts';
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/)
  .refine((s) => !['constructor', 'prototype', '__proto__'].includes(s));
export const bookSchema = z.object({
  id,
  title: z.string().trim().min(1).max(64),
  item: catalogueItemId,
  pages: z.array(z.string().trim().min(1).max(2000)).min(1).max(8),
});
export const townEventSchema = z.object({
  id,
  title: z.string().trim().min(1).max(64),
  description: z.string().max(1000),
  startsDay: z.number().min(0).max(100000),
  repeatDays: z.number().min(0).max(365),
  durationDays: z.number().min(0.1).max(365),
  quest: z.string().max(64).default(''),
});
export type Book = z.infer<typeof bookSchema>;
export type TownEvent = z.infer<typeof townEventSchema>;
export function activeTownEvents(w: World) {
  const day = w.time / DAY_SECONDS;
  return (w.creator?.townEvents ?? []).flatMap((e) => {
    if (day < e.startsDay) return [];
    const slot = e.repeatDays > 0 ? Math.floor((day - e.startsDay) / e.repeatDays) : 0;
    return day - e.startsDay - slot * e.repeatDays < e.durationDays ? [{ ...e, slot }] : [];
  });
}
/** Announce only the current event, never replay every missed occurrence after downtime. */
export function tickTownEvents(w: World) {
  const runs = (w.townEventRuns ??= {});
  for (const id of Object.keys(runs))
    if (!w.creator?.townEvents.some((e) => e.id === id)) delete runs[id];
  for (const e of activeTownEvents(w)) {
    const key = JSON.stringify([e.title, e.startsDay, e.repeatDays, e.slot]);
    if (runs[e.id] === key) continue;
    runs[e.id] = key;
    say(w, 'Town event', e.title + ': ' + e.description.slice(0, 1000));
  }
}
export function readBook(w: World, p: Player, id: string) {
  const book = w.creator?.books.find((b) => b.id === id);
  if (!book || !(p.inventory[book.item] > 0)) throw Error('Carry this book before reading it');
  questEvent(w, p, 'interact', book.id);
  return book;
}
