// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVisualAsset } from '../src/server/asset-validation.ts';
import { ScriptPool, ScriptEvents } from '../src/server/scripts.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { applyEffect } from '../src/shared/creator.ts';
function glb(doc: Record<string, unknown>, binary = Buffer.alloc(0)) {
  const json = Buffer.from(
    JSON.stringify({ asset: { version: '2.0' }, ...doc }).padEnd(
      Math.ceil(JSON.stringify({ asset: { version: '2.0' }, ...doc }).length / 4) * 4,
    ),
  );
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + (binary.length ? 8 + binary.length : 0), 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  if (!binary.length) return Buffer.concat([header, json]);
  const bin = Buffer.alloc(8);
  bin.writeUInt32LE(binary.length);
  bin.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, bin, binary]);
}
test('workshop accepts embedded static geometry and refuses external fetches, cycles and oversized geometry', () => {
  const mesh = {
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
  };
  validateVisualAsset(glb(mesh, Buffer.alloc(36)), 'model/gltf-binary');
  for (const doc of [
    { buffers: [{ uri: 'https://outside.example/model.bin' }] },
    { images: [{ uri: 'file:///etc/passwd' }] },
    { nodes: [{ children: [1] }, { children: [0] }] },
    { nodes: [{ children: [2] }, { children: [2] }, {}] },
    { extensionsUsed: ['KHR_draco_mesh_compression'] },
    { ...mesh, accessors: [{ ...mesh.accessors[0], count: 300001 }] },
    { ...mesh, bufferViews: [{ buffer: 0, byteOffset: -12, byteLength: 36 }] },
  ])
    assert.throws(() => validateVisualAsset(glb(doc, Buffer.alloc(36)), 'model/gltf-binary'));
});
test('uploaded and GLB embedded images have dimension budgets', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
    'base64',
  );
  validateVisualAsset(png, 'image/png');
  const oversized = Buffer.from(png);
  oversized.writeUInt32BE(4096, 16);
  assert.throws(() => validateVisualAsset(oversized, 'image/png'), /2048/);
  const zero = Buffer.from(png);
  zero.writeUInt32BE(0, 20);
  assert.throws(() => validateVisualAsset(zero, 'image/png'));
  assert.throws(() => validateVisualAsset(Buffer.alloc(12), 'image/png'));
});
test('isolated Lua effects use observed player state and are bounded before application', async () => {
  const pool = new ScriptPool();
  try {
    const w = createWorld('lua-effects', 'Effects', 'owner'),
      p = addPlayer(w, 'visitor', 'Visitor');
    p.health = 20000;
    p.inventory = {};
    w.script =
      'on("ObjectInteract", function(e) if player_value(e.id, "health") < 30000 then heal(e.id, 1000); give(e.id, "water", 1); setvar("visits", getvar("visits") + 1) end end)';
    const events = new ScriptEvents(pool.run.bind(pool));
    const r = await events.run(w, 'ObjectInteract', { id: p.id, target: 'oak' }, () => true);
    assert.equal(r?.variables.visits, 1);
    assert.equal(r?.effects?.length, 2);
    for (const e of r!.effects!) applyEffect(w, w.players[e.player!], e.effect as any);
    assert.equal(p.health, 21000);
    assert.equal(p.inventory.water, 1);
    w.script = 'on("ObjectInteract", function(e) give(e.id,"water",1000000) end)';
    assert.equal(await events.run(w, 'ObjectInteract', { id: p.id }, () => true), undefined);
    assert.ok(w.messages.some((m) => m.name === 'Script error'));
    assert.equal(p.inventory.water, 1);
  } finally {
    pool.close();
  }
});
