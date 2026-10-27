// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
/** One-time public-world opt-in; later owner settings are respected. */
export function preparePuddlewickOcean(w: World) {
  if (
    w.id !== 'puddlewick' ||
    w.template !== 'economy' ||
    (w.owner !== 'server' && !w.publicParishVersion) ||
    w.oceanVersion
  )
    return false;
  w.settings.tidalRange = 0.6;
  w.settings.oceanWaves = 1;
  w.oceanVersion = 1;
  return true;
}
