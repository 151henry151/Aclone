import { waterLevel } from './ocean';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Player, Stock, World } from './types';
import { FISHING_BOAT, boatSlot } from './boats';
import { accounts, addQuantities, recordLife } from './reports';
import { questEvent } from './quests';
import { queueCreatorScript } from './creator';
import { boatLanding } from './boathouse';
import { worldItems } from './world-catalogue';
import { buildings, vehicles } from './catalog';
import { travelHeight } from './dock';
import { switchVehicle } from './tractors';
import { log, say } from './simulation';
export const seaFish = ['fish', 'largeFish', 'cod', 'halibut', 'tuna'];
export interface FishingVoyage {
  members: Record<string, number>;
  offers: Record<string, number>;
  departed: boolean;
  caught: Stock;
  expenses: number;
  fuelPrice: number;
  provisionPrices: Record<string, number>;
}
function need(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(reason);
}
export function stockWeight(w: World | undefined, stock: Stock = {}) {
  const defs = worldItems(w);
  return Object.entries(stock).reduce((s, [id, n]) => s + n * (defs[id]?.weight ?? 0), 0);
}
export function vesselStoresWeight(w: World | undefined, p: Player) {
  return p.vehicle === FISHING_BOAT ? stockWeight(w, p.boatStores) : 0;
}
export function deckhands(w: World, p: Player) {
  return Object.keys(p.fishingVoyage?.members ?? {}).filter((id) => w.players[id]?.hitch === p.id);
}
export function fishingCrewCaptain(w: World, p: Player) {
  const captain = p.hitch ? w.players[p.hitch] : undefined;
  return captain?.fishingVoyage?.members[p.id] ? captain : undefined;
}
export function boatPantry(w: World, p: Player) {
  const captain = fishingCrewCaptain(w, p);
  // Stores remain on the main vessel during an emergency rowing trip.
  if (captain?.vehicle === FISHING_BOAT) return captain.boatStores;
  if (p.vehicle === FISHING_BOAT && !p.hitch && !p.online) return p.boatStores;
}
export function startVoyage(w: World, p: Player) {
  if (p.fishingVoyage) return p.fishingVoyage;
  const dock = boatLanding(w, p, true)?.building;
  const defs = worldItems(w);
  p.fishingVoyage = {
    members: {},
    offers: {},
    departed: false,
    caught: {},
    expenses: 0,
    fuelPrice: (dock?.sell.fuel ?? buildings.boathouse.sell.fuel) / (defs.fuel?.fuel ?? 8),
    provisionPrices: Object.fromEntries(
      Object.entries(defs)
        .filter(([, d]) => d.food || d.drink)
        .map(([id, d]) => [id, dock?.sell[id] ?? d.price]),
    ),
  };
  return p.fishingVoyage;
}
export function fishingLoad(w: World, p: Player) {
  // The unlanded net remains visually approximate in prediction as well as UI.
  const net =
    p.trawl?.activity ??
    (stockWeight(w, p.trawl?.catch) <= 0
      ? 0
      : stockWeight(w, p.trawl?.catch) < 80
        ? 1
        : stockWeight(w, p.trawl?.catch) < 240
          ? 2
          : stockWeight(w, p.trawl?.catch) < 480
            ? 3
            : 4);
  return Math.min(
    1,
    (stockWeight(w, p.inventory) + stockWeight(w, p.boatStores) + net * 160) /
      vehicles[FISHING_BOAT].capacity,
  );
}
export function boatLoadFactors(w: World, p: Player) {
  if (p.vehicle !== FISHING_BOAT) return { speed: 1, fuel: 1 };
  const cargo = fishingLoad(w, p),
    bunker = Math.min(1, p.fuel / (vehicles[FISHING_BOAT].tank ?? 1));
  return { speed: 1 - cargo * 0.22 - bunker * 0.08, fuel: 1 + cargo * 0.35 + bunker * 0.15 };
}
export function voyageFuel(w: World, p: Player, spent: number) {
  if (p.vehicle !== FISHING_BOAT) return;
  const v = p.fishingVoyage ?? (spent > 0 ? startVoyage(w, p) : undefined);
  if (!v) return;
  v.expenses += spent * v.fuelPrice;
  if (!boatLanding(w, p, true)) v.departed = true;
}
export function voyageMeals(w: World, p: Player, before: Stock, after: Stock) {
  const captain = fishingCrewCaptain(w, p) ?? p,
    v = captain.fishingVoyage;
  if (v)
    for (const [id, n] of Object.entries(before))
      v.expenses += Math.max(0, n - (after[id] ?? 0)) * (v.provisionPrices[id] ?? 0);
}
export function fishingOffers(w: World, p: Player) {
  return Object.values(w.players)
    .filter((c) => c.fishingVoyage?.offers[p.id] && !c.fishingVoyage.departed)
    .map((c) => ({
      captain: c.id,
      name: c.name,
      share: c.fishingVoyage!.offers[p.id],
      fuelPrice: c.fishingVoyage!.fuelPrice,
    }));
}
export function expeditionAction(w: World, p: Player, a: Action) {
  if (a.operation === 'accept' || a.operation === 'decline') {
    const captain = w.players[String(a.captain)],
      v = captain?.fishingVoyage;
    need(v && v.offers[p.id], 'That crew offer is no longer available');
    if (a.operation === 'decline') {
      delete v.offers[p.id];
      return 'Crew offer declined';
    }
    const dock = boatLanding(w, captain, true);
    need(
      !v.departed &&
        captain.vehicle === FISHING_BOAT &&
        !captain.hitch &&
        Math.abs(captain.speed) < 0.5 &&
        dock &&
        boatLanding(w, p, false, dock.id),
      'Both of you must be at the same dock before departure',
    );
    need(
      !p.hitch &&
        !p.atHome &&
        !p.task &&
        !p.game &&
        !p.crowBody &&
        !boatSlot(p.vehicle) &&
        Math.abs(p.speed) < 0.5 &&
        Math.abs(p.y - travelHeight(w, p.x, p.z)) < 2,
      'Finish your activity before joining the crew',
    );
    need(
      Object.keys(v.members).length < 2 &&
        Object.values(w.players).filter((q) => q.hitch === captain.id).length < 2,
      'The two berths are taken by deckhands or recovery passengers',
    );
    need(
      Object.values(v.members).reduce((s, n) => s + n, 0) + v.offers[p.id] <= 50,
      'The offered shares exceed half the profit',
    );
    v.members[p.id] = v.offers[p.id];
    delete v.offers[p.id];
    p.hitch = captain.id;
    Object.assign(p, { x: captain.x, z: captain.z, y: captain.y + 2, speed: 0 });
    return `Joined ${captain.name}: ${v.members[p.id]}% of realised expedition profit after fuel and consumed provisions. No pay on a loss. Remain aboard until return.`;
  }
  need(p.vehicle === FISHING_BOAT && !p.hitch && !p.atHome, 'Board your fishing boat first');
  if (a.operation === 'refuel') {
    const tank = vehicles[FISHING_BOAT].tank!,
      units = worldItems(w).fuel.fuel!;
    const n = Math.min(p.inventory.fuel ?? 0, Math.ceil((tank - p.fuel) / units));
    need(n > 0, 'Carry Fuel and leave room in the tank');
    p.inventory.fuel -= n;
    p.fuel = Math.min(tank, p.fuel + n * units);
    return `Used ${n} Fuel to fill the tank to ${p.fuel.toFixed(1)} units`;
  }
  if (a.operation === 'store' || a.operation === 'take') {
    const id = String(a.item),
      d = worldItems(w)[id],
      n = Number(a.quantity ?? 1);
    need(d && (d.food || d.drink) && !d.fuel, 'Boat stores accept food and drink');
    need(Number.isSafeInteger(n) && n > 0 && n <= 10000, 'Choose a whole positive quantity');
    const stores = (p.boatStores ??= {});
    if (a.operation === 'store') {
      need((p.inventory[id] ?? 0) >= n, 'Not enough carried provisions');
      stores[id] = (stores[id] ?? 0) + n;
      p.inventory[id] -= n;
    } else {
      need((stores[id] ?? 0) >= n, 'Not enough provisions in the boat stores');
      // Manual captain meals use the ordinary use action after withdrawing.
      stores[id] -= n;
      p.inventory[id] = (p.inventory[id] ?? 0) + n;
    }
    return a.operation === 'store'
      ? 'Provisions stored aboard'
      : 'Provisions taken from boat stores';
  }
  const dock = boatLanding(w, p, true);
  need(dock && Math.abs(p.speed) < 0.5, 'Return to a dock and stop first');
  if (a.operation === 'offer') {
    const q = w.players[String(a.player)],
      share = Number(a.share);
    need(q && q.id !== p.id && q.online, 'Choose another online player');
    need(Number.isInteger(share) && share >= 5 && share <= 25, 'Offer 5–25 percent of profit');
    const v = startVoyage(w, p);
    need(
      !v.departed && Object.keys(v.members).length < 2 && !v.members[q.id],
      'Crew terms are fixed once you depart',
    );
    need(Object.keys(v.offers).length < 16 || v.offers[q.id], 'Too many outstanding offers');
    v.offers[q.id] = share;
    say(
      w,
      'Crew offer',
      `${p.name} offers you ${share}% of expedition profit. Open Inventory to review and accept or decline.`,
      'system',
      q.id,
    );
    return `Offered ${q.name} ${share}% of realised profit, after consumed fuel and provisions. They must accept at this dock.`;
  }
  if (a.operation === 'cancel') {
    const v = p.fishingVoyage;
    need(v && !v.departed, 'Cannot cancel crew agreements at sea');
    const id = String(a.player);
    need(!v.members[id], 'An accepted deckhand must leave voluntarily or finish the expedition');
    delete v.offers[id];
    return 'Offer withdrawn';
  }
  need(a.operation === 'finish', 'Unknown expedition operation');
  const v = p.fishingVoyage;
  need(v, 'No expedition to settle');
  need(!p.trawl?.deployed && !stockWeight(w, p.trawl?.catch), 'Haul and stow the net first');
  const cargo = Object.entries(v.caught)
    .filter(([id, n]) => n > 0 && (p.inventory[id] ?? 0) > 0)
    .map(([id, n]) => [id, Math.min(n, p.inventory[id])] as const);
  const b = dock.building;
  let receipts = 0;
  for (const [id, n] of cargo) {
    need(
      b && !b.construction && Number.isSafeInteger(b.buy[id]) && b.buy[id] > 0,
      'This dock cannot buy the expedition catch',
    );
    need(
      (b.stock[id] ?? 0) + n <= b.capacity,
      'The buyer needs more storage before this catch can be landed',
    );
    receipts += n * b.buy[id];
  }
  need(
    !receipts || (b && b.investment >= receipts),
    'The buyer needs more working cash to pay for this landing',
  );
  for (const [id, n] of cargo) {
    p.inventory[id] -= n;
    b!.stock[id] = (b!.stock[id] ?? 0) + n;
    log(w, 'transfer', n * b!.buy[id], b!.id, p.id, 'sale', {
      building: b!.id,
      item: id,
      quantity: n,
    });
  }
  if (b) {
    b.investment -= receipts;
    for (const [id, n] of cargo) {
      addQuantities(accounts(w, b).bought, { [id]: n });
      questEvent(w, p, 'sell', b.id, id, n);
      queueCreatorScript(w, 'TradeComplete', {
        id: p.id,
        building: b.id,
        item: id,
        quantity: n,
        amount: n * b.buy[id],
        direction: 'sell',
      });
      recordLife(w, p, {
        kind: 'trade',
        text: `Landed ${n} ${id}`,
        building: b.id,
        item: id,
        quantity: n,
        amount: n * b.buy[id],
      });
    }
  }
  p.cash += receipts;
  const profit = Math.max(0, receipts - Math.ceil(v.expenses));
  for (const [id, share] of Object.entries(v.members)) {
    const q = w.players[id];
    if (!q) continue;
    const pay = Math.floor((profit * share) / 100);
    p.cash -= pay;
    q.cash += pay;
    if (pay) log(w, 'transfer', pay, p.id, id, 'deckhand profit share');
    say(
      w,
      'Fishing expedition',
      `${p.name} settled your ${share}% share: ${(pay / 100).toFixed(2)}d. You are ashore.`,
      'system',
      q.id,
    );
    if (q.hitch === p.id) {
      delete q.hitch;
      Object.assign(q, dock.land, { y: travelHeight(w, dock.land.x, dock.land.z), speed: 0 });
    }
  }
  const result = `Expedition settled: receipts ${(receipts / 100).toFixed(2)}d; consumed fuel and provisions ${(v.expenses / 100).toFixed(2)}d; profit ${(profit / 100).toFixed(2)}d. Crew shares paid; crew ashore.`;
  p.lastFishingSettlement = result;
  delete p.fishingVoyage;
  return result;
}

/** A captain's death must not teleport attached crew back to town with them. */
export function endVoyageOnDeath(w: World, p: Player) {
  const captain = fishingCrewCaptain(w, p);
  if (captain) delete captain.fishingVoyage!.members[p.id];
  for (const q of Object.values(w.players).filter((q) => boatSlot(p.vehicle) && q.hitch === p.id)) {
    delete q.hitch;
    switchVehicle(q, 29, false);
    Object.assign(q, { x: p.x, z: p.z, y: waterLevel(w), speed: 0, engine: false });
  }
  delete p.fishingVoyage;
}
