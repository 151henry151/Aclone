// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GroundTracks,
  TRACK_LIFE,
  TRACK_WIDTH,
  trackKind,
  trackPrintTexture,
  snowRutTextures,
  TRACK_LENGTH,
  wheelPrints,
} from '../src/client/ground-tracks';
import { Matrix4, Vector3, Quaternion, Euler } from 'three';

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

test('the stamp is a tread print, not a solid slab', () => {
  const tyreU = 0.5;
  const gap = sample(0, 0.5);
  const tread = sample(tyreU, 0.22);
  const bar = sample(tyreU, 0.3);
  assert.ok(gap.a < 20, 'outside the tyre stays empty');
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

test('snow channels have recessed floors, bevelled shoulders and transparent edges', () => {
  const { color, height } = snowRutTextures();
  const sample = (u: number, v: number, channel: number, map = height) => {
    const x = Math.round(u * (map.image.width - 1));
    const y = Math.round(v * (map.image.height - 1));
    return map.image.data[(y * map.image.width + x) * 4 + channel]!;
  };
  const centre = 0.5;
  const half = 0.5;
  const floor = sample(centre, 0.5, 0);
  const shoulder = sample(centre + half * 0.8, 0.5, 0);
  const untouched = sample(0, 0.5, 0);
  assert.ok(floor < shoulder && shoulder < untouched);
  assert.equal(sample(0, 0.5, 3, color), 0);
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
  const expected = (TRACK_LENGTH / 2) * 0.1 + (TRACK_WIDTH / 2) * 0.2;
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

test('each wheel preserves its own width, axle position and lateral spacing through turns', () => {
  // Deliberately different front/rear sizes: no paired texture can encode these.
  const wheels = [
    { position: new Vector3(-1.1, 0, -1.4), width: 0.68 },
    { position: new Vector3(1.1, 0, -1.4), width: 0.68 },
    { position: new Vector3(-0.8, 0, 1.2), width: 0.38 },
    { position: new Vector3(0.8, 0, 1.2), width: 0.38 },
  ];
  const transform = new Matrix4().compose(
    new Vector3(10, 0, 20),
    new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0)),
    new Vector3(1, 1, 1),
  );
  const prints = wheelPrints(wheels, transform);
  assert.deepEqual(
    prints.map((p) => p.width),
    [0.68, 0.68, 0.38, 0.38],
  );
  for (const [i, print] of prints.entries()) {
    assert.ok(Math.abs(print.x - (10 + wheels[i]!.position.z)) < 1e-8);
    assert.ok(Math.abs(print.z - (20 - wheels[i]!.position.x)) < 1e-8);
    assert.ok(Math.abs(print.heading - Math.PI / 2) < 1e-8);
  }
  const tracks = new GroundTracks();
  for (const [i, p] of prints.entries())
    tracks.record(String(i), p.x, p.z, p.heading, 'snow', true, 0.11, p.width);
  tracks.sync(() => 0, 0.11);
  const matrix = new Matrix4(),
    scale = new Vector3(),
    pos = new Vector3();
  for (let i = 0; i < prints.length; i++) {
    tracks.mesh.getMatrixAt(i, matrix);
    matrix.decompose(pos, new Quaternion(), scale);
    assert.ok(Math.abs(scale.x - prints[i]!.width) < 1e-6);
    assert.ok(Math.abs(pos.x - prints[i]!.x) < 1e-6);
    assert.ok(Math.abs(pos.z - prints[i]!.z) < 1e-6);
  }
});

test('returning and switching machines do not connect stale tyre paths', () => {
  const tracks = new GroundTracks();
  tracks.record('driver:24:0', 0, 0, 0, 'mud', true, 0, 0.38);
  tracks.tick(2);
  tracks.record('driver:24:0', 0, 10, 0, 'mud', true, 0, 0.38);
  tracks.record('driver:27:0', 0, 20, 0, 'mud', true, 0, 0.68);
  assert.equal(tracks.marks.length, 3);
  assert.deepEqual(
    tracks.marks.map((m) => m.width),
    [0.38, 0.38, 0.68],
  );
});

test('reversing leaves a continuous trail with the same tyre width', () => {
  const tracks = new GroundTracks();
  for (let z = 10; z >= 0; z--) tracks.record('rear-left', 0, z, 0, 'mud', true, 0, 0.68);
  assert.ok(tracks.marks.length >= 8);
  assert.ok(tracks.marks.every((m) => m.width === 0.68));
  for (let i = 1; i < tracks.marks.length; i++)
    assert.ok(tracks.marks[i - 1]!.z - tracks.marks[i]!.z < TRACK_LENGTH);
});

test('turning wheel stamps follow their own path while reverse tread keeps its orientation', () => {
  const tracks = new GroundTracks();
  tracks.record('front', 0, 0, 0, 'snow', true);
  tracks.record('front', 3, 3, 0, 'snow', true);
  assert.ok(Math.abs(tracks.marks[1]!.heading - Math.PI / 4) < 1e-8);
  tracks.record('reverse', 0, 0, 0, 'mud', true);
  tracks.record('reverse', 0, -3, 0, 'mud', true);
  assert.ok(Math.cos(tracks.marks.at(-1)!.heading) > 0.999);
});
