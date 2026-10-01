// SPDX-License-Identifier: GPL-3.0-or-later
export type SoundKind =
  'engine' | 'saw' | 'mill' | 'hammer' | 'furnace' | 'pump' | 'horn' | 'weapon';
const TAU = Math.PI * 2;

/** Original mono PCM. Integer-frequency oscillations and a short wrap crossfade keep loops seamless. */
export function synthesize(kind: SoundKind, sampleRate: number): Float32Array<ArrayBuffer> {
  const duration = kind === 'horn' ? 0.48 : kind === 'weapon' ? 0.08 : 2;
  const data = new Float32Array(Math.round(sampleRate * duration));
  let seed = 73921,
    low = 0,
    rumble = 0;
  const sine = (hz: number, t: number) => Math.sin(TAU * hz * t);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += 0.12 * (noise - low);
    rumble += 0.025 * (noise - rumble);
    const firing = Math.exp(-((t * 20) % 1) * 7);
    switch (kind) {
      case 'engine':
        // Uneven exhaust pulses, resonant body and filtered mechanical chatter.
        data[i] =
          0.42 * (firing - 1 / 7) +
          (0.16 * sine(40, t) + 0.1 * sine(80, t) + 0.06 * sine(120, t)) *
            (0.8 + 0.2 * sine(10, t)) +
          low * (0.4 + firing) +
          rumble * 0.8;
        break;
      case 'saw':
        data[i] =
          (0.17 * sine(285, t) + 0.08 * sine(570, t) + low * 0.8 + noise * 0.07) *
          (0.7 + 0.3 * sine(2, t));
        break;
      case 'mill':
        data[i] = 0.23 * sine(55, t) + 0.09 * sine(110, t) + low * (0.5 + 0.25 * sine(6, t));
        break;
      case 'hammer': {
        const strike = Math.exp(-((t * 2) % 1) * 15);
        data[i] = strike * (0.4 * sine(233, t) + 0.22 * sine(607, t) + noise * 0.4) + rumble * 0.6;
        break;
      }
      case 'furnace':
        data[i] = low * 1.5 + rumble * 0.8 + 0.06 * sine(45, t);
        break;
      case 'pump':
        data[i] = 0.17 * sine(65, t) + low * (0.7 + 0.5 * sine(3, t)) + rumble;
        break;
      case 'weapon':
        data[i] =
          (((t * 60) % 1) * 2 - 1) *
          Math.exp(-t * 45) *
          Math.min(1, t / 0.004) *
          Math.min(1, (duration - t) / 0.01);
        break;
      case 'horn': {
        const envelope = Math.min(1, t / 0.015) * Math.min(1, (duration - t) / 0.12);
        data[i] =
          envelope *
          (0.25 * sine(185, t) + 0.22 * sine(233, t) + 0.08 * sine(370, t) + 0.06 * sine(466, t));
        break;
      }
    }
  }
  if (kind !== 'horn' && kind !== 'weapon') {
    // Blend the tail toward the beginning, rather than fading each revolution to silence.
    const wrap = Math.round(sampleRate * 0.02);
    for (let i = 0; i < wrap; i++) {
      const blend = i / (wrap - 1);
      const index = data.length - wrap + i;
      data[index] = data[index] * (1 - blend) + data[0] * blend;
    }
  }
  const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (peak > 0.9) for (let i = 0; i < data.length; i++) data[i] *= 0.9 / peak;
  return data;
}
