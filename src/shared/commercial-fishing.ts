import { isTrawler } from './vehicle-config';
import { vehicleDef } from './vehicle-config';
import { startVoyage, stockWeight, deckhands, boatLoadFactors } from './fishing-expedition';
// SPDX-License-Identifier: GPL-3.0-or-later
import { FISHING_BOAT } from './boats';
import { deepFishingWater, fishingGroundQuality } from './fishing-water';
import { vehicles } from './catalog';
import { worldItems } from './world-catalogue';
import { recordGathered } from './player-statistics';
import type { Player, Stock, World } from './types';

// A balance reference interval, not a required tow duration or completion timer.
export const TRAWL_REFERENCE_SECONDS = 720;
export const TRAWL_FUEL_PER_SECOND = 8.5 / 60;
export const TRAWL_SPEED = 2.4;
export const NET_CAPACITY = 640;
export const SHOAL_MEAN_SECONDS = 360;
/** Expected fish per reference interval while in each kind of fishing ground.
 * The ground can change during a trip; individual arrivals are random. */
export const FISHING_GROUNDS = [
  { chance: 0.3, catch: { cod: 4 } },
  { chance: 0.6, catch: { cod: 9, halibut: 1 } },
  { chance: 0.1, catch: { cod: 16, halibut: 5, tuna: 2 } },
] as const;
type Trawl = NonNullable<Player['trawl']>;
type Random = () => number;
function groundIndex(random: Random, quality = 0) {
  const roll = random();
  return roll < 0.3 - quality * 0.05 ? 0 : roll < 0.9 - quality * 0.15 ? 1 : 2;
}
function delay(mean: number, random: Random) {
  return -Math.log(1 - Math.min(1 - 1e-12, Math.max(1e-12, random()))) * mean;
}
function catchDelay(ground: number, random: Random) {
  const count = Object.values(FISHING_GROUNDS[ground].catch).reduce((sum, n) => sum + n, 0);
  return delay(TRAWL_REFERENCE_SECONDS / count, random);
}
function species(ground: number, random: Random) {
  const weights = Object.entries(FISHING_GROUNDS[ground].catch);
  let roll = random() * weights.reduce((sum, [, n]) => sum + n, 0);
  for (const [id, n] of weights) {
    roll -= n;
    if (roll < 0) return id;
  }
  return weights[weights.length - 1][0];
}
/** Upgrade old partial tows once, preserving their paid progress and ready catches.
 * The encounter clock survives hauling, stowing, docking and reconnecting so none
 * of those actions provide a free reroll of an unproductive fishing ground. */
function continuousTrawl(t: Trawl, random: Random, quality = 0): Trawl {
  if (t.shoal) return { ...t, catch: t.catch ? { ...t.catch } : undefined, shoal: { ...t.shoal } };
  const ground = groundIndex(random, quality);
  let caught = t.catch;
  if (!caught && t.seconds > 0) {
    const fraction = Math.min(1, t.seconds / TRAWL_REFERENCE_SECONDS);
    caught = Object.fromEntries(
      Object.entries(FISHING_GROUNDS[ground].catch)
        .map(([id, n]) => [id, Math.floor(n * fraction)] as const)
        .filter(([, n]) => n > 0),
    );
    if (!Object.keys(caught).length) caught = undefined;
  }
  return {
    ...t,
    catch: caught,
    shoal: {
      ground,
      nextChange: delay(SHOAL_MEAN_SECONDS, random),
      nextFish: catchDelay(ground, random),
    },
  };
}
export function trawlWater(w: World, p: Pick<Player, 'x' | 'z'>) {
  return deepFishingWater(w, p);
}
export function netWeight(w: World, caught: Stock = {}) {
  const defs = worldItems(w);
  return Object.entries(caught).reduce((sum, [id, n]) => sum + n * (defs[id]?.weight ?? 0), 0);
}
/** Whitelist network fields: even the skipper cannot inspect hidden fish or RNG. */
export function visibleTrawl(w: World, p: Player) {
  const t = p.trawl;
  if (!t) return undefined;
  const weight = netWeight(w, t.catch);
  return {
    deployed: t.deployed,
    netFull: !!t.netFull,
    holdFull: !!t.holdFull,
    hauledAt: t.hauledAt,
    deckLoad:
      Math.round(
        Math.min(
          1,
          netWeight(
            w,
            Object.fromEntries(
              Object.entries(p.inventory).filter(([id]) =>
                ['cod', 'halibut', 'tuna', 'fish', 'largeFish'].includes(id),
              ),
            ),
          ) / vehicleDef(w, p.vehicle).capacity,
        ) * 5,
      ) / 5,
    activity:
      weight <= 0
        ? 0
        : weight < (vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY) / 8
          ? 1
          : weight < ((vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY) * 3) / 8
            ? 2
            : weight < ((vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY) * 3) / 4
              ? 3
              : 4,
  };
}
export function trawlLoad(w: World, p: Player, caught = p.trawl?.catch) {
  const defs = worldItems(w);
  return (
    stockWeight(w, p.boatStores) +
    [p.inventory, caught ?? {}].reduce(
      (total, stock) =>
        total +
        Object.entries(stock).reduce((sum, [id, n]) => sum + n * (defs[id]?.weight ?? 0), 0),
      0,
    )
  );
}
function need(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(reason);
}
export function trawlAction(w: World, p: Player, operation: unknown) {
  need(
    isTrawler(p.vehicle, w) && !p.hitch && !p.atHome && !p.crowBody && !p.task && !p.game,
    'Board your fishing boat and finish other activities first',
  );
  need(['stow', 'haul', 'deploy'].includes(String(operation)), 'Unknown net operation');
  if (p.trawl) p.trawl = continuousTrawl(p.trawl, Math.random, fishingGroundQuality(w, p));
  const t = p.trawl;
  if (operation === 'stow') {
    need(t?.deployed, 'Your nets are already stowed');
    p.trawl = { ...t, deployed: false };
    return netWeight(w, t.catch) > 0
      ? 'Towing stopped. Haul your catch aboard or deploy the nets to resume fishing.'
      : 'Nets stowed.';
  }
  if (operation === 'haul') {
    need(t, 'Deploy the nets first');
    need(
      trawlLoad(w, p) <= vehicleDef(w, p.vehicle).capacity,
      'Make room in your hold; your fish remain saved in the net',
    );
    const defs = worldItems(w);
    for (const [id, n] of Object.entries(t.catch ?? {})) {
      p.inventory[id] = (p.inventory[id] ?? 0) + n;
      recordGathered(w, p, id, n);
      if (p.fishingVoyage) p.fishingVoyage.caught[id] = (p.fishingVoyage.caught[id] ?? 0) + n;
    }
    const message =
      netWeight(w, t.catch) === 0
        ? 'Net hauled: no fish. Nets stowed.'
        : `Catch aboard: ${Object.entries(t.catch ?? {})
            .map(([id, n]) => `${n} ${defs[id]?.name ?? id}`)
            .join(
              ', ',
            )}. Nets stowed. Sell at a funded boathouse, harbour store or spaceport; prices and taxes vary.`;
    p.trawl = {
      ...t,
      catch: undefined,
      deployed: false,
      holdFull: false,
      netFull: false,
      hauledAt: netWeight(w, t.catch) > 0 ? w.time : undefined,
    };
    return message;
  }
  need(w.settings.fishingMode !== 0, 'Fishing is disabled in this world');
  need(!t?.deployed, 'Your nets are already deployed');
  need(!t?.netFull, 'The net is full — haul it aboard first');
  need(trawlWater(w, p), 'There is not enough clear water here to deploy the nets');
  need(p.engine && p.fuel > 0, 'Start the engine with fuel aboard');
  need(
    trawlLoad(w, p) < vehicleDef(w, p.vehicle).capacity,
    'Unload your catch or make room before towing again',
  );
  if (t?.shoal?.pendingFish)
    need(
      trawlLoad(w, p) + (worldItems(w)[t.shoal.pendingFish]?.weight ?? 0) <=
        vehicleDef(w, p.vehicle).capacity,
      'Unload your catch or make room for the next fish before towing again',
    );
  startVoyage(w, p);
  p.trawl = continuousTrawl(
    t ? { ...t, deployed: true, holdFull: false } : { seconds: 0, fuelUsed: 0, deployed: true },
    Math.random,
    fishingGroundQuality(w, p),
  );
  return 'Nets deployed. Haul whenever you want to inspect the catch. Keep fuel for your return.';
}
/** Only paid forward movement advances the server's fishing-ground and fish clocks.
 * Neither offline time nor client prediction rolls fish. Event clocks make catch
 * rates independent of render/server tick size and of repeated deploy/haul clicks. */
export function advanceTrawl(
  w: World,
  p: Player,
  dt: number,
  metres: number,
  prediction = false,
  random: Random = Math.random,
) {
  if (!isTrawler(p.vehicle, w) || !p.trawl?.deployed || !p.engine || p.fuel <= 0 || dt <= 0) return;
  const quality = prediction ? 0 : fishingGroundQuality(w, p);
  const t = prediction ? { ...p.trawl } : continuousTrawl(p.trawl, random, quality);
  const burn =
    (vehicleDef(w, p.vehicle).trawlFuel ?? TRAWL_FUEL_PER_SECOND) * boatLoadFactors(w, p).fuel;
  const spent = Math.min(p.fuel, dt * burn);
  p.fuel = Math.max(0, p.fuel - spent);
  t.fuelUsed = (t.fuelUsed ?? 0) + spent;
  if (w.settings.fishingMode !== 0 && trawlWater(w, p) && p.speed >= 1 && metres >= dt * 0.8) {
    let remaining = Math.min(dt, spent / burn);
    t.seconds = (t.seconds ?? 0) + remaining;
    if (!prediction) {
      const shoal = t.shoal!;
      const defs = worldItems(w);
      let weight = trawlLoad(w, p, t.catch),
        net = netWeight(w, t.catch);
      const rollLuck = () => {
        const r = random();
        shoal.luck = r < 0.5 ? 0.45 : r < 0.9 ? 1 : 3.75;
        // Long spells persist across hauling, port calls, reconnects and failed
        // deployments. Only paid fishing time renews them, never a free reroll.
        shoal.nextLuck = 21 * 600;
      };
      if (shoal.luck === undefined || shoal.nextLuck === undefined) rollLuck();
      while (remaining > 1e-9) {
        const rate =
          1.22 *
          (1 + deckhands(w, p).length * 0.08) *
          (1 + quality * 0.15) *
          (1 + quality * (shoal.luck! - 1));
        const step = Math.min(remaining, shoal.nextChange, shoal.nextFish / rate, shoal.nextLuck!);
        remaining -= step;
        shoal.nextChange -= step;
        shoal.nextFish -= step * rate;
        shoal.nextLuck! -= step;
        if (shoal.nextLuck! <= 1e-9) rollLuck();
        if (shoal.nextChange <= 1e-9 && !shoal.pendingFish) {
          shoal.ground = groundIndex(random, quality);
          shoal.nextChange = delay(SHOAL_MEAN_SECONDS, random);
          shoal.nextFish = catchDelay(shoal.ground, random);
        } else if (shoal.nextFish <= 1e-9) {
          const id = shoal.pendingFish ?? species(shoal.ground, random);
          const fishWeight = defs[id]?.weight ?? 0;
          if (
            weight + fishWeight > vehicleDef(w, p.vehicle).capacity ||
            net + fishWeight > (vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY)
          ) {
            shoal.pendingFish = id;
            t.deployed = false;
            t.holdFull = weight + fishWeight > vehicleDef(w, p.vehicle).capacity;
            t.netFull = net + fishWeight > (vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY);
            break;
          }
          t.catch ??= {};
          t.catch[id] = (t.catch[id] ?? 0) + 1;
          weight += fishWeight;
          net += fishWeight;
          delete shoal.pendingFish;
          shoal.nextFish = catchDelay(shoal.ground, random);
          if (
            weight >= vehicleDef(w, p.vehicle).capacity ||
            net >= (vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY)
          ) {
            t.deployed = false;
            t.holdFull = weight >= vehicleDef(w, p.vehicle).capacity;
            t.netFull = net >= (vehicleDef(w, p.vehicle).netCapacity ?? NET_CAPACITY);
            break;
          }
        }
      }
    }
  }
  if (p.fuel <= 0) t.deployed = false;
  p.trawl = t;
}
