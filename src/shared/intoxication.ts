// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player } from './types.ts';
/** Gameplay units, not blood-alcohol measurements. Time is persistent world seconds. */
export const alcoholDose = (item: string) => (item === 'beer' ? 18 : item === 'wine' ? 28 : 0);
export function alcoholLevel(p: Pick<Player, 'alcohol'>, time: number) {
  if (!p.alcohol) return 0;
  return Math.max(0, Math.min(100, p.alcohol.level - Math.max(0, time - p.alcohol.at) / 12));
}
export const impairment = (p: Pick<Player, 'alcohol'>, time: number) =>
  Math.max(0, (alcoholLevel(p, time) - 25) / 75);
export function drinkAlcohol(p: Player, item: string, time: number, count = 1) {
  const dose = alcoholDose(item);
  if (dose > 0)
    p.alcohol = { level: Math.min(100, alcoholLevel(p, time) + dose * count), at: time };
}
export function intoxicationLabel(p: Pick<Player, 'alcohol'>, time: number) {
  const strength = impairment(p, time);
  return strength > 0.6 ? 'Very drunk' : strength > 0.25 ? 'Drunk' : strength > 0 ? 'Tipsy' : '';
}
/** Deterministic server steering, shared by humans and NPCs. Never changes throttle. */
export function intoxicatedSteer(p: Player, time: number, steer: number) {
  const amount = p.vehicle === 5 ? 0 : impairment(p, time);
  if (!amount) return steer;
  const phase = p.id.split('').reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 0) / 37;
  const weave = Math.sin(time * 1.35 + phase) * 0.42 + Math.sin(time * 0.53 + phase) * 0.22;
  return Math.max(-1, Math.min(1, steer * (1 - amount * 0.28) + weave * amount));
}
