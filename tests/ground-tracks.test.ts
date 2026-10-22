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
  snowRutTextures,
  TRACK_LENGTH,
} from '../src/client/ground-tracks';
import { Matrix4 } from 'three';
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
  tracks.record('a', 0, 0, 0, 'snow', true);
  tracks.record('a', 3, 0, 0, 'snow', true);
  assert.equal(tracks.marks.length, 3);
  assert.equal(tracks.opacity(tracks.marks[0]!), 1);
  tracks.tick(TRACK_LIFE / 2);
  assert.ok(tracks.opacity(tracks.marks[0]!) < 0.6);
  tracks.tick(TRACK_LIFE);
  assert.equal(tracks.marks.length, 0);
});

test('tracks last a few real minutes instead of a few seconds', () => {
  assert.ok(TRACK_LIFE >= 120 && TRACK_LIFE <= 180);
  const tracks = new GroundTracks();
  tracks.record('a', 0, 0, 0, 'mud', true);
  tracks.record('a', 3, 0, 0, 'mud', true);
  tracks.tick(90);
  assert.equal(tracks.marks.length, 3);
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
  tracks.record('a', 0, 0, 0, 'snow', false);
  tracks.record('a', 0.1, 0, 0, 'snow', true);
  tracks.record('a', 10, 0, 0, undefined, true);
  assert.equal(tracks.marks.length, 0);
});

test('each tractor keeps its own print spacing', () => {
  const tracks = new GroundTracks();
  tracks.record('a', 0, 0, 0, 'mud', true);
  tracks.record('b', 400, 0, 0, 'mud', true);
  tracks.record('a', 0.4, 0, 0, 'mud', true);
  tracks.record('b', 400.4, 0, 0, 'mud', true);
  assert.equal(tracks.marks.length, 2);
  assert.deepEqual(
    tracks.marks.map((m) => [m.x, m.z]),
    [
      [0, 0],
      [400, 0],
    ],
  );
  tracks.record('a', 3, 0, 0, 'mud', true);
  tracks.record('b', 403, 0, 0, 'mud', true);
  assert.equal(tracks.marks.length, 6);
});

test('snow and wet ground pick the matching track kind', () => {
  assert.equal(trackKind({ snow: 0.5, wetness: 0 }), 'snow');
  assert.equal(trackKind({ snow: 0, wetness: 0.4 }), 'mud');
  assert.equal(trackKind({ snow: 0.02, wetness: 0.05 }), undefined);
});

test('snow channels have recessed floors, bevelled shoulders and an empty wheel gap', () => {
  const { color, height } = snowRutTextures();
  const sample = (u: number, v: number, channel: number, map = height) => {
    const x = Math.round(u * (map.image.width - 1));
    const y = Math.round(v * (map.image.height - 1));
    return map.image.data[(y * map.image.width + x) * 4 + channel]!;
  };
  const centre = 0.5 - TRACK_HALF / TRACK_PRINT_WIDTH;
  const half = TRACK_WIDTH / 2 / TRACK_PRINT_WIDTH;
  const floor = sample(centre, 0.5, 0);
  const shoulder = sample(centre + half * 0.8, 0.5, 0);
  const untouched = sample(0.5, 0.5, 0);
  assert.ok(floor < shoulder && shoulder < untouched);
  assert.equal(sample(0.5, 0.5, 3, color), 0);
  assert.ok(sample(centre, 0.5, 3, color) > 240);
});

test('rut depth follows the snow present when driven over and softens as it melts', () => {
  const tracks = new GroundTracks();
  for (const depth of [0.04, 0.11, 0.25])
    tracks.record(String(depth), 0, 0, 0, 'snow', true, depth);
  tracks.record('mud', 0, 0, 0, 'mud', true, 0);
  tracks.sync(() => 0.11, 0.11);
  const relief = tracks.mesh.geometry.getAttribute('instanceRelief');
  assert.ok(Math.abs(relief.getX(0) - 0.032) < 1e-6);
  assert.ok(Math.abs(relief.getX(1) - 0.088) < 1e-6);
  assert.equal(relief.getX(1), relief.getX(2), 'old deeper tracks cannot exceed current cover');
  tracks.sync(() => 0.02, 0.02);
  assert.ok(Math.abs(relief.getX(1) - 0.016) < 1e-6);
  tracks.sync(() => 0, 0);
  const fade = tracks.mesh.geometry.getAttribute('instanceFade');
  assert.equal(relief.getX(1), 0);
  assert.equal(fade.getX(1), 0);
  assert.equal(fade.getX(3), 1, 'melting snow does not erase mud tracks');
});

test('track corners follow sloping ground without floating four centimetres above it', () => {
  const tracks = new GroundTracks();
  tracks.record('driver', 0, 0, Math.PI / 2, 'snow', true, 0.11);
  tracks.sync((x, z) => 5 + x * 0.1 + z * 0.2, 0.11);
  const matrix = new Matrix4();
  tracks.mesh.getMatrixAt(0, matrix);
  assert.ok(Math.abs(matrix.elements[13]! - 5.002) < 1e-6);
  const corners = tracks.mesh.geometry.getAttribute('instanceGround0');
  const farCorners = tracks.mesh.geometry.getAttribute('instanceGround2');
  const expected = (TRACK_LENGTH / 2) * 0.1 + (TRACK_PRINT_WIDTH / 2) * 0.2;
  assert.ok(Math.abs(corners.getX(0) - expected) < 1e-6);
  assert.ok(Math.abs(farCorners.getZ(0) + expected) < 1e-6);
  assert.equal(tracks.mesh.count, 1);
});

test('slow frames leave continuous tracks without drawing across teleports or dry roads', () => {
  const tracks = new GroundTracks();
  tracks.record('driver', 0, 0, 0, 'snow', true, 0.11);
  tracks.record('driver', 0, 10, 0, 'snow', true, 0.11);
  assert.ok(tracks.marks.length >= 9);
  for (let i = 1; i < tracks.marks.length; i++) {
    assert.ok(tracks.marks[i]!.z - tracks.marks[i - 1]!.z < TRACK_LENGTH);
  }
  const before = tracks.marks.length;
  tracks.record('driver', 200, 200, 0, 'snow', true, 0.11);
  assert.equal(tracks.marks.length, before + 1);
  tracks.record('driver', 200, 205, 0, undefined, true, 0);
  tracks.record('driver', 200, 210, 0, 'snow', true, 0.11);
  assert.equal(tracks.marks.length, before + 2);
});

test('interpolated motion remains continuous when the latest snapshot says stopped', () => {
  const tracks = new GroundTracks();
  tracks.record('driver', 0, 0, 0, 'snow', true, 0.11);
  tracks.record('driver', 0, 5, 0, 'snow', false, 0.11);
  tracks.record('driver', 0, 10, 0, 'snow', true, 0.11);
  assert.ok(tracks.marks.length >= 9);
  for (let i = 1; i < tracks.marks.length; i++)
    assert.ok(tracks.marks[i]!.z - tracks.marks[i - 1]!.z < TRACK_LENGTH);
});
