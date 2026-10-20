// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { combatBases } from './combat';
import type { World, Player, Action } from './types';
export const roundCycleSchema = z.object({
  build: z.number().int().min(60).max(86400),
  peace: z.number().int().min(60).max(86400),
  war: z.number().int().min(60).max(86400),
});
export type RoundCycle = {
  rules: z.infer<typeof roundCycleSchema>;
  start: number;
  phase: 'build' | 'peace' | 'war';
  slot: number;
  previousFighting: boolean;
  history: { round: number; ended: number; scores: number[] }[];
};
export function roundCycleAction(w: World, p: Player, a: Action) {
  if (p.id !== w.owner && p.authority < 20) throw Error('World caretaker required');
  if (a.operation === 'disable') {
    if (w.roundCycle) w.settings.fighting = w.roundCycle.previousFighting;
    delete w.roundCycle;
    return 'Persistent play restored.';
  }
  if (w.roundCycle) throw Error('Disable the current cycle before replacing it');
  const rules = roundCycleSchema.parse(a.rules);
  w.roundCycle = {
    rules,
    start: w.time,
    phase: 'build',
    slot: 0,
    previousFighting: w.settings.fighting,
    history: [],
  };
  w.settings.fighting = false;
  w.projectiles = [];
  return 'Build / peace / war cycle started. Property and survival remain persistent; combat scores are archived.';
}
export function tickRoundCycle(w: World) {
  const r = w.roundCycle;
  if (!r) return;
  const total = r.rules.build + r.rules.peace + r.rules.war,
    elapsed = Math.max(0, w.time - r.start),
    slot = Math.floor(elapsed / total),
    at = elapsed % total;
  const phase = at < r.rules.build ? 'build' : at < r.rules.build + r.rules.peace ? 'peace' : 'war';
  if (slot !== r.slot) {
    r.history.push({
      round: r.slot,
      ended: r.start + (r.slot + 1) * total,
      scores: [...(w.combat?.scores ?? [0, 0])],
    });
    r.history = r.history.slice(-100);
    w.roundArchive = [...(w.roundArchive ?? []), r.history.at(-1)!].slice(-100);
    r.slot = slot;
    if (w.combat) {
      w.combat.scores = [0, 0];
      w.combat.restart = undefined;
      delete w.combat.winner;
      w.combat.flags = combatBases(w).map((b) => ({ ...b }));
      w.combat.ends = w.time + r.rules.war;
    }
  }
  if (phase !== r.phase) {
    w.projectiles = [];
    if (phase === 'war' && w.combat) {
      w.combat.ends = r.start + slot * total + total;
      w.combat.restart = undefined;
    }
  }
  r.phase = phase;
  w.settings.fighting = phase === 'war';
}
