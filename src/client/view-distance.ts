// SPDX-License-Identifier: GPL-3.0-or-later
import { marineVisibility } from '../shared/marine-visibility';
/** One atmosphere for nearby scenery and the inexpensive island silhouette. */
export function viewFog(weather: { precipitation: string; storm: boolean }) {
  return { near: weather.storm ? 150 : 500, far: marineVisibility(weather) };
}
