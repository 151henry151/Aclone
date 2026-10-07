// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import { operation } from './player-operations.ts';

const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });

/** Walk only when the tank is empty. Otherwise get back on the tractor. */
export function travelPrep(p: Player): Step[] {
  return [
    ...(p.atHome ? [act({ type: 'outside' })] : []),
    ...(p.game ? [operation('leaveGame')] : []),
    ...(p.hitch ? [operation('detach')] : []),
    ...(p.crowBody ? [operation('crow')] : []),
    ...(p.vehicle === 5 && p.fuel > 0
      ? [act({ type: 'vehicle', slot: 0 })]
      : p.vehicle !== 5 && p.fuel <= 0
        ? [act({ type: 'vehicle', slot: 5 })]
        : p.vehicle !== 5 && !p.engine
          ? [act({ type: 'engine' })]
          : []),
  ];
}

/** Keep a little cash for the next meal, but never block a single affordable deal. */
export function livingReserve(w: World, p: Player) {
  if (p.hunger >= 25000 || p.thirst >= 25000) return 0;
  return Math.min(4000, Math.max(0, p.cash - 1));
}

export function affordableLoad(cash: number, price: number, reserve: number, max: number) {
  if (price <= 0) return max;
  if (cash < price) return 0;
  return Math.min(max, Math.max(1, Math.floor(Math.max(0, cash - reserve) / price)));
}
