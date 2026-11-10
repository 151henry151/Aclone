// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { radioVoiceSession, radioVoiceListeners } from '../shared/radio';
import { radioVoiceSamples } from '../shared/radio-rules';
export interface VoiceFrame {
  token: string;
  sequence: number;
  data: string;
}
/** One bounded rate bucket per peer. Audio is ephemeral; no world copies or writes. */
export class RadioVoiceRelay {
  private session?: string;
  private start = 0;
  private sequence = -1;
  private credit = 0;
  private last = 0;
  relay(w: World, p: Player, frame: VoiceFrame, now: number) {
    const tx = radioVoiceSession(w, p, frame.token);
    if (!tx) return [];
    const rules = tx.voiceRules!,
      samples = radioVoiceSamples(rules);
    const session = `${w.id}:${tx.id}:${tx.voice}`;
    if (this.session !== session) {
      if (!this.session) {
        this.credit = rules.radioVoiceBufferMs;
        this.last = now;
      }
      this.session = session;
      this.start = now;
      this.sequence = -1;
    }
    if (frame.sequence <= this.sequence || now - this.start >= rules.radioVoiceMaxSeconds * 1000)
      return [];
    if (
      frame.data.length !== Math.ceil((samples * 2) / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(frame.data)
    )
      return [];
    const bytes = Buffer.from(frame.data, 'base64');
    if (bytes.length !== samples * 2 || bytes.toString('base64') !== frame.data) return [];
    // Refill only a bounded jitter allowance; idle time cannot fund an audio burst.
    this.credit = Math.min(rules.radioVoiceBufferMs, this.credit + Math.max(0, now - this.last));
    this.last = now;
    if (this.credit < rules.radioVoiceChunkMs) return [];
    this.sequence = frame.sequence;
    this.credit -= rules.radioVoiceChunkMs;
    return radioVoiceListeners(w, p, frame.token).map((listener) => ({
      id: listener.id,
      message: {
        type: 'radio-audio',
        world: w.id,
        from: p.id,
        token: frame.token,
        sequence: frame.sequence,
        channel: tx.channel,
        sampleRate: rules.radioVoiceSampleRate,
        samples,
        strength: listener.strength,
        collision: listener.collision,
        ...(listener.collision ? {} : { data: frame.data }),
      },
    }));
  }
}
