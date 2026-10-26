// SPDX-License-Identifier: GPL-3.0-or-later
/** World yaw can accumulate any number of turns; compass north is negative Z. */
export const nauticalHeading = (heading: number) =>
  (((180 - (heading * 180) / Math.PI) % 360) + 360) % 360;

export function nauticalHeadingLabel(heading: number) {
  const bearing = nauticalHeading(heading);
  const degrees = Math.round(bearing) % 360;
  const direction = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
  return `${degrees.toString().padStart(3, '0')}° ${direction}`;
}
