// SPDX-License-Identifier: GPL-3.0-or-later
import { ambientZones } from '../shared/ambient';
import type { World } from '../shared/types';
import { publicPath } from '../shared/public-path';
import { soundBank, SOUND_RATE } from './sound-bank';
import { spatialSound, type Listener } from './sound-scene';
declare const __ACLONE_BASE__: string;
type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; key: string };
/** Four audible zones, one decode at a time and eight cached clips. No background autoplay. */
export class AmbientAudio {
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private visited = new Set<string>();
  private failed = new Set<string>();
  private loading?: AbortController;
  private generation = 0;
  update(w: World, listener: Listener, context: AudioContext, bus: GainNode, indoors: boolean) {
    const zones = ambientZones(w, listener),
      keep = new Set(zones.map((z) => z.id));
    for (const [id, voice] of this.voices)
      if (!keep.has(id)) {
        this.stop(voice, context);
        this.voices.delete(id);
      }
    for (const id of this.visited) if (!keep.has(id)) this.visited.delete(id);
    for (const zone of zones) {
      const asset =
        zone.source === 'asset'
          ? w.assets.find((a) => a.id === zone.asset && a.type === 'audio/mpeg')
          : undefined;
      if (zone.source === 'asset' && !asset) continue;
      const key = asset?.id ?? zone.source;
      let voice = this.voices.get(zone.id);
      if (voice && (voice.key !== key || voice.source.loop !== zone.loop)) {
        this.stop(voice, context);
        this.voices.delete(zone.id);
        this.visited.delete(zone.id);
        voice = undefined;
      }
      if (!voice && !this.visited.has(zone.id)) {
        let buffer = this.buffers.get(key);
        if (!buffer && asset) {
          if (!this.loading && !this.failed.has(key)) {
            const controller = (this.loading = new AbortController()),
              generation = this.generation;
            void fetch(publicPath(__ACLONE_BASE__, asset.url), { signal: controller.signal })
              .then(async (r) => {
                if (!r.ok) throw Error('Audio unavailable');
                const bytes = await r.arrayBuffer();
                if (bytes.byteLength > 2 * 1024 * 1024) throw Error('Audio file too large');
                return context.decodeAudioData(bytes);
              })
              .then((decoded) => {
                if (generation !== this.generation) return;
                if (decoded.duration > 30 || decoded.numberOfChannels > 2)
                  throw Error('Use mono/stereo clips no longer than 30 seconds');
                this.cache(key, decoded);
              })
              .catch(() => {
                if (generation === this.generation) this.failed.add(key);
              })
              .finally(() => {
                if (this.loading === controller) this.loading = undefined;
              });
          }
          continue;
        }
        if (!buffer) {
          const samples = soundBank.get(zone.source as 'woodland' | 'shore' | 'storm');
          buffer = context.createBuffer(1, samples.length, SOUND_RATE);
          buffer.copyToChannel(samples, 0);
          this.cache(key, buffer);
        }
        const source = context.createBufferSource(),
          gain = context.createGain(),
          pan = context.createStereoPanner();
        source.buffer = buffer;
        source.loop = zone.loop;
        gain.gain.value = 0;
        source.connect(gain).connect(pan).connect(bus);
        voice = { source, gain, pan, key };
        this.voices.set(zone.id, voice);
        if (!zone.loop) this.visited.add(zone.id);
        const current = voice;
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          pan.disconnect();
          if (this.voices.get(zone.id) === current) this.voices.delete(zone.id);
        };
        source.start(0, zone.loop ? Math.random() * buffer.duration : 0);
      }
      if (voice) {
        voice.gain.gain.setTargetAtTime(zone.gain * (indoors ? 0.2 : 1), context.currentTime, 0.25);
        voice.pan.pan.setTargetAtTime(
          spatialSound(listener, { ...zone, y: listener.y }, zone.radius).pan,
          context.currentTime,
          0.1,
        );
      }
    }
  }
  private cache(key: string, buffer: AudioBuffer) {
    if (this.buffers.size >= 8) this.buffers.delete(this.buffers.keys().next().value!);
    this.buffers.set(key, buffer);
  }
  private stop(v: Voice, c: AudioContext) {
    v.gain.gain.setTargetAtTime(0, c.currentTime, 0.03);
    v.source.stop(c.currentTime + 0.15);
  }
  clear(context?: AudioContext) {
    this.generation++;
    this.loading?.abort();
    this.loading = undefined;
    for (const v of this.voices.values()) if (context) this.stop(v, context);
    this.voices.clear();
    this.visited.clear();
    this.failed.clear();
    this.buffers.clear();
  }
}
