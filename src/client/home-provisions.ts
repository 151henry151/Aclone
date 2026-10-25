// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../shared/types';
import { shelter } from '../shared/lodging';
import { homeProvisions } from '../shared/home-provisions';
let cacheKey = '',
  cached = '';
const duration = (seconds: number) => {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.floor(seconds / 60),
    hours = Math.floor(minutes / 60),
    days = Math.floor(hours / 24);
  return days ? `${days}d ${hours % 24}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};
export function homeProvisionsStatus(w: World, p: Player) {
  const home = shelter(w, p);
  if (!home) return '';
  const key = JSON.stringify([
    w.id,
    w.revision,
    w.maintenance?.paused,
    p.id,
    p.home,
    Math.floor(w.time / 10),
    w.settings.hungerRate,
    w.settings.thirstRate,
    w.settings.homeNeedsMultiplier,
    w.settings.autoConsumeInventory,
    w.settings.autoConsumeHomeStock,
    w.settings.autoConsumeInventory ? p.inventory : undefined,
    p.needsGraceUntil,
    home.until,
    p.roomPantries?.[home.b.id] ?? home.stock,
  ]);
  if (key === cacheKey) return cached;
  cacheKey = key;
  const estimate = homeProvisions(w, p)!;
  const time = duration(estimate.seconds);
  cached = !Number.isFinite(estimate.seconds)
    ? 'Food and drink do not drain while you are at home.'
    : estimate.limit === 'booking'
      ? `Provisions cover your remaining stay (${time} real time). Renew your room before leaving.`
      : estimate.limit === 'calculation'
        ? `Provisions cover at least ${time} of real time at home.`
        : estimate.seconds === 0
          ? `Your available provisions are out of ${estimate.exhausted}. Restock before leaving.`
          : `Provisions run out in about ${time} of real time — ${estimate.exhausted} first.`;
  if (w.maintenance?.paused) cached += ' World paused; consumption is paused.';
  return cached;
}
