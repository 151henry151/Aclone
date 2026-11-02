// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { isPublicPuddlewick } from '../shared/harbour-supply';
/** Give every world editable labour settings. Public Puddlewick moves to 12d
 * once; a later owner edit is kept, and other worlds keep 1d until edited. */
export function prepareLabourRules(w: World) {
  let changed = false;
  if (w.settings.labourDailyCap === undefined) {
    w.settings.labourDailyCap = 20000;
    changed = true;
  }
  if (!isPublicPuddlewick(w)) {
    if (w.settings.labourShiftPay === undefined) {
      w.settings.labourShiftPay = 100;
      changed = true;
    }
    return changed;
  }
  if (w.labourRulesVersion) return changed;
  w.settings.labourShiftPay = 1200;
  w.labourRulesVersion = 1;
  w.revision++;
  return true;
}
