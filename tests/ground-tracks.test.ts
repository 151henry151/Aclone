// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GroundTracks, TRACK_LIFE, trackKind } from '../src/client/ground-tracks';

test('moving vehicles lay marks that fade and vanish', () => {
  const tracks = new GroundTracks();
  tracks.record(0, 0, 0, 'snow', true);
  tracks.record(3, 0, 0, 'snow', true);
  assert.equal(tracks.marks.length, 2);
  assert.equal(tracks.opacity(tracks.marks[0]!), 1);
  tracks.tick(TRACK_LIFE / 2);
  assert.ok(tracks.opacity(tracks.marks[0]!) < 0.6);
  tracks.tick(TRACK_LIFE);
  assert.equal(tracks.marks.length, 0);
});

test('standing still, walking and dry ground leave no tracks', () => {
  const tracks = new GroundTracks();
  tracks.record(0, 0, 0, 'snow', false);
  tracks.record(0.1, 0, 0, 'snow', true);
  tracks.record(10, 0, 0, undefined, true);
  assert.equal(tracks.marks.length, 0);
});

test('snow and wet ground pick the matching track kind', () => {
  assert.equal(trackKind({ snow: 0.5, wetness: 0 }), 'snow');
  assert.equal(trackKind({ snow: 0, wetness: 0.4 }), 'mud');
  assert.equal(trackKind({ snow: 0.02, wetness: 0.05 }), undefined);
});
