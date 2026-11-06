// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { recipes } from './catalog';
import { worldMeatRecipe } from './meat-recipes';
/** Explicit premises recipes override the world-scaled standard menus. */
export function productionRecipe(w: Pick<World, 'settings'> | undefined, b: Building) {
  return b.production ?? worldMeatRecipe(b, w?.settings ?? {}) ?? recipes[b.recipe ?? ''];
}
