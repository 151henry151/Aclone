// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeBundle } from '../src/server/asset-bundle.ts';
import { createWorld } from '../src/shared/simulation.ts';
import { creatorSchema, validateCreator } from '../src/shared/creator.ts';
import { exportDesign, applyDesign } from '../src/server/world-design.ts';
import { validateVisualAsset } from '../src/server/asset-validation.ts';
function animated(times = [0, 1], path = 'translation') {
  const data = Buffer.from(new Float32Array([...times, 0, 0, 0, 0, 1, 0]).buffer);
  const doc = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: data.length }],
    bufferViews: [
      { buffer: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 24 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: 'SCALAR', count: 2 },
      { bufferView: 1, componentType: 5126, type: 'VEC3', count: 2 },
    ],
    nodes: [{}],
    scenes: [{ nodes: [0] }],
    animations: [
      {
        channels: [{ sampler: 0, target: { node: 0, path } }],
        samplers: [{ input: 0, output: 1 }],
      },
    ],
  };
  const text = JSON.stringify(doc),
    json = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4)),
    h = Buffer.alloc(20),
    b = Buffer.alloc(8);
  h.write('glTF');
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(28 + json.length + data.length, 8);
  h.writeUInt32LE(json.length, 12);
  h.writeUInt32LE(0x4e4f534a, 16);
  b.writeUInt32LE(data.length);
  b.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, json, b, data]);
}
test('bounded animations accept node motion and reject invalid timelines and morph targets', () => {
  validateVisualAsset(animated(), 'model/gltf-binary');
  for (const input of [
    animated([1, 0]),
    animated([0, 301]),
    animated([0, NaN]),
    animated([0, 1], 'weights'),
  ])
    assert.throws(() => validateVisualAsset(input, 'model/gltf-binary'));
});
test('portable media verifies hashes, provenance, types and duplicates before importing bindings', () => {
  const bytes = Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'),
    id = createHash('sha256').update(bytes).digest('hex'),
    entry = {
      id,
      name: 'Original.obj',
      type: 'model/obj',
      data: bytes.toString('base64'),
      provenance: { author: 'Sculptor', license: 'CC0', source: 'Original' },
    };
  const [decoded] = decodeBundle([entry]);
  assert.deepEqual(decoded.bytes, bytes);
  assert.equal(decoded.asset.provenance?.author, 'Sculptor');
  for (const list of [
    [{ ...entry, id: '0'.repeat(64) }],
    [entry, entry],
    [{ ...entry, type: 'constructor' }],
    [{ ...entry, data: '%%%%' }],
  ])
    assert.throws(() => decodeBundle(list));
  const w = createWorld('author', 'Author', 'owner');
  w.assets = [decoded.asset];
  w.creator = creatorSchema.parse({
    models: [{ id: 'rock', name: 'Rock', asset: id }],
    resourceModels: { stone: 'rock' },
  });
  validateCreator(w, w.creator);
  const bundled = exportDesign(w, true),
    copy = createWorld('copy', 'Copy', 'copy-owner');
  copy.assets = [decoded.asset];
  applyDesign(copy, bundled);
  assert.equal(copy.creator?.models[0].asset, id);
  assert.equal(copy.creator?.resourceModels.stone, 'rock');
  const plain = exportDesign(w),
    empty = createWorld('plain', 'Plain', 'owner');
  applyDesign(empty, plain);
  assert.equal(empty.creator?.models[0].asset, undefined);
  assert.throws(() => validateCreator(w, { ...w.creator, terrainTextures: { grass: id } }));
  assert.throws(() => validateCreator(w, { ...w.creator, models: [] }));
});
