// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { townCharter } from '../../shared/town-charter.ts';
import { mapHalf, terrainHeight } from '../../shared/terrain.ts';
import { household, householdBudget } from './household.ts';
import { retainedCapital } from './business-policy.ts';
import { constructionBudget } from './construction-projects.ts';
import { travelPrep } from './travel.ts';
import { operation } from './player-operations.ts';
import type { FarmerChoice } from './farmer.ts';

/** Optional late-career ambition; ordinary foundTown still validates the site and charges the charter. */
export function settlementChoices(w: World, p: Player): FarmerChoice[] {
  const charter = townCharter(w);
  if (
    p.task ||
    p.learning ||
    !charter.founding ||
    w.towns.length >= charter.maxTowns ||
    (charter.foundingSkill && !p.skills.includes(charter.foundingSkill)) ||
    !household(w, p)
  )
    return [];
  if (w.towns.some((t) => t.founder === p.id)) return [];
  const holdings = w.buildings.filter(
    (b) => b.owner === p.id && !b.government && !['home', 'warehouse'].includes(b.kind),
  );
  if (
    !holdings.length ||
    holdings.some((b) => b.construction || b.investment < retainedCapital(w, b)) ||
    !holdings.some((b) => (b.accounts?.receipts ?? 0) > 0)
  )
    return [];
  const living = householdBudget(w, p, 86400).reserve;
  if (p.cash < living + charter.foundingCost * 4) return [];
  const half = mapHalf(w) - charter.initialRadius;
  for (const distance of [Math.max(600, charter.minSpacing + charter.initialRadius), 1000, 1400])
    for (let i = 0; i < 12; i++) {
      const site = {
        x: Math.round(p.x + Math.cos((i * Math.PI) / 6) * distance),
        z: Math.round(p.z + Math.sin((i * Math.PI) / 6) * distance),
      };
      if (
        Math.abs(site.x) > half ||
        Math.abs(site.z) > half ||
        terrainHeight(w, site.x, site.z) <= w.settings.seaLevel + 1 ||
        w.towns.some(
          (t) =>
            Math.hypot(t.x - site.x, t.z - site.z) <
            Math.max(charter.minSpacing, t.radius + charter.initialRadius),
        ) ||
        w.buildings.some((b) => Math.hypot(b.x - site.x, b.z - site.z) <= 20) ||
        w.zones.some(
          (z) => z.kind === 'noBuild' && Math.hypot(z.x - site.x, z.z - site.z) < z.radius,
        )
      )
        continue;
      const cottage = constructionBudget(w, p, 'home', site);
      if (!cottage || p.cash < charter.foundingCost + cottage.total + living) continue;
      const base = `${p.name.split(' ')[0]}'s Reach`;
      let name = base;
      for (let n = 2; w.towns.some((t) => t.name.toLowerCase() === name.toLowerCase()); n++)
        name = `${base} ${n}`;
      const stages = Math.ceil(distance / 300);
      const route = Array.from({ length: stages }, (_, j) => ({
        kind: 'move' as const,
        x: p.x + ((site.x - p.x) * (j + 1)) / stages,
        z: p.z + ((site.z - p.z) * (j + 1)) / stages,
      }));
      const plan = [...travelPrep(p), ...route, operation('foundTown', { name })];
      if (plan.length > 12) continue;
      return [
        {
          id: 'civic_found_town',
          description: `Found a new town, ${name}, at ${site.x}, ${site.z}: charter ${charter.foundingCost}, retain at least ${cottage.total + living} for settlement and household needs. Existing businesses have operating reserves. A distant town has no guaranteed residents or income; compare staying and expanding here.`,
          plan,
          reconsiderSeconds: 1800,
        },
      ];
    }
  return [];
}
