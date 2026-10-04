// SPDX-License-Identifier: GPL-3.0-or-later
import { worldItems, worldBuildings } from '../../shared/world-catalogue.ts';
import type { World, Player } from '../../shared/types.ts';
/** Personal book value, not a promise of resale proceeds. Posted owner prices
 * cannot inflate it; investment transfers are not mistaken for money lost. */
export function netAssets(w: World, p: Player) {
  const items = worldItems(w),
    buildings = worldBuildings(w);
  const goods = (stock: Record<string, number>) =>
    Object.entries(stock).reduce(
      (total, [id, n]) => total + Math.max(0, n) * (items[id]?.price ?? 0),
      0,
    );
  const property = w.buildings
    .filter((b) => b.owner === p.id)
    .reduce(
      (total, b) =>
        total +
        Math.round(
          ((buildings[b.templateId ?? b.kind]?.price ?? 0) * Math.max(0, b.condition)) / 100,
        ) +
        Math.max(0, b.investment) +
        goods(b.stock),
      0,
    );
  const pantry = w.buildings.reduce(
    (total, b) => total + goods(b.lodging?.guests[p.id]?.stock ?? {}),
    0,
  );
  const debt = (p.loans ?? []).reduce(
    (total, l) => total + Math.max(0, l.principal + l.interest),
    0,
  );
  return p.cash + p.bank + goods(p.inventory) + property + pantry - debt;
}
