// SPDX-License-Identifier: GPL-3.0-or-later
import { meatRules, type MeatRules } from './meat-rules';
import type { Recipe, Building } from './types';
export const meatAnimals = {
  cows: { raw: 'beef', farm: 'dairy', yield: 'beefYield' },
  pigs: { raw: 'pork', farm: 'piggery', yield: 'porkYield' },
  sheep: { raw: 'mutton', farm: 'sheepfold', yield: 'muttonYield' },
  chickens: { raw: 'poultry', farm: 'henhouse', yield: 'poultryYield' },
} as const;
export const rawMeats: readonly string[] = Object.values(meatAnimals).map((s) => s.raw);
export const meatMenus: Record<
  string,
  { inputs: Record<string, number>; kitchens: readonly string[] }
> = {
  beefStew: {
    inputs: { beef: 1, potatoes: 2, water: 1 },
    kitchens: ['kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'],
  },
  porkSupper: {
    inputs: { pork: 1, potatoes: 2 },
    kitchens: ['kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'],
  },
  muttonPie: {
    inputs: { mutton: 1, flour: 1 },
    kitchens: ['kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'],
  },
  roastChicken: {
    inputs: { poultry: 1, potatoes: 2 },
    kitchens: ['kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'],
  },
  steak: { inputs: { beef: 1 }, kitchens: ['kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'] },
  meatBreakfast: {
    inputs: { pork: 1, eggs: 2, potatoes: 1 },
    kitchens: ['dairyKitchen', 'hotel', 'bnb'],
  },
  pubMeatPie: {
    inputs: { beef: 1, flour: 1, potatoes: 1 },
    kitchens: ['kitchen', 'pub', 'hotel', 'bnb'],
  },
};
export function slaughterOutputs(
  animal: keyof typeof meatAnimals,
  settings: Partial<MeatRules> = {},
) {
  const r = meatRules(settings),
    s = meatAnimals[animal];
  return {
    [s.raw]: r[s.yield],
    ...(r.slaughterCompostYield ? { compost: r.slaughterCompostYield } : {}),
  };
}
export function meatRecipes(settings: Partial<MeatRules> = {}): Record<string, Recipe> {
  const r = meatRules(settings);
  return Object.fromEntries([
    ...Object.entries(meatAnimals).map(([animal]) => [
      `butcher_${animal}`,
      {
        inputs: { [animal]: 1 },
        outputs: slaughterOutputs(animal as keyof typeof meatAnimals, settings),
        skill: 'butcher',
        seconds: 600,
        tier: 0,
      },
    ]),
    ...Object.entries(meatMenus).map(([meal, menu]) => [
      `meat_${meal}`,
      {
        inputs: { ...menu.inputs },
        outputs: { [meal]: meal === 'steak' ? r.cookedSteakYield : r.meatMealYield },
        skill: 'cook',
        seconds: 600,
        tier: 0,
      },
    ]),
  ]);
}
export function worldMeatRecipe(b: Building, settings: Partial<MeatRules>) {
  if (b.production || (!b.recipe?.startsWith('butcher_') && !b.recipe?.startsWith('meat_')))
    return undefined;
  return meatRecipes(settings)[b.recipe];
}
