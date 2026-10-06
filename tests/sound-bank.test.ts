// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoundBank, soundKinds, SOUND_RATE } from '../src/client/sound-bank.ts';
import { synthesize, type SoundKind } from '../src/client/sound-synthesis.ts';

test('the sound bank synthesizes every sound once during loading, yielding between them', async () => {
  const made: SoundKind[] = [];
  let yields = 0;
  const bank = new SoundBank((kind, rate) => {
    made.push(kind);
    return new Float32Array(rate / 100);
  });
  assert.equal(
    await bank.prepare(
      () => true,
      async () => void yields++,
    ),
    true,
  );
  assert.deepEqual(made, soundKinds);
  assert.equal(yields, soundKinds.length);
  // Playing a prepared sound reuses it rather than synthesizing on the first frame of play.
  assert.equal(bank.get('engine'), bank.get('engine'));
  await bank.prepare(
    () => true,
    async () => void yields++,
  );
  assert.equal(made.length, soundKinds.length);
});

test('loading can be abandoned part way and sounds still synthesize on demand', async () => {
  let made = 0;
  const bank = new SoundBank((_, rate) => (made++, new Float32Array(rate / 100)));
  let left = 2;
  assert.equal(
    await bank.prepare(
      () => left-- > 0,
      async () => {},
    ),
    false,
  );
  assert.equal(made, 2);
  assert.equal(bank.get('storm').length, SOUND_RATE / 100);
});

test('every playable sound kind is in the bank at the fixed bank rate', () => {
  for (const kind of soundKinds) assert.ok(new SoundBank().get(kind).length > 0);
  assert.deepEqual(new SoundBank().get('horn'), synthesize('horn', SOUND_RATE));
});
