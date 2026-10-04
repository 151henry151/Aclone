// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import type { SupplyGoal } from './survival.ts';
/** Public intentions, not hidden access to anyone's inventory or a stock lock.
 * Anyone may still trade normally. Expiry prevents an abandoned errand blocking help. */
export function publishSupplyIntent(
  w: World,
  p: Player,
  goal: SupplyGoal | undefined,
  progress: boolean,
) {
  const active = (w.supplyIntents ?? []).filter((c) => c.expires > w.time);
  const valid =
    p.online && goal?.world === w.id && goal.deaths === p.deaths && goal.expires > w.time;
  if (!valid) {
    w.supplyIntents = active.filter((c) => c.player !== p.id);
    return;
  }
  const own = active.find(
    (c) => c.player === p.id && c.building === goal.building && c.item === goal.item,
  );
  if (own) {
    if (progress) own.expires = Math.min(goal.expires, w.time + 600);
    w.supplyIntents = active;
    return;
  }
  if (!progress) {
    w.supplyIntents = active;
    return;
  }
  w.supplyIntents = active.filter((c) => c.player !== p.id);
  w.supplyIntents.push({
    player: p.id,
    name: p.name,
    building: goal.building,
    item: goal.item,
    expires: Math.min(goal.expires, w.time + 600),
  });
}
export function anotherSupplier(w: World, p: Player, building: string, item: string) {
  return w.supplyIntents?.find(
    (c) => c.player !== p.id && c.building === building && c.item === item && c.expires > w.time,
  );
}
