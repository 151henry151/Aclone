// SPDX-License-Identifier: GPL-3.0-or-later
import { trawlWater } from '../shared/commercial-fishing';
import type { Player, World } from '../shared/types';

/** Use only the public net cue: catch quantities stay hidden until hauling. */
export function trawlStatus(w: World, p: Player) {
  const t = p.trawl;
  if (t?.netFull) return 'Net full — haul it aboard';
  if (t?.holdFull) return 'Hold limit reached — towing stopped';
  if (!t?.deployed)
    return (t?.activity ?? 0) > 0 ? 'Towing paused — haul or resume nets' : 'Nets stowed';
  if (!p.engine || p.fuel <= 0) return 'Engine stopped — towing paused';
  if (!trawlWater(w, p)) return 'Not enough clear water for the nets';
  return p.speed < 1 ? 'Move forward to tow' : 'Towing';
}
