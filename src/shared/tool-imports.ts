// SPDX-License-Identifier: GPL-3.0-or-later
import { toolImportPool, toolImportRules } from './tool-import-rules';
import { worldItems } from './world-catalogue';
import { log } from './simulation';
import type { World } from './types';

/** One established public trading counter per world; necessities and private
 * businesses retain their existing supply/price policies. */
export function toolImportShop(w: World) {
  return w.buildings
    .filter(
      (b) =>
        b.kind === 'market' &&
        b.government &&
        b.owner === 'treasury' &&
        !b.construction &&
        b.id !== 'parish-government-stores',
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}
function roll(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** At most the latest missed delivery check is considered on catch-up. Persist
 * even unsuccessful checks: a reconnect or richer shop cannot reroll one. */
export function importScarceTools(w: World, at: number, start = w.time) {
  if (!Number.isFinite(at)) return;
  const rules = toolImportRules(w.settings);
  w.toolImportAt ??= start;
  const due = Math.floor((at - w.toolImportAt) / rules.toolImportInterval);
  if (due <= 0) return;
  w.toolImportAt += due * rules.toolImportInterval;
  if (!rules.toolImports || roll(`${w.id}:${w.toolImportAt}:chance`) >= rules.toolImportChance)
    return;
  const shop = toolImportShop(w);
  if (!shop) return;
  const items = worldItems(w);
  const candidates = toolImportPool(rules.toolImportItems).flatMap((item) => {
    const def = items[item];
    if (!def) return []; // Removed custom catalogue entries are never fabricated.
    const available = w.buildings.reduce(
      (n, b) =>
        n +
        (!b.construction && Number.isSafeInteger(b.sell[item]) && b.sell[item] >= 0
          ? Math.max(0, b.stock[item] ?? 0)
          : 0),
      0,
    );
    const bid = Math.max(
      0,
      ...w.buildings.filter((b) => b.government && !b.construction).map((b) => b.buy[item] ?? 0),
    );
    const retail = Math.max(
      shop.sell[item] ?? 0,
      Math.ceil(def.price * (1 + rules.toolImportPremium / 100)),
      bid + rules.toolImportBidMargin,
    );
    const cost = Math.max(
      Math.ceil(retail * rules.toolImportCostShare),
      bid + rules.toolImportBidMargin,
    );
    const have = shop.stock[item] ?? 0;
    const quantity = Math.max(
      0,
      Math.floor(
        Math.min(
          rules.toolImportQuantity,
          rules.toolImportScarcity - available,
          rules.toolImportStockCap - have,
          shop.capacity - have,
          Math.floor(shop.investment / cost),
        ),
      ),
    );
    return quantity && cost < retail ? [{ item, quantity, cost, retail }] : [];
  });
  if (!candidates.length) return;
  const delivery =
    candidates[Math.floor(roll(`${w.id}:${w.toolImportAt}:item`) * candidates.length)];
  const { item, quantity, cost, retail } = delivery;
  shop.stock[item] = (shop.stock[item] ?? 0) + quantity;
  shop.sell[item] = retail;
  shop.investment -= quantity * cost;
  log(w, 'sink', quantity * cost, shop.id, 'imports', 'scarce tool shipment', {
    building: shop.id,
    item,
    quantity,
  });
}
