// SPDX-License-Identifier: GPL-3.0-or-later
/** Vertical look for chase and first-person cameras. Overhead stays top-down. */
export const LOOK_PITCH_MIN = -1.1;
export const LOOK_PITCH_MAX = 1.4;
const DRAG = 0.004;

export function lookPitchFromDrag(pitch: number, dy: number, cameraMode: number) {
  if (cameraMode === 2) return pitch;
  return Math.max(LOOK_PITCH_MIN, Math.min(LOOK_PITCH_MAX, pitch + dy * DRAG));
}

/** Behind-the-tractor offset. lookPitch 0 matches the historical seat; looking up lowers the camera. */
export function chaseOffset(heading: number, zoom: number, walking: boolean, lookPitch: number) {
  const dist = (walking ? 6 : 21) * zoom,
    height = (walking ? 3 : 8.5) * zoom,
    radius = Math.hypot(dist, height),
    base = Math.atan2(height, dist),
    pitch = Math.max(-0.2, Math.min(1.35, base - lookPitch)),
    horiz = radius * Math.cos(pitch);
  return {
    x: -Math.sin(heading) * horiz,
    y: radius * Math.sin(pitch),
    z: -Math.cos(heading) * horiz,
  };
}
