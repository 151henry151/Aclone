// SPDX-License-Identifier: GPL-3.0-or-later
import { smoothstep } from './noise';
/** Standard refracted geographic horizon, metres. Nominal night range is 16 NM. */
export function lighthouseRange(focalHeight: number, eyeHeight: number) {
  return Math.min(
    16 * 1852,
    2.08 * 1852 * (Math.sqrt(Math.max(0, focalHeight)) + Math.sqrt(Math.max(0, eyeHeight))),
  );
}
export function lighthouseFlash(angle: number, bearing: number, elevation: number) {
  const difference = Math.atan2(Math.sin(angle - bearing), Math.cos(angle - bearing));
  return Math.exp(-((difference / 0.035) ** 2)) * (1 - smoothstep(0.06, 0.18, Math.abs(elevation)));
}

/** Nearby illumination is deliberately independent of the long-range beacon. */
export function lighthouseLocalLight(daylight: number, mist: number, seaward: boolean) {
  const night = 1 - Math.min(1, Math.max(0, daylight));
  return {
    surface: seaward ? night * 0.45 : 0,
    shaft: seaward ? smoothstep(0.1, 1, mist) * (0.04 + 0.12 * night) : 0,
  };
}
