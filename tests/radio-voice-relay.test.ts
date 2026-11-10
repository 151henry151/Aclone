// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { radioAction, radioCheckpoint, restoreRadio } from '../src/shared/radio';
import { RadioVoiceRelay } from '../src/server/radio-voice';
import { radioRules, radioVoiceSamples } from '../src/shared/radio-rules';
function fixture() {
  const w = createWorld('voice', 'Voice', 'a'),
    a = addPlayer(w, 'a', 'Alice'),
    b = addPlayer(w, 'b', 'Bob');
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(0),
  };
  w.settings.seaLevel = -10;
  for (const [i, p] of [a, b].entries())
    Object.assign(p, { online: true, x: i, z: 0, y: 0, vehicle: 0 });
  const relay = new RadioVoiceRelay();
  radioAction(w, a, { type: 'radio', operation: 'voice', value: 'first' });
  const frame = {
    token: 'first',
    sequence: 0,
    data: Buffer.alloc(radioVoiceSamples(radioRules(w.settings)) * 2, 42).toString('base64'),
  };
  return { w, a, b, relay, frame };
}
test('voice routing follows live range, channel, squelch, availability and world pause', () => {
  for (const alter of [
    (f: ReturnType<typeof fixture>) => {
      f.b.x = 100000;
    },
    (f: ReturnType<typeof fixture>) => {
      radioAction(f.w, f.b, { type: 'radio', operation: 'channel', value: 9 });
    },
    (f: ReturnType<typeof fixture>) => {
      radioAction(f.w, f.b, { type: 'radio', operation: 'squelch', value: 1 });
    },
    (f: ReturnType<typeof fixture>) => {
      f.b.online = false;
    },
    (f: ReturnType<typeof fixture>) => {
      f.a.vehicle = 5;
    },
    (f: ReturnType<typeof fixture>) => {
      f.w.settings.radioEnabled = false;
    },
    (f: ReturnType<typeof fixture>) => {
      f.w.settings.chatLocked = true;
    },
    (f: ReturnType<typeof fixture>) => {
      f.w.maintenance = { paused: true, history: [] };
    },
  ]) {
    const f = fixture();
    alter(f);
    assert.deepEqual(f.relay.relay(f.w, f.a, f.frame, 0), []);
  }
});
test('voice queue/rate limits survive action rollback and cannot accumulate idle credit', () => {
  const f = fixture(),
    r = radioRules(f.w.settings);
  let seq = 0;
  const send = (w = f.w, now = 0) =>
    f.relay.relay(w, w.players.a, { ...f.frame, sequence: seq++ }, now);
  for (let i = 0; i < Math.floor(r.radioVoiceBufferMs / r.radioVoiceChunkMs); i++)
    assert.equal(send().length, 1);
  assert.equal(send().length, 0);
  const restored = structuredClone(f.w);
  restoreRadio(restored, radioCheckpoint(f.w));
  assert.equal(send(restored).length, 0, 'rollback must not reset peer rate credit');
  let accepted = 0;
  for (let i = 0; i < 100; i++) accepted += send(restored, 10000).length;
  assert.equal(accepted, Math.floor(r.radioVoiceBufferMs / r.radioVoiceChunkMs));
  assert.equal(send(restored, r.radioVoiceMaxSeconds * 1000).length, 0);
});
test('voice framing uses configured sample rate and packet duration', () => {
  const f = fixture();
  radioAction(f.w, f.a, { type: 'radio', operation: 'release' });
  Object.assign(f.w.settings, { radioVoiceSampleRate: 8000, radioVoiceChunkMs: 40 });
  radioAction(f.w, f.a, { type: 'radio', operation: 'voice', value: 'second' });
  const data = Buffer.alloc(radioVoiceSamples(radioRules(f.w.settings)) * 2, 42).toString('base64');
  const delivery = f.relay.relay(f.w, f.a, { token: 'second', sequence: 0, data }, 0);
  assert.equal(delivery[0].message.sampleRate, 8000);
  assert.equal(delivery[0].message.samples, 320);
});

test('rapid re-keying cannot refill the peer audio rate budget', () => {
  const f = fixture(),
    r = radioRules(f.w.settings);
  for (let i = 0; i < Math.floor(r.radioVoiceBufferMs / r.radioVoiceChunkMs); i++)
    f.relay.relay(f.w, f.a, { ...f.frame, sequence: i }, 0);
  radioAction(f.w, f.a, { type: 'radio', operation: 'release' });
  radioAction(f.w, f.a, { type: 'radio', operation: 'voice', value: 'second' });
  assert.equal(f.relay.relay(f.w, f.a, { ...f.frame, token: 'second' }, 0).length, 0);
});
