// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { crops } from '../../shared/farming.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { taxTown } from '../../shared/town-charter.ts';
import { livestockSupplyInputs } from '../../shared/livestock.ts';
import { canCarry } from '../../shared/simulation.ts';
import { productionStaffing } from '../../shared/sound-state.ts';
import { journeyEstimate } from './projects.ts';
import { travelVehicle } from './travel.ts';
import { visitBuilding } from './care.ts';
import { operation } from './player-operations.ts';
import type { FarmerChoice } from './farmer.ts';

/** Replacement cost, rather than a zero cost for stock already on the shelf.
 * Call with the resident's perceived world; unknown suppliers are not quotes. */
export function sustainableAsk(w: World, b: Building, item: string) {
  const catalogue = worldItems(w);
  const cost = (id: string) => {
    const offers = w.buildings
      .filter((s) => s.id !== b.id && !s.construction && s.stock[id] > 0 && s.sell[id] > 0)
      .map((s) => s.sell[id]);
    return Math.max(
      b.buy[id] ?? 0,
      offers.length ? Math.min(...offers) : (catalogue[id]?.price ?? 0),
    );
  };
  let unit: number;
  if (b.kind === 'farm' && crops[item]) {
    const crop = crops[item];
    // Budget a modest harvest, a paid farmer, two waterings and compost.
    unit =
      (crop.seed + b.wage + 6 * cost('water') + cost('compost')) /
      Math.max(1, Math.floor(crop.yield * 0.5));
  } else {
    const r = b.production ?? recipes[b.recipe ?? ''];
    if (!r?.outputs[item]) return;
    const inputs = Object.entries(livestockSupplyInputs(w, b, r.inputs)).reduce(
      (n, [id, count]) => n + count * cost(id),
      0,
    );
    const staffing = productionStaffing(w, b);
    const wages =
      b.wage * Math.max(b.employees.length, staffing.ideal - Number(staffing.ownerOperating));
    const outputValue = Object.entries(r.outputs).reduce(
      (n, [id, count]) => n + count * (catalogue[id]?.price ?? 1),
      0,
    );
    unit = ((inputs + wages) * (catalogue[item]?.price ?? 1)) / outputValue;
  }
  const tax = Math.min(1, w.settings.salesTax + (taxTown(w, b.x, b.z)?.salesTax ?? 0));
  return tax < 1 ? Math.max(1, Math.ceil((unit * 1.05) / (1 - tax))) : Infinity;
}

/** Offer a reasoned markdown on surplus, not random percentage changes.
 * A buyer must fund a useful load and the producer must retain its margin. */
export function pricingChoices(w: World, p: Player): FarmerChoice[] {
  const list: FarmerChoice[] = [];
  for (const b of w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government)) {
    for (const [item, current] of Object.entries(b.sell)) {
      const stock = b.stock[item] ?? 0;
      const floor = sustainableAsk(w, b, item);
      if (floor === undefined || stock < Math.max(12, b.capacity * 0.25)) continue;
      const routes = w.buildings
        .flatMap((buyer) => {
          if (
            buyer.id === b.id ||
            buyer.owner === p.id ||
            buyer.construction ||
            !(buyer.buy[item] > 0)
          )
            return [];
          let load = Math.min(
            stock,
            1000,
            buyer.capacity - (buyer.stock[item] ?? 0),
            Math.floor(buyer.investment / buyer.buy[item]),
          );
          const traveller = { ...p, x: b.x, z: b.z, vehicle: travelVehicle(p) };
          while (load > 0 && !canCarry(traveller, item, load, w)) load--;
          if (load < 6) return [];
          const trip = journeyEstimate(w, traveller, [buyer, b]);
          const allowance = Math.max(
            Math.ceil(buyer.buy[item] * 0.08),
            Math.ceil((trip.cost + trip.seconds * 5) / load),
          );
          const ask = buyer.buy[item] - allowance;
          return ask >= floor && ask < current ? [{ buyer, load, ask }] : [];
        })
        .sort((a, b) => b.ask - a.ask);
      const route = routes[0];
      if (!route) continue;
      list.push({
        id: `surplus_price_${b.id}_${item}`,
        description: `Make my surplus ${item} marketable at ${b.name}: ${stock} unsold. Set ask ${route.ask} (was ${current}); known ${route.buyer.name} bids ${route.buyer.buy[item]} and can fund ${route.load}. Leaves a haulier spread for travel/time and stays above estimated production/tax floor ${floor}. Quotes can change; this is not a guaranteed sale.`,
        plan: visitBuilding(p, b, [
          operation('buildingAdmin', { building: b.id, item, side: 'sell', price: route.ask }),
        ]),
        reconsiderSeconds: 600,
      });
    }
  }
  return list.filter((c) => c.plan.length <= 12);
}
