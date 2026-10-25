// SPDX-License-Identifier: GPL-3.0-or-later
import { FISHING_BOAT } from './boats';
import { terrainHeight } from './terrain';
import { vehicles } from './catalog';
import { worldItems } from './world-catalogue';
import { recordGathered } from './player-statistics';
import type { Player, Stock, World } from './types';

export const TRAWL_SECONDS = 720;
export const TRAWL_FUEL = 124;
export const TRAWL_SPEED = 2.4;
/** Whole-trip draws, not an independent jackpot lottery every frame or fish. */
export const HAULS = [
  { chance: 0.3, catch: { cod: 6 } },
  { chance: 0.6, catch: { cod: 12, halibut: 2 } },
  { chance: 0.1, catch: { cod: 24, halibut: 8, tuna: 5 } },
] as const;
export function trawlHaul(roll = Math.random()): Stock {
  let threshold = 0;
  for (const haul of HAULS) {
    threshold += haul.chance;
    if (roll < threshold) return { ...haul.catch };
  }
  return { ...HAULS[2].catch };
}
export function trawlWater(w: World, p: Pick<Player, 'x' | 'z'>) {
  return w.settings.seaLevel - terrainHeight(w, p.x, p.z) >= 8;
}
function need(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(reason);
}
export function trawlAction(w: World, p: Player, operation: unknown) {
  need(
    p.vehicle === FISHING_BOAT && !p.hitch && !p.atHome && !p.crowBody && !p.task && !p.game,
    'Board your fishing boat and finish other activities first',
  );
  const t = p.trawl;
  if (operation === 'stow') {
    need(t?.deployed, 'Your nets are already stowed');
    p.trawl = { ...t, deployed: false };
    return 'Nets stowed. Progress is saved; resume this tow when ready.';
  }
  if (operation === 'haul') {
    need(t?.catch, 'Finish a twelve-minute tow before hauling the catch');
    const defs = worldItems(w);
    const weight = Object.entries({ ...p.inventory }).reduce(
      (sum, [id, n]) => sum + n * (defs[id]?.weight ?? 0),
      0,
    );
    const caughtWeight = Object.entries(t.catch).reduce(
      (sum, [id, n]) => sum + n * (defs[id]?.weight ?? 0),
      0,
    );
    need(
      weight + caughtWeight <= vehicles[FISHING_BOAT].capacity,
      'Make room in your hold; the catch is saved in the net and cannot be rerolled',
    );
    for (const [id, n] of Object.entries(t.catch)) {
      p.inventory[id] = (p.inventory[id] ?? 0) + n;
      recordGathered(w, p, id, n);
    }
    const message = `Catch aboard: ${Object.entries(t.catch)
      .map(([id, n]) => `${n} ${defs[id]?.name ?? id}`)
      .join(', ')}. Sell at a funded boathouse, harbour store or spaceport; prices and taxes vary.`;
    delete p.trawl;
    return message;
  }
  need(operation === 'deploy', 'Unknown net operation');
  need(w.settings.fishingMode !== 0, 'Fishing is disabled in this world');
  need(!t?.deployed && !t?.catch, 'Stow or haul the current net first');
  need(trawlWater(w, p), 'Nets need water at least eight metres deep');
  need(p.engine && p.fuel > 0, 'Start the engine with fuel aboard');
  const remaining = TRAWL_FUEL * (1 - (t?.seconds ?? 0) / TRAWL_SECONDS);
  need(
    p.fuel + 1e-6 >= remaining,
    'Carry enough tank fuel to finish this tow, plus a reserve to return',
  );
  p.trawl = t ? { ...t, deployed: true } : { seconds: 0, fuelUsed: 0, deployed: true };
  return 'Nets deployed. Drive forward through deep water; twelve minutes of towing uses 124 fuel. Stopping or shallow water wastes fuel without advancing the tow.';
}
/** Called only after real movement. Prediction updates fuel but never rolls or grants fish.
 * Stationary engines still consume fuel with nets down; world time jumps/offline time
 * cannot complete a tow. No haul outcome exists until a paid, completed tow. */
export function advanceTrawl(w: World, p: Player, dt: number, metres: number, prediction = false) {
  if (p.vehicle !== FISHING_BOAT || !p.trawl?.deployed || !p.engine || p.fuel <= 0 || dt <= 0)
    return;
  const t = { ...p.trawl };
  const spent = Math.min(p.fuel, (dt * TRAWL_FUEL) / TRAWL_SECONDS);
  p.fuel = Math.max(0, p.fuel - spent);
  t.fuelUsed += spent;
  if (w.settings.fishingMode !== 0 && trawlWater(w, p) && p.speed >= 1 && metres >= dt * 0.8)
    t.seconds = Math.min(
      TRAWL_SECONDS,
      t.seconds + Math.min(dt, spent / (TRAWL_FUEL / TRAWL_SECONDS)),
    );
  if (!prediction && t.seconds >= TRAWL_SECONDS - 1e-6) {
    t.seconds = TRAWL_SECONDS;
    t.deployed = false;
    t.catch = trawlHaul();
  }
  if (p.fuel <= 0) t.deployed = false;
  p.trawl = t;
}
