// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building, Action } from './types';
import { meatMenus, meatRecipes } from './meat-recipes';
import { meatRules } from './meat-rules';
import { shelter } from './lodging';
import { expireMeatStock, consumeStock } from './meat-freshness';
import { worldItems } from './world-catalogue';
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function setMeatMenu(w: World, p: Player, b: Building, menu: unknown) {
  const selected = meatMenus[String(menu)];
  need(
    selected && selected.kitchens.includes(b.kind) && !b.construction,
    'Choose an available kitchen meat menu',
  );
  need(b.owner === p.id, 'Only the kitchen owner can select its menu');
  need(!b.production, 'This kitchen has a custom world recipe');
  b.recipe = `meat_${menu}`;
  b.progress = 0;
  return `Kitchen menu: ${worldItems(w)[String(menu)].name}. Stock the ingredients and employ qualified cooks.`;
}
export function homeCook(
  w: World,
  p: Player,
  a: Action,
  quote?: NonNullable<import('./types').Task['cooking']>,
) {
  if (a.operation === 'cancel') {
    need(p.task?.kind === 'homeCook', 'No home cooking is in progress');
    delete p.task;
    return 'Cooking cancelled. Ingredients stay in your pantry and inventory.';
  }
  const r = meatRules(w.settings);
  need(r.homeCookingEnabled, 'Home cooking is disabled in this world');
  const home = shelter(w, p);
  need(
    home && (home.b.kind === 'home' || ['bnb', 'hotel'].includes(home.b.kind)),
    'Cook inside your own home or booked inn room',
  );
  need(!p.task && !p.hitch && !p.game, 'Finish your current activity before cooking');
  const menu = String(a.menu),
    recipe = meatRecipes(w.settings)[`meat_${menu}`];
  need(recipe && Object.hasOwn(meatMenus, menu), 'Choose a meat dish to cook');
  expireMeatStock(w, home.stock);
  expireMeatStock(w, p.inventory);
  need(
    !quote ||
      (quote.home === home.b.id &&
        quote.yield === r.homeCookingYield &&
        JSON.stringify(quote.inputs) === JSON.stringify(recipe.inputs)),
    'The home or cooking recipe changed',
  );
  need((home.stock[menu] ?? 0) + r.homeCookingYield <= home.b.capacity, 'The home pantry is full');
  for (const [item, count] of Object.entries(recipe.inputs))
    need(
      (home.stock[item] ?? 0) + (p.inventory[item] ?? 0) >= count,
      `Missing ingredients: ${count} ${worldItems(w)[item].name}`,
    );
  if (!quote) {
    p.task = {
      kind: 'homeCook',
      end: w.time + r.homeCookingSeconds,
      building: home.b.id,
      item: menu,
      cooking: { home: home.b.id, menu, inputs: recipe.inputs, yield: r.homeCookingYield },
    };
    return `Cooking ${worldItems(w)[menu].name}; ${r.homeCookingSeconds} seconds. Stay inside your home.`;
  }
  for (const [item, count] of Object.entries(recipe.inputs)) {
    const fromHome = Math.min(count, home.stock[item] ?? 0);
    if (fromHome) consumeStock(w, home.stock, item, fromHome);
    if (count > fromHome) consumeStock(w, p.inventory, item, count - fromHome);
  }
  home.stock[menu] = (home.stock[menu] ?? 0) + r.homeCookingYield;
  return `Cooked ${r.homeCookingYield} ${worldItems(w)[menu].name} for your home pantry.`;
}
