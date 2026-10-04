// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types.ts';
import { worldBuildings } from './world-catalogue.ts';
/** Base cash only: construction tax and any delivered materials are non-refundable. */
export function constructionRefund(w: World, b: Building): number {
  if (!b.construction) return 0;
  // Older saves have no receipt. Never exceed their saved price or today's catalogue base.
  const base =
    b.constructionCost ??
    Math.min(b.price, worldBuildings(w)[b.templateId ?? b.kind]?.price ?? b.price);
  return Number.isSafeInteger(base) && base > 0 ? Math.floor(base * 0.75) : 0;
}
