// SPDX-License-Identifier: GPL-3.0-or-later
import { radioVoiceSamples, type RadioRules } from '../shared/radio-rules';
export interface ReceivedVoice {
  world: string;
  from: string;
  token: string;
  sequence: number;
  channel: number;
  sampleRate: number;
  samples: number;
  strength: number;
  collision: boolean;
  data?: string;
}
/** Microphone lifetime is independent of permission promises, which may never resolve. */
export class RadioVoice {
  private context?: AudioContext;
  private module?: Promise<void>;
  private generation = 0;
  private stream?: MediaStream;
  private input?: MediaStreamAudioSourceNode;
  private capture?: AudioWorkletNode;
  private silent?: GainNode;
  private output?: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private until = 0;
  private sequence = new Map<string, number>();
  get listening() {
    return this.context?.state === 'running';
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  async start(rules: RadioRules, send: (data: string) => void) {
    this.stopCapture();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error('Microphone unavailable. Use HTTPS and a browser with microphone support.');
    const unlock = this.unlock();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.stream = stream;
    try {
      await unlock;
      const context = this.context!;
      this.module ??= context.audioWorklet.addModule(
        new URL('./radio-capture.worklet.js?no-inline', import.meta.url),
      );
      await this.module;
      if (generation !== this.generation) return false;
      this.input = context.createMediaStreamSource(stream);
      this.capture = new AudioWorkletNode(context, 'radio-capture', {
        processorOptions: { rate: rules.radioVoiceSampleRate, samples: radioVoiceSamples(rules) },
      });
      this.capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
        if (generation === this.generation)
          send(btoa(String.fromCharCode(...new Uint8Array(data))));
      };
      this.silent = context.createGain();
      this.silent.gain.value = 0;
      this.input.connect(this.capture).connect(this.silent).connect(context.destination);
      return true;
    } catch (error) {
      this.module = undefined;
      if (generation === this.generation) this.stopCapture();
      throw error;
    }
  }
  stopCapture() {
    this.generation++;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.input?.disconnect();
    this.input = undefined;
    if (this.capture) {
      this.capture.port.onmessage = null;
      this.capture.disconnect();
      this.capture.port.close();
      this.capture = undefined;
    }
    this.silent?.disconnect();
    this.silent = undefined;
  }
  volume(value: number) {
    if (this.output) this.output.gain.value = value;
    if (!value) this.stopPlayback();
  }
  stopPlayback() {
    for (const source of this.sources) {
      source.stop();
      source.disconnect();
    }
    this.sources.clear();
    this.until = 0;
    this.sequence.clear();
  }
  receive(frame: ReceivedVoice, rules: RadioRules) {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.output?.gain.value) return;
    const old = this.sequence.get(frame.token) ?? -1;
    if (frame.sequence <= old) return;
    const duration = frame.samples / frame.sampleRate,
      bufferLimit = rules.radioVoiceBufferMs / 1000;
    if (this.until - context.currentTime + duration > bufferLimit) return;
    this.sequence.set(frame.token, frame.sequence);
    // Carrier sessions are transient; never let an old talker grow the lookup indefinitely.
    if (this.sequence.size > rules.radioLogLimit)
      this.sequence.delete(this.sequence.keys().next().value!);
    const buffer = context.createBuffer(1, frame.samples, frame.sampleRate),
      channel = buffer.getChannelData(0);
    const clarity = frame.collision
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (frame.strength - rules.radioStaticSignal) /
              (rules.radioClearSignal - rules.radioStaticSignal),
          ),
        );
    const bytes = frame.data
      ? Uint8Array.from(atob(frame.data), (c) => c.charCodeAt(0))
      : undefined;
    const pcm = bytes ? new DataView(bytes.buffer) : undefined;
    for (let i = 0; i < channel.length; i++)
      channel[i] =
        (pcm ? pcm.getInt16(i * 2, true) / 32768 : 0) * clarity +
        (Math.random() * 2 - 1) * (1 - clarity) * 0.12;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    const start = Math.max(context.currentTime, this.until);
    this.until = start + duration;
    source.start(start);
  }
}
