// SPDX-License-Identifier: GPL-3.0-or-later
/** Keep haze atmospheric without hiding the neighbouring town. Storms still
 * reduce visibility. All distances stay inside the 950 m camera frustum. */
export function viewFog(weather: { precipitation: string; storm: boolean }) {
  return weather.storm
    ? { near: 70, far: 350 }
    : weather.precipitation !== 'clear'
      ? { near: 160, far: 720 }
      : { near: 280, far: 920 };
}
