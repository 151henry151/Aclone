// SPDX-License-Identifier: GPL-3.0-or-later
/** Effective Earth radius for standard terrestrial refraction (2.08 NM √metres).
 * USCG Light List: geographic range adds observer and target horizon distances.
 * Weather/luminous range are independent limits, not a shorter terrain draw radius.
 */
export const refractedEarthRadius = (2.08 * 1852) ** 2 / 2;
export const earthDrop = (distance: number) => (distance * distance) / (2 * refractedEarthRadius);
export function geographicRange(targetHeight: number, eyeHeight: number) {
  return 2.08 * 1852 * (Math.sqrt(Math.max(0, targetHeight)) + Math.sqrt(Math.max(0, eyeHeight)));
}
export function marineVisibility(weather: { precipitation: string; storm: boolean }) {
  return weather.storm ? 4500 : weather.precipitation !== 'clear' ? 14000 : 45000;
}
