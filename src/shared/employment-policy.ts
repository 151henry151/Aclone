// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';

/** One-time starter-parish policy update. Later operator edits remain authoritative. */
export function migrateEmploymentPolicy(w: World) {
  if (
    w.employmentPolicyVersion ||
    w.id !== 'puddlewick' ||
    w.template !== 'economy' ||
    !w.buildings.some((b) => b.id === 'b0' && b.kind === 'market' && b.government)
  )
    return;
  w.settings.activeWork = false;
  w.settings.ownerOperation = true;
  w.employmentPolicyVersion = 1;
}
