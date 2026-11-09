// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Trailer } from './trailers';
import { automotiveConfig } from './automotive-config';
export interface RefrigerationState {
  fuel: number;
  running: boolean;
  checkedAt: number;
}
/** Read-only interval preview: failed refills/config changes must not settle any state. */
export function coolingInterval(w: World, t: Trailer, at = w.time) {
  const r = automotiveConfig(w).refrigeration,
    state = t.cooling,
    start = state?.checkedAt ?? at,
    elapsed = Math.max(0, at - start),
    rate = r.fuelPerHour / 3600,
    powered =
      r.enabled && state?.running && state.fuel > 0
        ? Math.min(elapsed, rate > 0 ? state.fuel / rate : elapsed)
        : 0;
  return {
    start,
    end: start + powered,
    fuel: Math.max(0, (state?.fuel ?? 0) - powered * rate),
    multiplier: r.ageingMultiplier,
  };
}
export function settleCooling(w: World, t: Trailer, at = w.time) {
  const interval = coolingInterval(w, t, at);
  if (t.cooling)
    t.cooling = { ...t.cooling, fuel: interval.fuel, checkedAt: Math.max(t.cooling.checkedAt, at) };
  return interval;
}
