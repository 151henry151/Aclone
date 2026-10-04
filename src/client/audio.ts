import { AmbientAudio } from './ambient-audio';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import {
  HornTracker,
  MAX_HORNS,
  selectLoops,
  spatialSound,
  type Listener,
  type Position,
} from './sound-scene';
import { synthesize, type SoundKind } from './sound-synthesis';

export type AudioChannel = 'engine' | 'effects' | 'ambience' | 'chat';
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  kind: SoundKind;
};

/** One lazy, gesture-unlocked context. No audio downloads or per-frame oscillator allocation. */
export class GameAudio {
  enabled = localStorage.getItem('aclone.sound') !== 'off';
  volume = 0.65;
  onChange = () => {};
  readonly channels: Record<AudioChannel, number> = {
    engine: 1,
    effects: 1,
    ambience: 0.6,
    chat: 0.5,
  };
  private buses = new Map<AudioChannel, GainNode>();
  private ambience = new AmbientAudio();
  private messageId?: number;
  private lastAlert = 0;
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private failed = false;
  private active = true;
  private world?: World;
  private me?: Player;
  private listener?: Listener;
  private buffers = new Map<SoundKind, AudioBuffer>();
  private loops = new Map<string, Voice>();
  private shots = new Map<Voice, string | undefined>();
  private horns = new HornTracker();
  private nextUpdate = 0;
  private lastSnapshot = 0;
  constructor() {
    for (const key of Object.keys(this.channels) as AudioChannel[]) {
      const raw = localStorage.getItem('aclone.volume.' + key);
      if (raw !== null && Number.isFinite(Number(raw)))
        this.channels[key] = Math.max(0, Math.min(1, Number(raw)));
    }
    const saved = localStorage.getItem('aclone.volume');
    const volume = saved === null ? NaN : Number(saved);
    if (Number.isFinite(volume)) this.volume = Math.max(0, Math.min(1, volume));
  }
  get status(): string {
    if (!this.enabled || !this.volume) return 'Sound: off';
    if (this.failed) return 'Sound unavailable';
    return this.context?.state === 'running' ? 'Sound: on' : 'Sound: tap to start';
  }
  /** Call synchronously from pointerdown/keydown, not a delayed promise or server reply. */
  unlock() {
    if (!this.enabled || !this.active || !this.volume) return;
    try {
      if (!this.context) {
        const context = (this.context = new AudioContext());
        this.master = context.createGain();
        this.master.gain.value = this.volume;
        for (const key of Object.keys(this.channels) as AudioChannel[]) {
          const bus = context.createGain();
          bus.gain.value = this.channels[key];
          bus.connect(this.master);
          this.buses.set(key, bus);
        }
        this.limiter = context.createDynamicsCompressor();
        this.limiter.threshold.value = -12;
        this.limiter.knee.value = 12;
        this.limiter.ratio.value = 8;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.2;
        this.master.connect(this.limiter).connect(context.destination);
        context.onstatechange = () => this.onChange();
      }
      this.failed = false;
      if (this.context.state !== 'running')
        void this.context
          .resume()
          .then(() => this.onChange())
          .catch(() => {
            this.onChange(); // Another gesture can retry a browser autoplay interruption.
          });
    } catch {
      this.failed = true;
    }
    this.onChange();
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('aclone.sound', enabled ? 'on' : 'off');
    if (!enabled) this.silence();
    else {
      this.unlock();
      this.masterVolume();
    }
    this.onChange();
  }
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('aclone.volume', String(this.volume));
    if (!this.volume) this.silence();
    else {
      this.unlock();
      this.masterVolume();
    }
    this.onChange();
  }
  setChannel(channel: AudioChannel, volume: number) {
    if (!Object.hasOwn(this.channels, channel) || !Number.isFinite(volume)) return;
    this.channels[channel] = Math.max(0, Math.min(1, volume));
    localStorage.setItem('aclone.volume.' + channel, String(this.channels[channel]));
    if (this.context)
      this.buses
        .get(channel)
        ?.gain.setTargetAtTime(this.channels[channel], this.context.currentTime, 0.03);
    this.onChange();
  }
  private masterVolume() {
    this.master?.gain.setTargetAtTime(
      this.enabled && this.active ? this.volume : 0,
      this.context!.currentTime,
      0.025,
    );
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      this.silence();
      if (this.context) void this.context.suspend().catch(() => {});
    } else {
      if (this.context) this.unlock();
      this.masterVolume();
    }
  }
  setWorld(w: World, me: string) {
    if (this.world?.id !== w.id) this.clear();
    this.world = w;
    this.me = w.players[me];
    this.lastSnapshot = performance.now();
    const newest = Math.max(0, ...w.messages.map((m) => m.id ?? 0));
    if (
      this.messageId !== undefined &&
      w.messages.some(
        (m) => (m.id ?? 0) > this.messageId! && m.kind === 'chat' && m.name !== this.me?.name,
      ) &&
      performance.now() - this.lastAlert > 2000 &&
      this.audible() &&
      this.shots.size < MAX_HORNS
    ) {
      const voice = this.voice('chat', false);
      voice.gain.gain.value = 0.3;
      this.shots.set(voice, undefined);
      this.lastAlert = performance.now();
    }
    this.messageId = newest;
    const p = this.me;
    const listener = this.listener ?? { ...p, heading: p.heading };
    // Consume events even when muted/hidden/locked so they cannot build a backlog.
    for (const id of this.horns.receive(w)) {
      const player = w.players[id];
      const spatial = id === me ? { gain: 1, pan: 0 } : spatialSound(listener, player, 150);
      if (spatial.gain > 0.001 && this.shots.size < MAX_HORNS && this.audible())
        this.playHorn(spatial.gain * (p.atHome ? 0.25 : 1), spatial.pan, id);
    }
  }
  private audible() {
    return this.enabled && this.active && this.volume > 0 && this.context?.state === 'running';
  }
  update(listener: Listener, position: (id: string) => Position | undefined) {
    this.listener = listener;
    const now = performance.now();
    if (now < this.nextUpdate) return;
    this.nextUpdate = now + 50;
    if (!this.world || !this.me || !this.audible() || now - this.lastSnapshot > 3000) {
      this.stopVoices();
      return;
    }
    this.ambience.update(
      this.world,
      listener,
      this.context!,
      this.buses.get('ambience')!,
      !!this.me.atHome,
    );
    const sounds = selectLoops(this.world, this.me, listener, position);
    const keep = new Set(sounds.map((s) => s.id));
    for (const [id, voice] of this.loops)
      if (!keep.has(id)) {
        this.stop(voice);
        this.loops.delete(id);
      }
    for (const sound of sounds) {
      let voice = this.loops.get(sound.id);
      if (voice && voice.kind !== sound.kind) {
        this.stop(voice);
        voice = undefined;
      }
      if (!voice) {
        voice = this.voice(sound.kind, true);
        this.loops.set(sound.id, voice);
      }
      const time = this.context!.currentTime;
      voice.gain.gain.setTargetAtTime(sound.gain, time, 0.12);
      voice.pan.pan.setTargetAtTime(sound.pan, time, 0.08);
      voice.source.playbackRate.setTargetAtTime(sound.rate, time, 0.18);
    }
    for (const [voice, id] of this.shots) {
      if (voice.kind === 'chat') continue;
      const p = id && this.world.players[id];
      if (!p || !p.online || p.atHome) {
        this.stop(voice);
        this.shots.delete(voice);
      } else if (id !== this.me.id) {
        const spatial = spatialSound(listener, position(id!) ?? p, 150);
        voice.gain.gain.setTargetAtTime(
          spatial.gain * 0.6 * (this.me.atHome ? 0.25 : 1),
          this.context!.currentTime,
          0.05,
        );
        voice.pan.pan.setTargetAtTime(spatial.pan, this.context!.currentTime, 0.05);
      }
    }
  }
  private voice(kind: SoundKind, loop: boolean): Voice {
    const context = this.context!;
    let buffer = this.buffers.get(kind);
    if (!buffer) {
      const samples = synthesize(kind, context.sampleRate);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(kind, buffer);
    }
    const source = context.createBufferSource(),
      gain = context.createGain(),
      pan = context.createStereoPanner();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = 0;
    source
      .connect(gain)
      .connect(pan)
      .connect(
        this.buses.get(kind === 'engine' ? 'engine' : kind === 'chat' ? 'chat' : 'effects')!,
      );
    const voice = { source, gain, pan, kind };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.shots.delete(voice);
    };
    source.start(0, loop ? Math.random() * buffer.duration : 0);
    return voice;
  }
  weapon() {
    if (!this.me || !this.audible() || this.shots.size >= MAX_HORNS) return;
    const voice = this.voice('weapon', false);
    voice.gain.gain.value = 0.08;
    this.shots.set(voice, this.me.id);
  }
  toggle() {
    if (!this.volume) {
      this.setVolume(0.65);
      this.setEnabled(true);
    } else if (this.enabled && this.context?.state !== 'running') this.unlock();
    else this.setEnabled(!this.enabled);
  }
  private playHorn(gain: number, pan: number, player: string) {
    const voice = this.voice('horn', false);
    voice.gain.gain.value = gain * 0.6;
    voice.pan.pan.value = pan;
    this.shots.set(voice, player);
  }
  private stop(voice: Voice) {
    const time = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setTargetAtTime(0, time, 0.015);
    voice.source.stop(time + 0.08);
  }
  private stopVoices() {
    this.ambience.clear(this.context);
    for (const voice of this.loops.values()) this.stop(voice);
    for (const voice of this.shots.keys()) this.stop(voice);
    this.loops.clear();
    this.shots.clear();
  }
  private silence() {
    this.masterVolume();
    this.stopVoices();
  }
  clear() {
    this.stopVoices();
    this.world = undefined;
    this.me = undefined;
    this.listener = undefined;
    this.horns.clear();
    this.messageId = undefined;
  }
  dispose() {
    this.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.buffers.clear();
  }
}
