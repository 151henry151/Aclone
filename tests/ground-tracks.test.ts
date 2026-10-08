// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GroundTracks,
  TRACK_HALF,
  TRACK_LIFE,
  TRACK_PRINT_WIDTH,
  TRACK_WIDTH,
  trackKind,
  trackPrintTexture,
} from '../src/client/ground-tracks';
import { TRACTOR_SCALE } from '../src/client/tractor';

function sample(u: number, v: number) {
  const tex = trackPrintTexture(),
    { data, width, height } = tex.image,
    x = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1)))),
    y = Math.min(height - 1, Math.max(0, Math.round(v * (height - 1)))),
    i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

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

test('tracks last a few real minutes instead of a few seconds', () => {
  assert.ok(TRACK_LIFE >= 120 && TRACK_LIFE <= 180);
  const tracks = new GroundTracks();
  tracks.record(0, 0, 0, 'mud', true);
  tracks.record(3, 0, 0, 'mud', true);
  tracks.tick(90);
  assert.equal(tracks.marks.length, 2);
  assert.ok(tracks.opacity(tracks.marks[0]!) > 0.35);
});

test('prints sit under the tractor tyres, not as a narrow centre stripe', () => {
  assert.ok(Math.abs(TRACK_HALF - 1.22 * TRACTOR_SCALE) < 0.02);
  assert.ok(Math.abs(TRACK_WIDTH - 0.58 * TRACTOR_SCALE) < 0.02);
  assert.ok(TRACK_PRINT_WIDTH > 2);
});

test('the stamp is a tread print, not a solid slab', () => {
  const tyreU = 0.5 - TRACK_HALF / TRACK_PRINT_WIDTH;
  const gap = sample(0.5, 0.5);
  const tread = sample(tyreU, 0.18);
  const bar = sample(tyreU, 0.3);
  assert.ok(gap.a < 20, 'the gap between wheels stays empty');
  assert.ok(tread.a > 40 || bar.a > 40, 'a tyre strip is printed');
  assert.ok(Math.abs(tread.a - bar.a) > 20, 'chevron bars, not a solid rectangle');
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
