// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings, recipes } from './catalog';
import type { Building, Player, World } from './types';
export const seafoodKitchens = ['kitchen', 'dairyKitchen', 'pub', 'bnb', 'hotel'];
export const seafoodSpecies = ['cod', 'halibut', 'tuna'];
/** New listings only: retain every existing price, zero bid, owner and balance. */
export function integrateSeafood(w: World) {
  if (w.seafoodVersion) return false;
  for (const b of w.buildings) {
    if (![...seafoodKitchens, 'market', 'starport', 'boathouse'].includes(b.kind)) continue;
    const catalogue = buildings[b.kind];
    for (const id of [
      ...seafoodSpecies,
      ...(seafoodKitchens.includes(b.kind) ? ['potatoes', 'water', 'meals'] : []),
    ]) {
      if (
        catalogue.buy[id] !== undefined &&
        b.buy[id] === undefined &&
        b.pausedPrices?.buy?.[id] === undefined
      )
        b.buy[id] = catalogue.buy[id];
      if (
        catalogue.sell[id] !== undefined &&
        b.sell[id] === undefined &&
        b.pausedPrices?.sell?.[id] === undefined
      )
        b.sell[id] = catalogue.sell[id];
    }
  }
  w.seafoodVersion = 1;
  w.revision++;
  return true;
}
export function setSeafoodMenu(w: World, p: Player, b: Building, menu: unknown) {
  if (!seafoodKitchens.includes(b.kind) || b.construction || b.owner !== p.id)
    throw Error('Only the owner can set a completed kitchen’s menu');
  if (b.production)
    throw Error('This kitchen has a custom world recipe; ask the world owner to change it');
  if (menu !== 'standard' && !seafoodSpecies.includes(String(menu)))
    throw Error('Choose the standard menu, cod, halibut or tuna');
  const recipe = menu === 'standard' ? (buildings[b.kind].recipe ?? undefined) : `seafood_${menu}`;
  if (b.recipe === recipe) throw Error('That menu is already selected');
  // Do not carry fractional progress from a cheap recipe into a costly batch.
  b.recipe = recipe;
  b.progress = 0;
  return recipe
    ? `Kitchen menu: ${Object.entries(recipes[recipe].inputs)
        .map(([id, n]) => `${n} ${id}`)
        .join(
          ' + ',
        )} → ${recipes[recipe].outputs.meals ?? 0} meals. Fund the till, stock ingredients and employ cooks.`
    : 'Standard retail and lodging service restored; seafood meals are no longer produced.';
}
