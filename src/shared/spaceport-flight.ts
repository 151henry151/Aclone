// SPDX-License-Identifier: GPL-3.0-or-later
import { DAY_SECONDS } from './environment';
/** Ambient cargo service, independent of player travel. Deterministic across clients/restarts. */
export function spaceportFlight(world: string, time: number) {
  let hash = 0;
  for (const c of world) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  const first = 3 * DAY_SECONDS + Math.floor((hash % 1000) * 0.3),
    period = 7 * DAY_SECONDS;
  const dayTime = Math.max(0, Number.isFinite(time) ? time : 0);
  let launch = first + Math.floor(Math.max(0, dayTime - first) / period) * period;
  const second = dayTime >= launch + 3 * DAY_SECONDS;
  if (second) launch += 3 * DAY_SECONDS;
  const elapsed = Math.round((dayTime - launch) * 1e6) / 1e6;
  const next = dayTime < first ? first : launch + (second ? 4 : 3) * DAY_SECONDS;
  let phase: 'docked' | 'ignition' | 'ascending' | 'away' | 'landing' | 'settling' = 'docked',
    height = 0,
    thrust = 0;
  if (elapsed >= 0 && elapsed < 8) {
    phase = 'ignition';
    thrust = elapsed / 8;
  } else if (elapsed >= 8 && elapsed < 65) {
    phase = 'ascending';
    height = 800 * ((elapsed - 8) / 57) ** 2;
    thrust = 1;
  } else if (elapsed >= 65 && elapsed < 250) {
    phase = 'away';
    height = 800;
  } else if (elapsed >= 250 && elapsed < 300) {
    phase = 'landing';
    height = 800 * ((300 - elapsed) / 50) ** 2;
    thrust = 0.65 + 0.35 * (1 - height / 800);
  } else if (elapsed >= 300 && elapsed < 312) {
    phase = 'settling';
    thrust = 1 - (elapsed - 300) / 12;
  }
  return {
    phase,
    height,
    thrust,
    elapsed,
    launch,
    next,
    visible: phase !== 'away',
    smoke: (elapsed >= 0 && elapsed < 85) || (elapsed >= 250 && elapsed < 335),
  };
}
