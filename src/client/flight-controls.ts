// SPDX-License-Identifier: GPL-3.0-or-later
import type { Input } from '../shared/types';
const idle: Input = { throttle: 0, steer: 0, boost: false, pitch: 0, roll: 0, brake: false };
/** W/S are throttle-rate controls, idle throttle-down also requests slow ground pushback. */
export function aircraftInput(
  keys: ReadonlySet<string>,
  touch: Input,
  pad: Input,
  blocked = false,
): Input {
  if (blocked) return { ...idle };
  const held = (...names: string[]) => names.some((k) => keys.has(k));
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    throttle: clamp(+held('w', 'W') - +held('s', 'S') + touch.throttle + pad.throttle),
    steer: clamp(+held('a', 'A') - +held('d', 'D') + touch.steer + pad.steer),
    boost: false,
    pitch: clamp(+held('ArrowDown') - +held('ArrowUp') + (touch.pitch ?? 0) + (pad.pitch ?? 0)),
    roll: clamp(+held('ArrowLeft') - +held('ArrowRight') + (touch.roll ?? 0) + (pad.roll ?? 0)),
    brake: held('b', 'B') || !!touch.brake || !!pad.brake,
  };
}
