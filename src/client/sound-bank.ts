// SPDX-License-Identifier: GPL-3.0-or-later
import { synthesize, type SoundKind } from './sound-synthesis';

/** Web Audio resamples buffers to the context rate, so one bank serves every context. */
export const SOUND_RATE = 48000;
export const soundKinds: SoundKind[] = [
  'engine',
  'saw',
  'mill',
  'hammer',
  'furnace',
  'pump',
  'horn',
  'weapon',
  'woodland',
  'shore',
  'storm',
  'chat',
];
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Synthesized PCM, prepared behind the loading screen rather than on the first frames of play. */
export class SoundBank {
  private pcm = new Map<SoundKind, Float32Array<ArrayBuffer>>();
  constructor(private make = synthesize) {}
  get(kind: SoundKind) {
    let samples = this.pcm.get(kind);
    if (!samples) this.pcm.set(kind, (samples = this.make(kind, SOUND_RATE)));
    return samples;
  }
  async prepare(current: () => boolean, yieldTask = nextTask) {
    for (const kind of soundKinds) {
      if (this.pcm.has(kind)) continue;
      if (!current()) return false;
      this.get(kind);
      await yieldTask();
    }
    return true;
  }
}
export const soundBank = new SoundBank();
