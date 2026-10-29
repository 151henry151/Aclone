import { isTrawler } from '../shared/vehicle-config';
// SPDX-License-Identifier: GPL-3.0-or-later
import { trawlWater } from '../shared/commercial-fishing';
import { FISHING_BOAT } from '../shared/boats';
import type { Player, World } from '../shared/types';

/** Announce authoritative capacity stops once, including on initial login.
 * Keep this outside HUD rendering so prediction and repeated frames cannot alert. */
export class TrawlCapacityAlerts {
  private last = '';
  update(worldId: string, p: Player, w?: World) {
    const message =
      !isTrawler(p.vehicle, w) || p.hitch
        ? ''
        : p.trawl?.netFull
          ? 'Your fishing net is full. Towing has stopped — haul the catch aboard.'
          : p.trawl?.holdFull
            ? 'Your fishing boat has no room for more catch. Towing has stopped — haul and unload.'
            : '';
    const key = message ? JSON.stringify([worldId, p.id, p.trawl?.hauledAt, message]) : '';
    const changed = key !== this.last;
    this.last = key;
    return changed ? message : '';
  }
}

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
