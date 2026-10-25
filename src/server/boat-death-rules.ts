// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { isPublicPuddlewick } from '../shared/harbour-supply';
/** Change future deaths only. Do not confiscate existing fleets during deployment,
 * and do not overwrite later world-owner edits on every restart. */
export function prepareBoatDeathRules(w: World) {
  if (!isPublicPuddlewick(w) || w.boatDeathRulesVersion) return false;
  w.settings.loseBoatsOnDeath = true;
  w.boatDeathRulesVersion = 1;
  w.revision++;
  return true;
}
