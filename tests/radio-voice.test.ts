// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { radioAction, radioView, tickRadio } from '../src/shared/radio';

test('a microphone session keys without text and stops at the configured duration', () => {
  const w = createWorld('voice', 'Voice', 'a'),
    p = addPlayer(w, 'a', 'Alice');
  p.online = true;
  w.settings.radioVoiceMaxSeconds = 2;
  radioAction(w, p, { type: 'radio', operation: 'voice', value: 'session-a' });
  assert.equal(radioView(w, p).keyed[0].voice, 'session-a');
  assert.equal(radioView(w, p).keyed[0].remaining, 2);
  tickRadio(w, 2);
  assert.equal(radioView(w, p).keyed.length, 0);
});

test('mute or lock interrupts microphone participation, including an already keyed session', () => {
  const w = createWorld('voice', 'Voice', 'a'),
    p = addPlayer(w, 'a', 'Alice');
  p.online = true;
  radioAction(w, p, { type: 'radio', operation: 'voice', value: 'session-a' });
  p.muted = true;
  tickRadio(w, 0.1);
  assert.equal(radioView(w, p).keyed.length, 0);
  assert.throws(
    () => radioAction(w, p, { type: 'radio', operation: 'voice', value: 'session-b' }),
    /muted/,
  );
});

test('legacy text length limits do not prevent microphone speech', () => {
  const w = createWorld('voice', 'Voice', 'a'),
    p = addPlayer(w, 'a', 'Alice');
  p.online = true;
  w.settings.radioMaxLength = 1;
  radioAction(w, p, { type: 'radio', operation: 'voice', value: 'session-a' });
  assert.equal(radioView(w, p).keyed.length, 1);
});
