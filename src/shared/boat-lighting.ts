// SPDX-License-Identifier: GPL-3.0-or-later
import { vehicleDef } from './vehicle-config';
import type { Player, World } from './types';
import { poweredBoat } from './boats';
export type BoatLighting = { deck: boolean; cabin: 'off' | 'warm' | 'red' };
export const boatLighting = (p: Pick<Player, 'boatLighting'>): BoatLighting => ({
  deck: p.boatLighting?.deck ?? false,
  cabin: p.boatLighting?.cabin ?? 'off',
});
/** Captain-only, server-authoritative switches; navigation signals are automatic. */
export function changeBoatLighting(p: Player, circuit: unknown, w?: World) {
  if (
    (!poweredBoat(p.vehicle, w) && !vehicleDef(w, p.vehicle).lights?.length) ||
    p.hitch ||
    p.atHome ||
    p.health <= 0
  )
    throw Error('Board your powered boat as captain to operate its lights');
  const state = boatLighting(p);
  if (circuit === 'deck') state.deck = !state.deck;
  else if (circuit === 'cabin')
    state.cabin = state.cabin === 'off' ? 'warm' : state.cabin === 'warm' ? 'red' : 'off';
  else if (circuit === 'search') p.lights = !p.lights;
  else throw Error('Unknown boat lighting circuit');
  p.boatLighting = state;
}
export type NavigationLamp =
  'port' | 'starboard' | 'stern' | 'masthead' | 'trawlGreen' | 'trawlWhite';
/** Relative observer bearing: zero ahead, positive to starboard. COLREG Rule 21 arcs. */
export function navigationSector(lamp: NavigationLamp, bearing: number) {
  const b = Math.atan2(Math.sin(bearing), Math.cos(bearing)),
    edge = (Math.PI * 112.5) / 180;
  if (lamp === 'port') return b >= -edge && b <= 0;
  if (lamp === 'starboard') return b >= 0 && b <= edge;
  if (lamp === 'masthead') return Math.abs(b) <= edge;
  if (lamp === 'stern') return Math.abs(b) >= edge;
  return true;
}
/** Stopped afloat is still underway, not anchored. Trawlers making way show sidelights/stern. */
export function navigationSignals(trawling: boolean, speed: number, moored = false) {
  return {
    port: !moored && (!trawling || Math.abs(speed) > 0.05),
    starboard: !moored && (!trawling || Math.abs(speed) > 0.05),
    stern: !moored && (!trawling || Math.abs(speed) > 0.05),
    masthead: !moored && !trawling,
    trawlGreen: !moored && trawling,
    // Reuse the lower all-round white lantern as a mooring/anchor visibility light.
    trawlWhite: moored || trawling,
  };
}
