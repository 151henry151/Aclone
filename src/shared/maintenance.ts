// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from './types';
export type Maintenance = {
  paused: boolean;
  history: { paused: boolean; worldTime: number; wallTime: number; actor: string }[];
};
export function maintenanceAction(w: World, p: Player, a: Action) {
  if (p.id !== w.owner && p.authority < 20) throw Error('World caretaker required');
  if (typeof a.paused !== 'boolean') throw Error('Choose pause or resume');
  const state = (w.maintenance ??= { paused: false, history: [] });
  if (state.paused !== a.paused) {
    state.paused = a.paused;
    state.history.push({
      paused: a.paused,
      worldTime: w.time,
      wallTime: Date.now() / 1000,
      actor: p.id,
    });
    state.history = state.history.slice(-100);
  }
  return state.paused
    ? 'World paused for maintenance. Survival, production, loans and activities are frozen.'
    : 'World resumed. Paused time is not replayed; ordinary offline survival continues.';
}
