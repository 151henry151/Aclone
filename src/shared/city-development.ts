// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { buildingCategory, townAt } from './town-charter';
import { roadRules } from './road-rules';
export interface CityDevelopment {
  counts: { buildings: number; businesses: number; residents: number };
  qualified: boolean;
  eligibleDays: number;
  shrinkingDays: number;
  policy: string;
}
/** Ownership alone does not make an empty house inhabited. Public premises and
 * staffed/owned businesses count without requiring an online owner. */
export function occupiedCityBuildings(w: World): Building[] {
  const homes = new Set(Object.values(w.players).map((p) => p.home));
  return w.buildings.filter(
    (b) =>
      !b.construction &&
      (b.kind === 'home'
        ? homes.has(b.id)
        : b.government ||
          homes.has(b.id) ||
          b.employees.some((id) => !!w.players[id]) ||
          (!!b.owner && !!w.players[b.owner])),
  );
}
export function assessCityDevelopment(w: World, start: number, end: number) {
  const length = w.settings.dayLength;
  if (!(length > 0)) return;
  const day = Math.floor(end / length),
    prior =
      w.cityDayLength !== length
        ? Math.floor(start / length)
        : (w.cityAssessedDay ?? Math.floor(start / length));
  if (day <= prior) return;
  // A legacy save has no evidence of past sustained development. Observe at most
  // its first day, even when catch-up requests years of elapsed time.
  const days = w.cityDayLength !== length || w.cityAssessedDay === undefined ? 1 : day - prior;
  const r = roadRules(w.settings),
    policy = JSON.stringify([
      length,
      r.cityBuildings,
      r.cityBusinesses,
      r.cityResidents,
      r.cityQualificationDays,
      r.cityDemotionDays,
      r.cityRetentionFraction,
    ]);
  const occupied = occupiedCityBuildings(w),
    players = Object.values(w.players);
  const byTown = new Map<string, Building[]>();
  for (const b of occupied) {
    const town = townAt(w, b.x, b.z);
    if (town) {
      const list = byTown.get(town.id) ?? [];
      list.push(b);
      byTown.set(town.id, list);
    }
  }
  const state = (w.cityDevelopment ??= {});
  for (const town of w.towns) {
    const buildings = byTown.get(town.id) ?? [],
      homes = new Set(buildings.map((b) => b.id));
    const counts = {
      buildings: buildings.length,
      businesses: buildings.filter(
        (b) => !['residential', 'civic'].includes(buildingCategory(w, b.kind)),
      ).length,
      residents: new Set([
        ...players.filter((p) => p.home && homes.has(p.home)).map((p) => p.id),
        ...town.residents.filter((id) => !!w.players[id]),
      ]).size,
    };
    const old = state[town.id],
      changed = old?.policy !== policy;
    const current = (state[town.id] = {
      counts,
      qualified: old?.qualified ?? false,
      eligibleDays: changed ? 0 : old.eligibleDays,
      shrinkingDays: changed ? 0 : old.shrinkingDays,
      policy,
    });
    const elapsed = changed ? 1 : days;
    const enough =
      counts.buildings >= r.cityBuildings &&
      counts.businesses >= r.cityBusinesses &&
      counts.residents >= r.cityResidents;
    const retained =
      counts.buildings >= r.cityBuildings * r.cityRetentionFraction &&
      counts.businesses >= r.cityBusinesses * r.cityRetentionFraction &&
      counts.residents >= r.cityResidents * r.cityRetentionFraction;
    if (current.qualified) {
      current.shrinkingDays = retained ? 0 : current.shrinkingDays + elapsed;
      if (current.shrinkingDays >= r.cityDemotionDays) {
        current.qualified = false;
        current.eligibleDays = 0;
      }
    } else {
      current.eligibleDays = enough ? current.eligibleDays + elapsed : 0;
      if (current.eligibleDays >= r.cityQualificationDays) {
        current.qualified = true;
        current.shrinkingDays = 0;
      }
    }
  }
  for (const id of Object.keys(state)) if (!w.towns.some((t) => t.id === id)) delete state[id];
  w.cityAssessedDay = day;
  w.cityDayLength = length;
}
