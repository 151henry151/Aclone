// SPDX-License-Identifier: GPL-3.0-or-later
import { smoothstep } from './noise';
import { geographicRange } from './marine-visibility';
/** Standard refracted geographic horizon, metres. Nominal night range is 30 km. */
export function lighthouseRange(focalHeight: number, eyeHeight: number) {
  return Math.min(30000, geographicRange(focalHeight, eyeHeight));
}
export function lighthouseFlash(angle: number, bearing: number, elevation: number) {
  const difference = Math.atan2(Math.sin(angle - bearing), Math.cos(angle - bearing));
  return Math.exp(-((difference / 0.1) ** 2)) * (1 - smoothstep(0.06, 0.18, Math.abs(elevation)));
}

/** Navigation signals are emissive points, not lights illuminating the sea/town. */
export function lighthouseLocalLight(_daylight: number, _mist: number, _seaward: boolean) {
  return { surface: 0, shaft: 0 };
}
export function lighthouseSignal(flash: number, distance: number, daylight: number, mist: number) {
  return (
    (0.045 + 0.955 * flash) *
    (1 - 0.8 * daylight) *
    Math.exp(-distance * (0.000015 + mist * 0.00065))
  );
}
