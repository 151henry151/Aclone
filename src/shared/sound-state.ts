import { herdReady } from './livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { waterworksSite } from './shoreline.ts';
import { recipes, vehicles } from './catalog';
import type { Building, Player, Recipe, World } from './types';

/** Snapshot projection; don't expose fuel stores or other private player data. */
export function motorRunning(w: World, p: Player): boolean {
  const v = { ...vehicles[p.vehicle], ...w.vehicleTuning?.[p.vehicle] };
  return !!(
    p.online &&
    !p.atHome &&
    !p.hitch &&
    p.health > 0 &&
    vehicles[p.vehicle]?.fuel > 0 &&
    p.engine &&
    (v.fuel === 0 || p.fuel > 0)
  );
}

export function productionStaff(w: World, b: Building, at: number) {
  return b.employees
    .map((id) => w.players[id])
    .filter((p) => p && p.id !== b.owner && (!w.settings.activeWork || p.activeUntil >= at));
}

/** Staffing efficiency right now; supply checks still determine whether a batch runs. */
export function productionEfficiency(
  w: World,
  b: Building,
  staff = productionStaff(w, b, w.time).length,
): number {
  if (!herdReady(b)) return 0;
  if (b.kind === 'waterworks' && !waterworksSite(w, b, b.rotation)) return 0;
  return b.government || staff ? 1 : w.settings.offlineEfficiency;
}

/** Shared by the economic cycle and its audible activity projection. */
export function productionSupplied(
  b: Building,
  r: Recipe,
  staff: number,
  upkeepPaid = false,
): boolean {
  return (
    herdReady(b) &&
    !Object.entries(r.inputs).some(
      ([item, n]) =>
        !(upkeepPaid && b.kind === 'dairy' && ['feed', 'water'].includes(item)) &&
        (b.stock[item] ?? 0) < n,
    ) &&
    !Object.entries(r.outputs).some(([item, n]) => (b.stock[item] ?? 0) + n > b.capacity) &&
    b.investment >= b.wage * staff
  );
}

export function productionActivity(w: World, b: Building, crafting = new Set<string>()): number {
  if (b.construction || b.condition <= 0 || b.kind === 'farm') return 0;
  if (b.kind === 'waterworks' && !waterworksSite(w, b, b.rotation)) return 0;
  if (crafting.has(b.id)) return 1;
  const r = b.production ?? (b.recipe && recipes[b.recipe]);
  if (!r) return 0;
  const staff = productionStaff(w, b, w.time);
  if (!productionSupplied(b, r, staff.length)) return 0;
  return productionEfficiency(w, b, staff.length);
}

/** One scan per broadcast, including hand crafting which consumes inputs up front. */
export function craftingBuildings(w: World): Set<string> {
  return new Set(
    Object.values(w.players)
      .filter((p) => p.online && p.task?.kind === 'craft' && p.task.end > w.time)
      .map((p) => p.task!.building!),
  );
}
