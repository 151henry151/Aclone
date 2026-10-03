// SPDX-License-Identifier: GPL-3.0-or-later
import { recordLife } from './reports.ts';
import { buildings, items } from './catalog.ts';
import { DAY_SECONDS } from './environment.ts';
import type { Building, World } from './types.ts';
export const PROPERTY_YEAR = DAY_SECONDS * 365;
/** Catalogue valuation cannot be inflated by editing the building's own shop quotes. */
export function propertyQuote(w: World, b: Building) {
  const goods = Object.entries(b.stock).reduce(
    (n, [item, count]) => n + Math.max(0, count) * (items[item]?.price ?? 0),
    0,
  );
  const equity = goods + Math.max(0, b.investment);
  const years =
    b.estate && !b.owner ? Math.floor(Math.max(0, w.time - b.estate.since) / PROPERTY_YEAR) : 0;
  const discount = Math.pow(1 - (w.settings.estateAnnualDiscount ?? 0), years);
  const base = b.estate && !b.owner ? b.estate.base : b.price;
  const premium =
    b.estate && !b.owner ? Math.round(equity * (w.settings.estateEquityShare ?? 0)) : 0;
  return {
    base,
    goods,
    cash: b.investment,
    equity,
    premium,
    years,
    discount,
    total: Math.max(1, Math.round((base + premium) * discount)),
  };
}
export function releaseEstate(w: World, b: Building, cause = 'death') {
  const previous = b.owner && w.players[b.owner];
  if (previous)
    recordLife(w, previous, {
      kind: 'estate',
      cause,
      building: b.id,
      text: `${b.name} became unclaimed after ${cause}. ${w.settings.retainEstateContents ? 'Contents and investment remain with the building.' : 'Estate contents follow this world’s death rules.'}`,
    });
  delete b.owner;
  b.forSale = false;
  b.estate = { since: w.time, base: buildings[b.kind]?.price ?? b.price };
}
/** Only set host-parish defaults once; future world-owner edits survive reload. */
export function migrateEstates(w: World) {
  if (w.estateRulesVersion) return false;
  if (w.id === 'puddlewick' && w.owner === 'server' && w.template === 'economy') {
    w.settings.retainEstateContents = true;
    w.settings.estateEquityShare = 0.9;
    w.settings.estateAnnualDiscount = 0.05;
  }
  for (const b of w.buildings)
    if (!b.owner && !b.government && !b.estate) b.estate = { since: w.time, base: b.price };
  w.estateRulesVersion = 1;
  return true;
}
