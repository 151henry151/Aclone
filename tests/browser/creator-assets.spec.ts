// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
function triangle() {
  const binary = Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0]).buffer);
  const doc = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-1, 0, 0],
        max: [1, 2, 0],
      },
    ],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0.15, 0.03, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const text = JSON.stringify(doc),
    json = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4));
  const head = Buffer.alloc(20),
    chunk = Buffer.alloc(8);
  head.write('glTF');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(28 + json.length + binary.length, 8);
  head.writeUInt32LE(json.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  chunk.writeUInt32LE(binary.length);
  chunk.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, json, chunk, binary]);
}
test('uploaded GLB renders as scenery, a building and a vehicle through the real loader', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-visual-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Sculptor'),
      w = createWorld('visual', 'Visual workshop', account.id),
      p = addPlayer(w, account.id, account.name);
    w.script = '';
    w.settings.time = 43200;
    w.settings.dayLength = 0;
    p.x = 0;
    p.z = -25;
    app.worlds.set(w.id, w);
    const port = await app.listen(),
      url = `http://127.0.0.1:${port}`;
    const response = await fetch(url + '/api/assets/' + w.id, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'model/gltf-binary',
        'x-asset-name': 'Copper triangle.glb',
      },
      body: triangle(),
    });
    expect(response.status).toBe(201);
    const asset = (await response.json()) as { id: string };
    w.creator = creatorSchema.parse({
      scenery: false,
      roads: false,
      weather: 'clear',
      models: [
        {
          id: 'sculpture',
          name: 'Copper triangle',
          asset: asset.id,
          width: 8,
          height: 8,
          depth: 2,
        },
      ],
      objects: [{ id: 'triangle', name: 'Copper sculpture', model: 'sculpture', x: 0, z: -15 }],
      vehicleModels: { '0': 'sculpture' },
    });
    w.buildings = [w.buildings.find((b) => b.kind === 'mill')!];
    w.buildings[0].creatorModel = 'sculpture';
    w.buildings[0].creatorBounds = { width: 8, height: 8, depth: 2 };
    w.buildings[0].x = 10;
    w.buildings[0].z = -15;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let loaded = false;
    page.on('response', (r) => {
      if (r.url().endsWith('.glb') && r.ok()) loaded = true;
    });
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
      },
      { token, id: w.id },
    );
    await page.goto(url);
    await expect(page.locator('#world-hud')).toBeVisible();
    await expect.poll(() => loaded).toBe(true);
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/creator-glb.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowUp', { delay: 200 });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
