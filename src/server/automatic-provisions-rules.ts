// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { isPublicPuddlewick } from '../shared/harbour-supply';
/** One-time public-world change; preserve all other worlds and later owner edits. */
export function prepareAutomaticProvisions(w: World) {
  if (!isPublicPuddlewick(w) || w.automaticProvisionsVersion) return false;
  w.settings.autoConsumeInventory = true;
  w.settings.autoConsumeHomeStock = true;
  w.settings.homeNeedsMultiplier = 0.8;
  w.automaticProvisionsVersion = 1;
  w.revision++;
  return true;
}
