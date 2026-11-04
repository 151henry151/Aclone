// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../src/client/audio';
test('radio alerts scale with the vehicle volume and obey master mute and the shared voice budget', () => {
  const audio = Object.create(GameAudio.prototype) as GameAudio;
  const shots = new Map(),
    voices: any[] = [];
  Object.assign(audio, {
    enabled: true,
    active: true,
    volume: 1,
    context: { state: 'running' },
    shots,
    voice: (kind: string) => {
      assert.equal(kind, 'chat');
      const voice = { gain: { gain: { value: 0 } } };
      voices.push(voice);
      return voice;
    },
  });
  audio.radio(0.5);
  assert.equal(voices.length, 1);
  assert.equal(voices[0].gain.gain.value, 0.15);
  audio.radio(0);
  assert.equal(voices.length, 1);
  audio.enabled = false;
  audio.radio(1);
  assert.equal(voices.length, 1);
  audio.enabled = true;
  audio.volume = 0;
  audio.radio(1);
  assert.equal(voices.length, 1);
  audio.volume = 1;
  Object.assign(audio, { context: { state: 'suspended' } });
  audio.radio(1);
  assert.equal(voices.length, 1);
  Object.assign(audio, { context: { state: 'running' } });
  for (let i = 0; i < 100; i++) audio.radio(1);
  assert.ok(voices.length < 100);
});
