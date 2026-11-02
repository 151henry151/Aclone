// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { isPublicPuddlewick } from '../shared/harbour-supply';
/** One-time public-world change; preserve all other worlds and later owner edits. */
export function prepareAutomaticProvisions(w: World) {
  if (!isPublicPuddlewick(w)) return false;
  if (!w.automaticProvisionsVersion) {
    w.settings.autoConsumeInventory = true;
    w.settings.autoConsumeHomeStock = true;
    w.settings.homeNeedsMultiplier = 0.8;
  }
  // Signed-in players choose what they eat; carried supplies still feed them
  // while they are signed off. Owner edits made after this stay put.
  if ((w.automaticProvisionsVersion ?? 0) < 2) w.settings.autoConsumeInventoryOnline = false;
  if (w.automaticProvisionsVersion === 2) return false;
  w.automaticProvisionsVersion = 2;
  w.revision++;
  return true;
}
