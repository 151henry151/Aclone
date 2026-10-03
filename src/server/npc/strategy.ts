// SPDX-License-Identifier: GPL-3.0-or-later
import { propertyQuote } from '../../shared/property.ts';
import { businessEstimate } from './enterprise.ts';
import { items } from '../../shared/catalog.ts';
import { distance } from '../../shared/simulation.ts';
import { shelter } from '../../shared/lodging.ts';
import type { Player, World } from '../../shared/types.ts';
import { workplace } from './workplace.ts';
import { offlineReadiness } from './homecoming.ts';

/** Match usable(): the third consecutive serving of the same food OR drink is halved. */
export function nextNutrition(p: Player, item: string) {
  const scale = p.lastFood === item && p.repeats >= 1 ? 0.5 : 1;
  return { food: (items[item]?.food ?? 0) * scale, drink: (items[item]?.drink ?? 0) * scale };
}
export function secondsToDamage(w: World, p: Player) {
  return Math.max(
    0,
    Math.min(
      ...(
        [
          [p.hunger, w.settings.hungerRate],
          [p.thirst, w.settings.thirstRate],
        ] as const
      ).map(([value, rate]) => (value >= 50000 ? 0 : rate > 0 ? (50000 - value) / rate : Infinity)),
    ),
  );
}
/** Wake once as needs cross into meal-planning territory, rather than near starvation. */
export function careNeeded(w: World, p: Player) {
  if (shelter(w, p) && offlineReadiness(w, p, 600).stocked) return false;
  return p.hunger >= 25000 || p.thirst >= 25000 || secondsToDamage(w, p) <= 600 || p.health < 30000;
}
/** Surplus for optional sales/production: keep at least one meal and two drinks of each kind. */
export function spareSupplies(p: Player, item: string) {
  return Math.max(
    0,
    (p.inventory[item] ?? 0) - (items[item]?.drink ? 2 : items[item]?.food ? 1 : 0),
  );
}
/** Small, protected Jev context. All prices/rates are live; none of these forecasts grant supplies. */
export function lifeBriefing(w: World, p: Player) {
  const carried = Object.entries(p.inventory)
    .filter(([item, n]) => n > 0 && (items[item]?.food || items[item]?.drink))
    .map(([item, count]) => ({
      item,
      count,
      nextFood: nextNutrition(p, item).food,
      nextDrink: nextNutrition(p, item).drink,
    }));
  const supplies = Object.entries(items)
    .filter(([, def]) => def.food || def.drink)
    .flatMap(([item]) => {
      const sellers = w.buildings.filter(
        (b) =>
          !b.construction &&
          b.owner !== p.id &&
          b.stock[item] > 0 &&
          Number.isSafeInteger(b.sell[item]) &&
          b.sell[item] >= 0,
      );
      // A cheapest and a nearest stocked option make the cost/distance tradeoff explicit.
      const cheap = [...sellers].sort((a, b) => a.sell[item] - b.sell[item])[0];
      const near = [...sellers].sort((a, b) => distance(p, a) - distance(p, b))[0];
      return [...new Set([cheap, near])]
        .filter((b) => !!b)
        .map((b) => ({
          item,
          shop: b.id,
          price: b.sell[item],
          stock: b.stock[item],
          metres: Math.round(distance(p, b)),
          ...nextNutrition(p, item),
        }));
    });
  const meal = supplies
    .filter((s) => s.food > 0)
    .sort((a, b) => a.price / a.food - b.price / b.food)[0];
  const drink = supplies
    .filter((s) => s.drink > 0)
    .sort((a, b) => a.price / a.drink - b.price / b.drink)[0];
  const time = secondsToDamage(w, p);
  return {
    survival: {
      needsAttention: careNeeded(w, p),
      sheltered: !!shelter(w, p),
      secondsToDamageOutside: Number.isFinite(time) ? Math.floor(time) : null,
      forecast:
        'Seconds until either need reaches 50000 outdoors without consumption, NOT time until death. null means no rising needs. Shelter slows needs to 80% and automatically consumes its own stores at 30000; carried food is not automatically eaten outdoors.',
      hungerPerSecond: w.settings.hungerRate,
      thirstPerSecond: w.settings.thirstRate,
      healthRule:
        'Below starvation, health recovers 2/second to 60000; at starvation it loses 6/second, online or offline. Waiting outdoors cannot lower needs.',
      carried,
      supplies,
      suggestedLivingCash: Math.max(12000, (meal?.price ?? 0) * 3 + (drink?.price ?? 0) * 6),
      reserveAvailable: !!meal && !!drink,
    },
    economy: {
      businesses: w.buildings
        .filter((b) => !b.government && !b.construction)
        .map((b) => ({
          id: b.id,
          owner: b.owner ?? null,
          price: propertyQuote(w, b).total,
          ...businessEstimate(w, b),
        }))
        .filter((b) => b.margin !== undefined)
        .sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))
        .slice(0, 8),
      jobs: w.buildings
        .filter(
          (b) =>
            !b.construction && b.owner !== p.id && b.kind !== 'farm' && (b.recipe || b.production),
        )
        .map((b) => {
          const job = workplace(w, p, b)!;
          return {
            id: b.id,
            current: b.id === p.job,
            qualified: job.qualified,
            skill: job.recipe.skill,
            metres: Math.round(distance(p, b)),
            netCashPerCycle: b.wage - Math.floor(b.wage * w.settings.wageTax),
            cycleSeconds: job.intervalSeconds,
            nextCycleSeconds: job.nextCycleInSeconds,
            shiftCoversNextCycle: job.workActiveNextCycle,
            ownerCapitalShortfall: job.ifYouWork.capitalShortfall,
            blockers: job.blockers.filter((v) => !v.startsWith('No active employees')),
          };
        })
        .sort(
          (a, b) =>
            Number(b.current) - Number(a.current) ||
            Number(a.ownerCapitalShortfall > 0 || !!a.blockers.length) -
              Number(b.ownerCapitalShortfall > 0 || !!b.blockers.length) ||
            b.netCashPerCycle / b.cycleSeconds - a.netCashPerCycle / a.cycleSeconds,
        )
        .slice(0, 5),
      jobEstimates:
        'Per completed batch; no wage when inputs, capital or output space block production. Taking a qualified vacancy may supply the missing worker. Compare travel and tuition before changing careers.',
      labour:
        'Odd Jobs Office pays 4500 cash for a completed 15-second labour task, no qualification. Useful to bootstrap meals, tools or tuition; travel takes extra time.',
      training: {
        tuition: p.skills.length ? 16000 : 8000,
        seconds: p.skills.length ? 2400 : 60,
        learning: p.learning ?? null,
      },
      ownership:
        'Before purchase/building, retain living cash PLUS materials, inputs and wages. Unfinished sites cannot operate. Owners cannot work for wages at their own buildings. Stock and capital alone do not ensure staffed production or sales.',
      trading:
        'Building sell=your purchase cost; building buy=your sale proceeds. Only stocked sellers and funded buyers with space can trade. Compare full route time/fuel, not just margin; existing personal food and employer stock are not spare cargo.',
    },
  };
}
